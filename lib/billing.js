// Server-side billing helpers for the "Destacar" (highlight) feature: Stripe
// customer + saved-card management, granting the 30-day highlight, and the
// payments (transaction-history) table. Server-only — uses the AiroBase secret key.
import 'server-only';
import { select, insert, update } from './db';
import { stripe, HIGHLIGHT_DAYS } from './stripe';

// The user's billing-relevant columns (Stripe customer + vaulted default card).
export async function getUserBillingRow(userId) {
  if (!userId) return null;
  const rows = await select(
    'users',
    `select=id,email,full_name,stripe_customer_id,card_brand,card_last4,card_exp_month,card_exp_year,card_pm_id&id=eq.${encodeURIComponent(userId)}&limit=1`
  ).catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

// Get-or-create the user's Stripe Customer; persists the id on first create so
// every future highlight reuses the same customer (and its saved cards).
export async function ensureStripeCustomer(user) {
  if (user?.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: user?.email || undefined,
    name: user?.full_name || undefined,
    metadata: { user_id: String(user?.id || '') },
  });
  try { await update('users', `id=eq.${encodeURIComponent(user.id)}`, { stripe_customer_id: customer.id }, { returning: 'minimal' }); } catch {}
  return customer.id;
}

// After a successful charge, vault the card as the customer's default PM and store
// the display fields (brand/last4/exp) on the user for the dashboard + one-click reuse.
export async function saveDefaultCard(userId, customerId, paymentMethodId) {
  if (!paymentMethodId) return null;
  let card = null;
  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    card = pm?.card || null;
    if (customerId) await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
  } catch {}
  const patch = { card_pm_id: paymentMethodId };
  if (card) { patch.card_brand = card.brand || null; patch.card_last4 = card.last4 || null; patch.card_exp_month = card.exp_month || null; patch.card_exp_year = card.exp_year || null; }
  try { await update('users', `id=eq.${encodeURIComponent(userId)}`, patch, { returning: 'minimal' }); } catch {}
  return card ? { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year } : null;
}

// Grant / extend a 30-day highlight on a property. Returns the new expiry (ISO).
export async function grantHighlight(propertyId) {
  const now = new Date();
  const until = new Date(now.getTime() + HIGHLIGHT_DAYS * 24 * 60 * 60 * 1000);
  await update(
    'properties',
    `id=eq.${encodeURIComponent(propertyId)}`,
    { is_highlighted: true, highlighted_at: now.toISOString(), highlighted_until: until.toISOString() },
    { returning: 'minimal' }
  );
  return until.toISOString();
}

// Record one payment attempt (success OR failure) — the transaction history.
export async function recordPayment(row) {
  try { await insert('payments', row, { returning: 'minimal' }); } catch {}
}

// Idempotency for /confirm: has this PaymentIntent already been granted?
export async function paymentAlreadyRecorded(paymentIntentId) {
  if (!paymentIntentId) return null;
  const rows = await select(
    'payments',
    `select=id,highlight_until&status=eq.succeeded&stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&limit=1`
  ).catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// Dashboard payload: the saved card + transaction history (property embedded via
// the FK). Resilient — if the embed isn't available it falls back to plain rows.
export async function getUserBilling(userId) {
  const user = await getUserBillingRow(userId);
  const card = user && user.card_last4
    ? { brand: user.card_brand, last4: user.card_last4, exp_month: user.card_exp_month, exp_year: user.card_exp_year }
    : null;
  const base = `user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=100`;
  const cols = 'id,property_id,amount_usd,currency,status,failure_reason,highlight_until,created_at';
  let payments = await select('payments', `select=${cols},property:properties(slug,property_type,neighborhood,city)&${base}`).catch(() => null);
  if (!Array.isArray(payments)) payments = await select('payments', `select=${cols}&${base}`).catch(() => []);
  return { card, payments: Array.isArray(payments) ? payments : [] };
}
