// POST /api/highlight/confirm — called after the client confirms the Payment
// Element (new-card path) or completes 3-D Secure. The server re-reads the
// PaymentIntent straight from Stripe (never trusts the client), and only then
// grants the promotion, vaults the card, and records the transaction.
// Idempotent: a retried confirm never double-grants or double-charges.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { select } from '@/lib/db';
import { stripe, promoPlan, promoUsd } from '@/lib/stripe';
import { getUserBillingRow, ensureStripeCustomer, grantPromotion, saveDefaultCard, recordPayment, paymentAlreadyRecorded } from '@/lib/billing';

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

  // Security: the PaymentIntent must belong to THIS user and THIS property.
  if (String(pi?.metadata?.user_id) !== String(session.uid) || String(pi?.metadata?.property_id) !== String(propertyId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const rows = await select('properties', `select=id,created_by,promotion_plan,promotion_expires_at&id=eq.${encodeURIComponent(propertyId)}&limit=1`).catch(() => []);
  const prop = Array.isArray(rows) && rows[0];
  if (!prop || String(prop.created_by) !== String(session.uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  // Renew/upgrade of an already-promoted listing stacks onto the time left.
  const extendFrom = prop.promotion_plan && prop.promotion_expires_at ? prop.promotion_expires_at : null;

  if (pi.status === 'processing') return NextResponse.json({ status: 'processing' });
  if (pi.status !== 'succeeded') return NextResponse.json({ status: 'failed', error: 'El pago no se completó.' });

  // The plan the charge was created for (falls back to verified for old intents).
  const plan = promoPlan(pi?.metadata?.plan);

  // Idempotency — already granted for this PaymentIntent?
  const already = await paymentAlreadyRecorded(pi.id);
  if (already) return NextResponse.json({ status: 'succeeded', plan, promotionUntil: already.highlight_until, already: true });

  const until = await grantPromotion(propertyId, plan, { extendFrom });
  const user = await getUserBillingRow(session.uid);
  let customerId = user?.stripe_customer_id;
  try { if (!customerId) customerId = await ensureStripeCustomer(user); } catch {}
  let card = null;
  try { card = await saveDefaultCard(session.uid, customerId, typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id); } catch {}
  await recordPayment({
    user_id: session.uid, property_id: propertyId, kind: 'highlight', plan,
    amount_usd: promoUsd(plan), currency: 'usd', status: 'succeeded',
    stripe_payment_intent_id: pi.id,
    card_brand: card?.brand || user?.card_brand || null,
    card_last4: card?.last4 || user?.card_last4 || null,
    highlight_until: until,
  });
  try { revalidateTag('listings'); } catch {}
  return NextResponse.json({ status: 'succeeded', plan, promotionUntil: until, card: card ? { brand: card.brand, last4: card.last4 } : null });
}
