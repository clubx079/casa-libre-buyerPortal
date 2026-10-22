// "Get the app" pop-up rules (components/AppPromo.js). Pure — test/appPromo.test.mjs.
//   · Every device (phones and computers), never inside an in-app WebView / installed web app.
//   · ONE pop-up (a big centered card, almost full screen). Every new VISIT (browser
//     session) it shows up to twice: on the home page, and on their second page.
//   · Never on flows where it would get in the way (publishing, account, payment, the app
//     page itself), nor when they arrived from one of our emails / WhatsApp buttons.
//   · After they tap Download: nothing for SNOOZE_DAYS.

export const SNOOZE_DAYS = 3;
const BLOCKED = ['/publicar', '/cuenta', '/descargar', '/eliminar-cuenta', '/r/', '/s/', '/api/'];

// In-app browsers (Android WebView '; wv)', Facebook / Instagram) and our own app: no pop-up.
export function isInAppBrowser(ua = '') {
  return /; wv\)|FBAN|FBAV|Instagram/i.test(String(ua));
}

export const allowedPath = (path = '/') => !BLOCKED.some((b) => path === b.replace(/\/$/, '') || path.startsWith(b.endsWith('/') ? b : `${b}/`));

// Arrived from our own email / WhatsApp message (utm_medium) → let them do what they came for.
export const fromOurMessage = (search = '') => /(^|[?&])utm_medium=(email|whatsapp)(&|$)/i.test(String(search));

// visit = { views, home, second } for this browser session (views already counts this page).
// → 'home' (on the home page) | 'second' (their second page) | null — the same pop-up; the
// name only says which moment it was, for tracking.
export function promoFor({ ua, path, visit, snoozedUntil = 0, now = Date.now(), standalone = false, fromMessage = false }) {
  if (isInAppBrowser(ua) || standalone || fromMessage) return null;
  if (snoozedUntil && now < snoozedUntil) return null;
  if (!allowedPath(path)) return null;
  if (path === '/' && !visit.home) return 'home';
  if (visit.views === 2 && !visit.second) return 'second';
  return null;
}
