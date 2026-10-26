// Where a person came from, saved on their account when they sign up (users.attribution) —
// the Admin Manager found it empty for every sign-up, so "which ads / emails bring
// accounts" could not be answered. Two halves:
//   firstTouch(location, referrer) — browser: the first visit's source, kept 90 days in the
//     cl_ft cookie (only set once; a later visit never overwrites it);
//   attributionFromCookie / isNewAccount — server: at sign-in, a NEW account (created in the
//     last 30 min) gets that source written once (lib/auth.js saveSignupAttribution).
// Pure, except readers of document / cookies in the callers.
export const FIRST_TOUCH_COOKIE = 'cl_ft';
export const FIRST_TOUCH_DAYS = 90;
const NEW_ACCOUNT_MS = 30 * 60 * 1000;

const cut = (v, n = 120) => (v == null || v === '' ? null : String(v).slice(0, n));

// url: the landing URL; referrer: document.referrer; ownHost: our site's host.
export function firstTouch(url, referrer = '', ownHost = '', now = new Date()) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const q = u.searchParams;
  let refHost = null;
  try { refHost = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : null; } catch { refHost = null; }
  if (refHost && ownHost && refHost === ownHost.replace(/^www\./, '')) refHost = null;   // our own page
  const gclid = q.get('gclid') || q.get('gbraid') || q.get('wbraid');
  const source = q.get('utm_source') || (gclid ? 'google' : null) || refHost || 'direct';
  const medium = q.get('utm_medium') || (gclid ? 'cpc' : refHost ? 'referral' : 'none');
  return {
    source: cut(source, 80),
    medium: cut(medium, 40),
    campaign: cut(q.get('utm_campaign')),
    content: cut(q.get('utm_content')),
    ads_click: !!gclid,
    referrer: cut(refHost, 120),
    landing: cut(u.pathname, 200),
    at: now.toISOString(),
  };
}

export function attributionFromCookie(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return v && typeof v === 'object' && v.source ? v : null;
  } catch { return null; }
}

export const isNewAccount = (user, now = Date.now()) => {
  const t = Date.parse(user?.created_at);
  return Number.isFinite(t) && now - t <= NEW_ACCOUNT_MS;
};
