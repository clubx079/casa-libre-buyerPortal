// POST /api/profile-pro/confirm { paymentIntentId } — after the card form (or 3-D Secure)
// succeeds in the browser. Re-reads the PaymentIntent from Stripe, checks it is this user's
// Profile Personalization payment and fully paid, then records the period
// (lib/profileProServer.js). Idempotent: a retry never applies it twice.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { getUserBillingRow, ensureStripeCustomer, saveDefaultCard } from '@/lib/billing';
import { applyProfilePayment } from '@/lib/profileProServer';
import { recordDeclineOnce } from '@/lib/paymentFailures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });
  const { paymentIntentId } = await req.json().catch(() => ({}));
  if (!paymentIntentId) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  let pi;
  try { pi = await stripe.paymentIntents.retrieve(paymentIntentId); }
  catch (e) { return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 }); }
  const md = pi?.metadata || {};
  if (md.product !== 'casa-libre-profile' || String(md.user_id) !== String(session.uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const kind = md.kind === 'profile_renew' ? 'profile_renew' : 'profile';
  if (pi.status === 'processing') return NextResponse.json({ status: 'processing' });
  if (pi.status !== 'succeeded') {
    await recordDeclineOnce(pi, { user_id: session.uid, property_id: null, kind, plan: null, amount_usd: (Number(pi.amount) || 0) / 100, currency: 'usd' }).catch(() => {});
    return NextResponse.json({ status: 'failed', error: 'El pago no se completó.' });
  }
  const user = await getUserBillingRow(session.uid);
  let card = null;
  try {
    const customerId = user?.stripe_customer_id || await ensureStripeCustomer(user);
    card = await saveDefaultCard(session.uid, customerId, typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id);
  } catch {}
  const { until, already } = await applyProfilePayment({ uid: session.uid, kind, pi, card: card || (user?.card_last4 ? { brand: user.card_brand, last4: user.card_last4 } : null) });
  return NextResponse.json({ status: 'succeeded', kind, until, already: !!already });
}
