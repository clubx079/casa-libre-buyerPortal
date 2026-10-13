// POST /api/listing-payment/create-intent { propertyId, kind: 'publish' | 'extend', useSavedCard }
// Pay for a listing over the free monthly quota ('publish', US$5.80 by default) or for
// 30 more days ('extend', US$5). Same two paths as the promotions (/api/highlight):
// one-click on the saved card, or a new PaymentIntent the client confirms with the
// card form (then /api/listing-payment/confirm). The price always comes from the
// admin settings on the server (lib/paidListings.js), never from the client.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { checkPayable, applyListingPayment, recordListingFailure, getUserBillingRow, ensureStripeCustomer } from '@/lib/listingPayments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function friendly(e) {
  const code = e?.decline_code || e?.code || e?.raw?.decline_code || e?.raw?.code;
  if (code === 'insufficient_funds') return 'Fondos insuficientes en la tarjeta.';
  if (code === 'card_declined' || code === 'generic_decline') return 'La tarjeta fue rechazada.';
  if (code === 'expired_card') return 'La tarjeta está vencida.';
  if (code === 'incorrect_cvc') return 'El código de seguridad (CVC) es incorrecto.';
  return e?.message || 'El pago no pudo completarse.';
}

export async function POST(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === 'extend' ? 'extend' : 'publish';
  const propertyId = String(body.propertyId || '');
  if (!propertyId) return NextResponse.json({ error: 'missing_property' }, { status: 400 });

  const chk = await checkPayable(session.uid, propertyId, kind);
  if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status });
  const { cents } = chk;

  const user = await getUserBillingRow(session.uid);
  if (!user) return NextResponse.json({ error: 'no_user' }, { status: 400 });
  let customerId;
  try { customerId = await ensureStripeCustomer(user); }
  catch (e) { return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 }); }

  const metadata = { user_id: String(session.uid), property_id: propertyId, product: 'casa-libre-listing', kind };
  const description = kind === 'extend' ? 'Casa Libre — extender publicación' : 'Casa Libre — publicación adicional';
  const card = user.card_last4 ? { brand: user.card_brand, last4: user.card_last4 } : null;

  if (body.useSavedCard && user.card_pm_id) {
    try {
      const pi = await stripe.paymentIntents.create({ amount: cents, currency: 'usd', customer: customerId, payment_method: user.card_pm_id, off_session: true, confirm: true, metadata, description });
      if (pi.status === 'succeeded') {
        const { until } = await applyListingPayment({ uid: session.uid, propertyId, kind, pi, card });
        return NextResponse.json({ status: 'succeeded', kind, until, card });
      }
      if (pi.status === 'requires_action' || pi.status === 'requires_confirmation') {
        return NextResponse.json({ status: 'requires_action', clientSecret: pi.client_secret, paymentIntentId: pi.id, kind });
      }
      await recordListingFailure({ uid: session.uid, propertyId, kind, cents, pi, card, reason: pi.status });
      return NextResponse.json({ status: 'failed', error: 'El pago no se completó.' });
    } catch (e) {
      const pi = e?.raw?.payment_intent || e?.payment_intent;
      if ((e?.code === 'authentication_required' || e?.raw?.code === 'authentication_required') && pi?.client_secret) {
        return NextResponse.json({ status: 'requires_action', clientSecret: pi.client_secret, paymentIntentId: pi.id, kind });
      }
      await recordListingFailure({ uid: session.uid, propertyId, kind, cents, pi, card, reason: e?.decline_code || e?.code || 'error' });
      return NextResponse.json({ status: 'failed', error: friendly(e) });
    }
  }

  try {
    const pi = await stripe.paymentIntents.create({ amount: cents, currency: 'usd', customer: customerId, setup_future_usage: 'off_session', payment_method_types: ['card'], metadata, description });
    return NextResponse.json({ status: 'requires_payment', clientSecret: pi.client_secret, paymentIntentId: pi.id, amountCents: cents, kind });
  } catch (e) {
    return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 });
  }
}
