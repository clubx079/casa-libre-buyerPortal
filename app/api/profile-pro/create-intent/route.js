// POST /api/profile-pro/create-intent { useSavedCard } — start (or renew) the seller's
// Profile Personalization period while the admin's paid switch is ON (lib/profilePro.js).
// A period that costs nothing (first N people free, a US$0 price) is granted at once.
// Otherwise the same two paths as paid listings (/api/listing-payment/create-intent):
// one click on the saved card, or a PaymentIntent the client confirms with the card form
// (then /api/profile-pro/confirm). The price always comes from the admin settings.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { getUserBillingRow, ensureStripeCustomer, recordCheckoutStarted } from '@/lib/billing';
import { profileOffer, grantFreePeriod, applyProfilePayment, recordProfileFailure } from '@/lib/profileProServer';

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
  const { cfg, next } = await profileOffer(session.uid);
  if (!cfg.enabled) return NextResponse.json({ error: 'not_enabled' }, { status: 400 });
  const { kind, cents } = next;

  if (cents === 0) {
    const { until } = await grantFreePeriod(session.uid, kind);
    return NextResponse.json({ status: 'succeeded', kind, until, free: true });
  }
  if (!stripe) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });

  const user = await getUserBillingRow(session.uid);
  if (!user) return NextResponse.json({ error: 'no_user' }, { status: 400 });
  let customerId;
  try { customerId = await ensureStripeCustomer(user); }
  catch (e) { return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 }); }

  const metadata = { user_id: String(session.uid), product: 'casa-libre-profile', kind };
  const description = kind === 'profile_renew' ? 'Casa-Libre — renovar perfil profesional' : 'Casa-Libre — perfil profesional';
  const card = user.card_last4 ? { brand: user.card_brand, last4: user.card_last4 } : null;
  const started = (pi) => recordCheckoutStarted({ userId: session.uid, propertyId: null, kind, amountUsd: cents / 100, pi });

  if (body.useSavedCard && user.card_pm_id) {
    try {
      const pi = await stripe.paymentIntents.create({ amount: cents, currency: 'usd', customer: customerId, payment_method: user.card_pm_id, off_session: true, confirm: true, metadata, description });
      if (pi.status === 'succeeded') {
        const { until } = await applyProfilePayment({ uid: session.uid, kind, pi, card });
        return NextResponse.json({ status: 'succeeded', kind, until, card });
      }
      if (pi.status === 'requires_action' || pi.status === 'requires_confirmation') {
        await started(pi);
        return NextResponse.json({ status: 'requires_action', clientSecret: pi.client_secret, paymentIntentId: pi.id, kind });
      }
      await recordProfileFailure({ uid: session.uid, kind, cents, pi, card, reason: pi.status });
      return NextResponse.json({ status: 'failed', error: 'El pago no se completó.' });
    } catch (e) {
      const pi = e?.raw?.payment_intent || e?.payment_intent;
      if ((e?.code === 'authentication_required' || e?.raw?.code === 'authentication_required') && pi?.client_secret) {
        await started(pi);
        return NextResponse.json({ status: 'requires_action', clientSecret: pi.client_secret, paymentIntentId: pi.id, kind });
      }
      await recordProfileFailure({ uid: session.uid, kind, cents, pi, card, reason: e?.decline_code || e?.code || 'error' });
      return NextResponse.json({ status: 'failed', error: friendly(e) });
    }
  }

  try {
    const pi = await stripe.paymentIntents.create({ amount: cents, currency: 'usd', customer: customerId, setup_future_usage: 'off_session', payment_method_types: ['card'], metadata, description });
    await started(pi);
    return NextResponse.json({ status: 'requires_payment', clientSecret: pi.client_secret, paymentIntentId: pi.id, amountCents: cents, kind });
  } catch (e) {
    return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 });
  }
}
