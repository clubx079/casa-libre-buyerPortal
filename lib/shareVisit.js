// Browser side of share attribution: a visit that arrived through a listing's share link
// (/l/<code> → ?utm_medium=share&utm_source=<channel name>) is remembered for that listing
// for 30 days, so the contact events on the listing (WhatsApp / call) carry
// `share_channel` and the owner's "Tu link trajo … contactos" counts them (lib/shareStats.js).
import { CHANNEL_NAMES } from './shareLinks.js';

const KEY = 'cl-share-visits';
const TTL = 30 * 86400000;
const BY_NAME = Object.fromEntries(Object.entries(CHANNEL_NAMES).map(([k, v]) => [v, k]));

// The channel from a landing URL's query, or null. Pure.
export function shareChannelFromQuery(search) {
  try {
    const q = new URLSearchParams(search || '');
    if (q.get('utm_medium') !== 'share') return null;
    return BY_NAME[String(q.get('utm_source') || '').toLowerCase()] || 'copy';
  } catch { return null; }
}

// On the listing page: remember this visit's channel (if it came from a share link) and
// return the channel this listing was reached through, or null.
export function rememberShareVisit(listingId, now = Date.now()) {
  if (typeof window === 'undefined' || !listingId) return null;
  let all = {};
  try { all = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch { all = {}; }
  const ch = shareChannelFromQuery(window.location.search);
  if (ch) all[listingId] = { ch, t: now };
  for (const [k, v] of Object.entries(all)) if (!v || now - v.t > TTL) delete all[k];
  try { window.localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
  return all[listingId]?.ch || null;
}
