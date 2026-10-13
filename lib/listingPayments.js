// Server side of paid listings (lib/paidListings.js): charge the seller for a listing
// over the free monthly quota ('publish') or for 30 more days ('extend'), and apply it.
//   publish — the listing was saved as 'payment_pending' (not on the site). Once paid,
//             the AI photo check runs as for any listing and puts it live; it stays
//             live for `days` (90) from the payment.
//   extend  — adds `extendDays` (30) to what is left, or from today when it already
//             ended; an ended listing goes straight back on the site.
// The record lives on the listing (raw_data.paid_listing) and every charge is a
// `payments` row (kind 'listing' | 'listing_extend', highlight_until = the new end).
import 'server-only';
import { revalidateTag } from 'next/cache';
import { select, update } from './db';
import { stripe } from './stripe';
import { getUserBillingRow, ensureStripeCustomer, recordPayment, saveDefaultCard, paymentAlreadyRecorded } from './billing';
import { loadPaidConfig } from './listingQuota';
import { chargeCents, paidInfo, paidWindow } from './paidListings';
import { startListingScan } from './listingScan';
import { SCAN_STATUS } from './scanVerdict';

export const LISTING_STATUS = { pending: 'payment_pending', expired: 'expired' };
const COLS = 'id,created_by,status,admin_status,raw_data,is_complete';
const enc = encodeURIComponent;

async function loadListing(id) {
  const [p] = await select('properties', `select=${COLS}&id=eq.${enc(id)}&limit=1`).catch(() => []);
  return p || null;
}

// Can this user pay `kind` for this listing? → { ok, prop, cfg, cents } | { error, status }
export async function checkPayable(uid, propertyId, kind) {
  if (!stripe) return { error: 'stripe_not_configured', status: 500 };
  const prop = await loadListing(propertyId);
  if (!prop) return { error: 'not_found', status: 404 };
  if (String(prop.created_by) !== String(uid)) return { error: 'forbidden', status: 403 };
  const cfg = await loadPaidConfig(select);
  const info = paidInfo(prop);
  if (kind === 'publish' && prop.status !== LISTING_STATUS.pending) return { error: 'not_pending', status: 400 };
  if (kind === 'extend' && !info?.until) return { error: 'not_paid_listing', status: 400 };
  return { ok: true, prop, cfg, cents: chargeCents(kind, cfg) };
}

// After a succeeded charge: update the listing + record the payment. Idempotent per
// PaymentIntent. → { until }
export async function applyListingPayment({ uid, propertyId, kind, pi, card }) {
  const done = await paymentAlreadyRecorded(pi.id);
  if (done) return { until: done.highlight_until, already: true };
  const prop = await loadListing(propertyId);
  const cfg = await loadPaidConfig(select);
  const now = new Date();
  const info = paidInfo(prop) || {};
  const until = paidWindow(kind, cfg, info, now);
  const record = { ...info, state: 'active', until, last_payment_at: now.toISOString(), reminded_for: null, ...(kind === 'publish' ? { paid_at: now.toISOString() } : {}) };
  const raw = { ...(prop?.raw_data || {}), paid_listing: record };

  if (kind === 'publish') {
    // Paid → the photo check takes over (it publishes, or rejects bad photos).
    await update('properties', `id=eq.${enc(propertyId)}&status=eq.${LISTING_STATUS.pending}`, {
      status: SCAN_STATUS.scanning,
      raw_data: { ...raw, moderation: { ...(raw.moderation || {}), state: 'scanning', started_at: now.toISOString() } },
    }, { returning: 'minimal' });
    startListingScan(propertyId);
  } else {
    const back = prop?.status === LISTING_STATUS.expired;
    await update('properties', `id=eq.${enc(propertyId)}`, {
      raw_data: raw,
      ...(back ? { status: SCAN_STATUS.published, admin_status: 'active' } : {}),
    }, { returning: 'minimal' });
    if (back) { try { revalidateTag('listings'); } catch {} }
  }
  await recordPayment({
    user_id: uid, property_id: propertyId, kind: kind === 'extend' ? 'listing_extend' : 'listing', plan: null,
    amount_usd: Math.round(Number(pi.amount_received || pi.amount || chargeCents(kind, cfg))) / 100, currency: 'usd', status: 'succeeded',
    stripe_payment_intent_id: pi.id, card_brand: card?.brand || null, card_last4: card?.last4 || null, highlight_until: until,
  });
  return { until };
}

export async function recordListingFailure({ uid, propertyId, kind, cents, pi, card, reason }) {
  await recordPayment({
    user_id: uid, property_id: propertyId, kind: kind === 'extend' ? 'listing_extend' : 'listing', plan: null,
    amount_usd: cents / 100, currency: 'usd', status: 'failed', stripe_payment_intent_id: pi?.id || null,
    card_brand: card?.brand || null, card_last4: card?.last4 || null, failure_reason: String(reason || 'error').slice(0, 200),
  });
}

export { getUserBillingRow, ensureStripeCustomer, saveDefaultCard };
