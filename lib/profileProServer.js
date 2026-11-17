// Server side of the Profile Personalization pricing (lib/profilePro.js): read the admin
// settings, a seller's periods, and grant / charge a period. Reuses the paid-listings
// Stripe pieces (lib/billing.js) — one `payments` row per period, no listing.
import 'server-only';
import { select, selectWithCount } from './db';
import { recordPayment, paymentAlreadyRecorded } from './billing';
import { PROFILE_PRO_ID, PROFILE_KINDS, profileProConfig, profileStatus, nextPeriod, periodUntil } from './profilePro';

const enc = encodeURIComponent;
const KINDS = `in.(${PROFILE_KINDS.join(',')})`;

// The settings, kept 30 s per server process (read on every listing page with a seller card).
let memo = { at: 0, cfg: null };
export function invalidateProfileProConfig() { memo = { at: 0, cfg: null }; }
export async function loadProfileProConfig() {
  if (memo.cfg && Date.now() - memo.at < 30_000) return memo.cfg;
  let cfg;
  try {
    const [row] = await select('automations', `select=*&id=eq.${PROFILE_PRO_ID}&limit=1`);
    cfg = profileProConfig(row || null);
  } catch { cfg = profileProConfig(null); }   // no row / DB blip → OFF = free for everyone
  memo = { at: Date.now(), cfg };
  return cfg;
}

export async function loadProfileStatus(uid, now = new Date()) {
  if (!uid) return profileStatus([], now);
  const rows = await select('payments', `select=kind,status,highlight_until&user_id=eq.${enc(uid)}&kind=${KINDS}&status=eq.succeeded&limit=500`).catch(() => []);
  return profileStatus(rows, now);
}

// People who already took a first-N free period in this country.
export async function firstFreeUsed() {
  const { count } = await selectWithCount('payments', 'select=id&kind=eq.profile_free&status=eq.succeeded&amount_usd=eq.0&limit=1').catch(() => ({ count: 0 }));
  return Number(count) || 0;
}

// Everything the Settings page needs. → { cfg, status, next: { kind, cents }, freeLeft }
export async function profileOffer(uid, now = new Date()) {
  const cfg = await loadProfileProConfig();
  if (!cfg.enabled) return { cfg, status: null, next: null, freeLeft: null };
  const [status, used] = await Promise.all([loadProfileStatus(uid, now), cfg.firstFree > 0 ? firstFreeUsed() : 0]);
  return { cfg, status, next: nextPeriod(cfg, status, used), freeLeft: cfg.firstFree > 0 ? Math.max(0, cfg.firstFree - used) : null };
}

// A period that costs nothing (first-N, a US$0 price or a US$0 renewal): recorded straight
// away, no Stripe. kind 'profile_free' (first period) | 'profile_renew'. → { until }
export async function grantFreePeriod(uid, kind = 'profile_free', now = new Date()) {
  const cfg = await loadProfileProConfig();
  const status = await loadProfileStatus(uid, now);
  const until = periodUntil(cfg, status, now);
  await recordPayment({ user_id: uid, property_id: null, kind: kind === 'profile_renew' ? 'profile_renew' : 'profile_free', plan: null, amount_usd: 0, currency: 'usd', status: 'succeeded', highlight_until: until });
  return { until };
}

// After a succeeded Stripe charge. Idempotent per PaymentIntent. → { until, already? }
export async function applyProfilePayment({ uid, kind, pi, card, now = new Date() }) {
  const done = await paymentAlreadyRecorded(pi.id);
  if (done) return { until: done.highlight_until, already: true };
  const cfg = await loadProfileProConfig();
  const status = await loadProfileStatus(uid, now);
  const until = periodUntil(cfg, status, now);
  await recordPayment({
    user_id: uid, property_id: null, kind: kind === 'profile_renew' ? 'profile_renew' : 'profile', plan: null,
    amount_usd: Math.round(Number(pi.amount_received || pi.amount || 0)) / 100, currency: 'usd', status: 'succeeded',
    stripe_payment_intent_id: pi.id, card_brand: card?.brand || null, card_last4: card?.last4 || null, highlight_until: until,
  });
  return { until };
}

export async function recordProfileFailure({ uid, kind, cents, pi, card, reason }) {
  await recordPayment({
    user_id: uid, property_id: null, kind, plan: null, amount_usd: cents / 100, currency: 'usd', status: 'failed',
    stripe_payment_intent_id: pi?.id || null, card_brand: card?.brand || null, card_last4: card?.last4 || null, failure_reason: String(reason || 'error').slice(0, 200),
  });
}

// Seller id → do their professional details show? (lib/sellerPhotos.js). OFF → always.
export async function sellerShowsProDetails(uid) {
  const cfg = await loadProfileProConfig();
  if (!cfg.enabled) return true;
  return (await loadProfileStatus(uid)).active;
}
