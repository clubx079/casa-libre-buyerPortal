// /descargar on a phone → that phone's store (iPhone / iPad → App Store, Android → Google Play);
// anything else (a computer) → null, and the page with both badges shows. Pure —
// tests/appStoreFor.test.mjs.
import { APP_STORE_URL, PLAY_STORE_URL } from './appLinks.js';

export function storeForUserAgent(ua) {
  const s = String(ua || '');
  if (/iPhone|iPad|iPod/i.test(s)) return APP_STORE_URL;
  if (/Android/i.test(s)) return PLAY_STORE_URL;
  return null;
}
