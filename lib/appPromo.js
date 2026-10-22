// "Get the app" pop-up rules (components/AppPromo.js). Pure — test/appPromo.test.js.
//   · Android phones only (iPhone app not out yet), never inside a WebView / installed web app.
//   · Every new VISIT (browser session) it can show again:
//       - the page they land on, and the home page: a SMALL card (not full screen — Google
//         penalizes full-screen pop-ups on the page someone arrives on from a search);
//       - from their second page on: the FULL-SCREEN version, once per visit.
//   · Never on flows where it would get in the way (publishing, account, payment, the app
//     page itself), nor when they arrived from one of our emails / WhatsApp buttons.
//   · After they tap Download: nothing for SNOOZE_DAYS.

export const SNOOZE_DAYS = 3;
const BLOCKED = ['/publicar', '/cuenta', '/descargar', '/eliminar-cuenta', '/r/', '/s/', '/api/'];

export function isAndroidPhone(ua = '') {
  const s = String(ua);
  if (!/Android/i.test(s)) return false;
  if (/; wv\)/.test(s)) return false;  // Android WebView (in-app browsers, our own app)
  return /Mobile/i.test(s);            // Android tablets have no "Mobile" — skip them
}

export const allowedPath = (path = '/') => !BLOCKED.some((b) => path === b.replace(/\/$/, '') || path.startsWith(b.endsWith('/') ? b : `${b}/`));

// Arrived from our own email / WhatsApp message (utm_medium) → let them do what they came for.
export const fromOurMessage = (search = '') => /(^|[?&])utm_medium=(email|whatsapp)(&|$)/i.test(String(search));

// visit = { views, banner, full } for this browser session (views already counts this page).
// → 'banner' | 'full' | null
export function promoFor({ ua, path, visit, snoozedUntil = 0, now = Date.now(), standalone = false, fromMessage = false }) {
  if (!isAndroidPhone(ua) || standalone || fromMessage) return null;
  if (snoozedUntil && now < snoozedUntil) return null;
  if (!allowedPath(path)) return null;
  const home = path === '/';
  if (!home && visit.views >= 2 && !visit.full) return 'full';
  if ((home || visit.views === 1) && !visit.banner) return 'banner';
  return null;
}
