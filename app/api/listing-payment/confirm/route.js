// POST /api/listing-payment/confirm { propertyId, paymentIntentId } — after the card
// form (or 3-D Secure) succeeds in the browser. Re-reads the PaymentIntent from Stripe,
// checks it is this user's, for this listing, a listing payment and fully paid, then
// applies it (lib/listingPayments.js). Idempotent: a retry never applies it twice.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { applyListingPayment, getUserBillingRow, ensureStripeCustomer, saveDefaultCard } from '@/lib/listingPayments';
import { recordDeclineOnce } from '@/lib/paymentFailures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });
  const { propertyId, paymentIntentId } = await req.json().catch(() => ({}));
  if (!propertyId || !paymentIntentId) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  let pi;
  try { pi = await stripe.paymentIntents.retrieve(paymentIntentId); }
  catch (e) { return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 }); }
  const md = pi?.metadata || {};
  if (md.product !== 'casa-libre-listing' || String(md.user_id) !== String(session.uid) || String(md.property_id) !== String(propertyId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (pi.status === 'processing') return NextResponse.json({ status: 'processing' });
  if (pi.status !== 'succeeded') {
    // A card declined in the browser → recorded as a failed attempt (admin Earnings).
    const kind = md.kind === 'extend' ? 'listing_extend' : 'listing';
    await recordDeclineOnce(pi, { user_id: session.uid, property_id: propertyId, kind, plan: null, amount_usd: (Number(pi.amount) || 0) / 100, currency: 'usd' }).catch(() => {});
    return NextResponse.json({ status: 'failed', error: 'El pago no se completó.' });
  }

  const user = await getUserBillingRow(session.uid);
  let card = null;
  try {
    const customerId = user?.stripe_customer_id || await ensureStripeCustomer(user);
    card = await saveDefaultCard(session.uid, customerId, typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id);
  } catch {}
  const kind = md.kind === 'extend' ? 'extend' : 'publish';
  const { until, already } = await applyListingPayment({ uid: session.uid, propertyId, kind, pi, card: card || (user?.card_last4 ? { brand: user.card_brand, last4: user.card_last4 } : null) });
  return NextResponse.json({ status: 'succeeded', kind, until, already: !!already });
}
