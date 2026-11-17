// Profile Personalization pricing ("Perfil profesional" as a paid feature). Pure — no I/O,
// unit-tested in tests/profilePro.test.mjs. Same pattern as paid listings (lib/paidListings.js):
// everything is set in the admin (Profile personalization page) and stored in the
// `automations` row 'profile_pro' — no table of its own, no database change:
//   enabled            → the "paid" switch. OFF (or no row) = free for everyone, exactly as
//                        before: every saved professional profile shows on the listings.
//   free_days          → how long one period lasts (days) before it expires (30, 60, …)
//   milestones         → [price in cents (first period; 0 = the first period is free),
//                         renewal price in cents (each period after one expired or ran),
//                         first N people free (their first period costs nothing; 0 = none)]
// While ON, a seller's job title / company / website show on their listings only during an
// active period; after it expires they are hidden (name + photo keep showing) until renewed.
// Every period is a `payments` row with no listing: kind 'profile' (first, paid),
// 'profile_free' (first, free — first-N or price 0), 'profile_renew' (renewal);
// highlight_until = when that period ends.

export const PROFILE_PRO_ID = 'profile_pro';
export const PROFILE_KINDS = ['profile', 'profile_free', 'profile_renew'];

export const DEFAULTS = Object.freeze({
  enabled: false,
  priceCents: 1000,     // US$10 for the first period
  renewCents: 1000,     // US$10 per renewal
  days: 30,
  firstFree: 100,       // the owner's idea: the first 100 realtors free
});

const int = (v, min, max, dflt) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : dflt;
};

// automations row → settings (anything missing or out of range falls back to DEFAULTS).
export function profileProConfig(row) {
  if (!row) return { ...DEFAULTS };
  const m = Array.isArray(row.milestones) ? row.milestones : [];
  return {
    enabled: row.enabled === true,
    enabledAt: row.enabled_at || null,
    priceCents: int(m[0], 0, 1000000, DEFAULTS.priceCents),
    renewCents: int(m[1], 0, 1000000, DEFAULTS.renewCents),
    firstFree: int(m[2], 0, 1000000, DEFAULTS.firstFree),
    days: int(row.free_days, 1, 3650, DEFAULTS.days),
  };
}

// 580 → "US$5.80", 500 → "US$5", 0 → "US$0"
export const usd = (cents) => {
  const v = Number(cents) / 100;
  return `US$${Number.isInteger(v) ? v : v.toFixed(2)}`;
};

const isProfilePayment = (p) => p && PROFILE_KINDS.includes(p.kind) && p.status === 'succeeded';

// A seller's profile periods (their payments rows) → where they stand.
//   { active, until, expired, ever }  — expired = had a period and it is over.
export function profileStatus(payments = [], now = new Date()) {
  const mine = payments.filter(isProfilePayment);
  const until = mine.map((p) => p.highlight_until).filter(Boolean).sort().pop() || null;
  const active = !!until && new Date(until) > now;
  return { active, until, expired: !!until && !active, ever: mine.length > 0 };
}

// What the seller's next period costs. firstFreeUsed = how many people already took a
// first-N free period in this country.
//   → { kind: 'profile' | 'profile_free' | 'profile_renew', cents }
export function nextPeriod(cfg, status, firstFreeUsed = 0) {
  if (status?.ever) return { kind: 'profile_renew', cents: cfg.renewCents };
  if (cfg.priceCents === 0 || (cfg.firstFree > 0 && firstFreeUsed < cfg.firstFree)) return { kind: 'profile_free', cents: 0 };
  return { kind: 'profile', cents: cfg.priceCents };
}

// The end of the period a payment buys: from what is left of the current one (renewing
// early never loses days), or from now.
export function periodUntil(cfg, status, now = new Date()) {
  const base = status?.active && status.until ? new Date(status.until) : now;
  return new Date(base.getTime() + cfg.days * 86400000).toISOString();
}

// Do the seller's professional details (title, company, website) show on their listings?
// Paid switch OFF → always (today's behaviour). ON → only during an active period.
export const showsProDetails = (cfg, status) => !cfg?.enabled || !!status?.active;

// The professional profile for the listings with the paid-only details removed when hidden.
export function gateProfile(profile, show) {
  if (!profile || show) return profile;
  if (!profile.name) return null;
  return { ...profile, title: null, company: null, website: null, website_label: null };
}

// The same for seller_info (the "Sobre el vendedor" details sent with the listing — website
// page payload and /api/mobile/listing): member since / WhatsApp / listings stay.
export function gateInfo(info, show) {
  if (!info || show) return info;
  return { ...info, title: null, company: null, website: null, website_label: null };
}
