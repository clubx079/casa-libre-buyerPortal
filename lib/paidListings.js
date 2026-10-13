// Paid listings: every account gets a number of FREE listings per calendar month (local
// time); from the next one on, publishing a listing costs money. Roland's offer: a list
// price of US$29, shown crossed out with 80% off → US$5.80, live for 90 days; after that
// "extend 30 days for US$5". Charged in US$ only — the local price is fine print.
//
// Everything is set in the admin portal (Paid listings page) and stored in the
// `automations` row 'paid_listings' — no table of its own, so no database change:
//   enabled              → the paywall is ON (off = every listing is free, as before)
//   first_tier_count     → free listings per month (e.g. 3 → the 4th of the month is paid)
//   free_days            → how many days a paid listing stays live (90)
//   later_free_days      → days an extension adds (30)
//   remind_days_before   → the "your listing ends soon" email, N days before (3)
//   milestones           → [list price in cents, discount %, extension price in cents,
//                           same-person signals needed (2 of 3)]
//   template_id          → email: "your listing ends soon — extend it"
//   reminder_template_id → email: "your listing ended — extend it to bring it back"
//   gift_template_id     → email: "we have a plan for agents" (once, on the first paid one)
// No row = the paywall is off. Pure (no I/O) — tests/paidListings.test.mjs.
import { TZ } from './scanQuota.js';

export const PAID_LISTINGS_ID = 'paid_listings';

export const DEFAULTS = Object.freeze({
  enabled: false,
  freePerMonth: 3,
  listCents: 2900,
  discountPct: 80,
  days: 90,
  extendCents: 500,
  extendDays: 30,
  remindDaysBefore: 3,
  samePersonMin: 2,
});

const int = (v, min, max, dflt) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : dflt;
};

// automations row → settings (anything missing or out of range falls back to DEFAULTS).
export function paidConfig(row) {
  if (!row) return { ...DEFAULTS };
  const m = Array.isArray(row.milestones) ? row.milestones : [];
  return {
    enabled: row.enabled === true,
    enabledAt: row.enabled_at || null,
    freePerMonth: int(row.first_tier_count, 0, 1000, DEFAULTS.freePerMonth),
    listCents: int(m[0], 0, 1000000, DEFAULTS.listCents),
    discountPct: int(m[1], 0, 100, DEFAULTS.discountPct),
    extendCents: int(m[2], 0, 1000000, DEFAULTS.extendCents),
    samePersonMin: int(m[3], 1, 3, DEFAULTS.samePersonMin),
    days: int(row.free_days, 1, 365, DEFAULTS.days),
    extendDays: int(row.later_free_days, 1, 365, DEFAULTS.extendDays),
    remindDaysBefore: int(row.remind_days_before, 1, 60, DEFAULTS.remindDaysBefore),
    endingTemplateId: row.template_id || null,
    endedTemplateId: row.reminder_template_id || null,
    agentTemplateId: row.gift_template_id || null,
  };
}

// What the seller pays for one extra listing, in cents: list price minus the discount.
export const priceCents = (cfg) => Math.round((cfg.listCents * (100 - cfg.discountPct)) / 100);

// 580 → "US$5.80", 500 → "US$5", 2900 → "US$29"
export const usd = (cents) => {
  const v = Number(cents) / 100;
  return `US$${Number.isInteger(v) ? v : v.toFixed(2)}`;
};

// First day of the current month at local midnight in the country, as an ISO instant.
export function monthStartIso(countryCode = 'py', now = new Date()) {
  const tz = TZ[countryCode] || TZ.py;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((x) => [x.type, x.value]));
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+p.year, +p.month - 1, 1) - offset).toISOString();
}

// The paid-listing record kept on the listing (properties.raw_data.paid_listing).
export const paidInfo = (p) => (p?.raw_data && typeof p.raw_data.paid_listing === 'object' ? p.raw_data.paid_listing : null);

// A free listing of this month = created since the month started and not paid for.
export function countFreeThisMonth(listings = [], monthStart) {
  return listings.filter((p) => String(p.created_at || '') >= monthStart && !paidInfo(p)).length;
}

// The decision for the NEXT listing: free while the month still has free ones left.
//   freeUsed = free listings this month (this account + accounts we think are the same person)
export function decide(cfg, freeUsed) {
  const used = Math.max(0, Number(freeUsed) || 0);
  if (!cfg.enabled) return { paymentRequired: false, freeUsed: used, freeLeft: null };
  const freeLeft = Math.max(0, cfg.freePerMonth - used);
  return { paymentRequired: freeLeft === 0, freeUsed: used, freeLeft };
}

// The window a payment buys. Publishing: now + days. Extending: from whatever is left
// (or from now, once it has ended) + extendDays.
export function paidWindow(kind, cfg, current, now = new Date()) {
  if (kind === 'extend') {
    const base = current?.until && new Date(current.until) > now ? new Date(current.until) : now;
    return new Date(base.getTime() + cfg.extendDays * 86400000).toISOString();
  }
  return new Date(now.getTime() + cfg.days * 86400000).toISOString();
}

export const chargeCents = (kind, cfg) => (kind === 'extend' ? cfg.extendCents : priceCents(cfg));
