// Is the next listing free or paid? (lib/paidListings.js has the rules.)
// Free listings used this month = the larger of
//   • this person's listings created this month that weren't paid for, and
//   • the free-listing ledger (payments rows kind 'listing_free', one per free publish —
//     so deleting a free listing doesn't give the free slot back),
// where "this person" = the account + any account that looks like the same person
// (lib/samePerson.js). DB injected (select) — tests/listingQuota.test.mjs.
import { paidConfig, decide, monthStartIso, countFreeThisMonth, priceCents, PAID_LISTINGS_ID } from './paidListings.js';
import { linkedAccounts } from './samePerson.js';

const LOOKBACK_DAYS = 180;
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ''));
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;

export async function loadPaidConfig(select) {
  try {
    const [row] = await select('automations', `select=*&id=eq.${PAID_LISTINGS_ID}&limit=1`);
    return paidConfig(row || null);
  } catch { return paidConfig(null); }
}

// → { cfg, enabled, paymentRequired, freePerMonth, freeUsed, freeLeft, linked, priceCents, … }
export async function listingQuota({ select, selectWithCount }, { uid, signals = {}, countryCode = 'py', now = new Date(), cfg: given } = {}) {
  const cfg = given || await loadPaidConfig(select);
  const base = { cfg, enabled: cfg.enabled, freePerMonth: cfg.freePerMonth, priceCents: priceCents(cfg), listCents: cfg.listCents, discountPct: cfg.discountPct, days: cfg.days, extendCents: cfg.extendCents, extendDays: cfg.extendDays };
  if (!cfg.enabled || !isUuid(uid)) return { ...base, paymentRequired: false, freeUsed: 0, freeLeft: null, linked: [] };

  const monthStart = monthStartIso(countryCode, now);
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86400000).toISOString();
  const recent = await select('properties', `select=id,created_by,created_at,status,raw_data&origin=eq.user&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=5000`).catch(() => []);
  const linked = linkedAccounts(uid, signals, recent, cfg.samePersonMin);
  const people = [String(uid), ...linked.map((l) => l.userId)];
  const mine = recent.filter((p) => people.includes(String(p.created_by)));
  const fromListings = countFreeThisMonth(mine, monthStart);
  let fromLedger = 0;
  try {
    const { count } = await selectWithCount('payments', `select=id&kind=eq.listing_free&user_id=${inList(people)}&created_at=gte.${encodeURIComponent(monthStart)}&limit=1`);
    fromLedger = Number(count) || 0;
  } catch { fromLedger = 0; }
  const d = decide(cfg, Math.max(fromListings, fromLedger));
  return { ...base, ...d, monthStart, linked };
}
