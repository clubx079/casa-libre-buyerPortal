// Manage the user's saved (vaulted) card from the account payments page.
//   POST  → create a Stripe SetupIntent (collect + vault a card WITHOUT charging).
//   PUT   → after the client confirms it, save the new card as the default.
// Requires login. Server is authoritative — verifies the SetupIntent belongs to the
// user's own Stripe customer before saving.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { getUserBillingRow, ensureStripeCustomer, saveDefaultCard } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });
  const user = await getUserBillingRow(session.uid);
  if (!user) return NextResponse.json({ error: 'no_user' }, { status: 400 });
  let customerId;
  try { customerId = await ensureStripeCustomer(user); }
  catch (e) { return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 }); }
  try {
    const si = await stripe.setupIntents.create({ customer: customerId, payment_method_types: ['card'], usage: 'off_session' });
    return NextResponse.json({ clientSecret: si.client_secret, setupIntentId: si.id });
  } catch (e) {
    return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 });
  }
}

export async function PUT(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });
  const { setupIntentId } = await req.json().catch(() => ({}));
  if (!setupIntentId) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  let si;
  try { si = await stripe.setupIntents.retrieve(setupIntentId); }
  catch (e) { return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 }); }

  const user = await getUserBillingRow(session.uid);
  const customerId = user?.stripe_customer_id;
  if (!customerId || String(si.customer) !== String(customerId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (si.status !== 'succeeded') return NextResponse.json({ status: si.status || 'failed' });

  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
  let card = null;
  try { card = await saveDefaultCard(session.uid, customerId, pmId); } catch {}
  return NextResponse.json({ ok: true, status: 'succeeded', card });
}
