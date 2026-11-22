// "Share your listing" links — pure, shared word-for-word with the admin portal and the
// mobile app (keep the three copies identical; tests/shareLinks.test.mjs).
//
//   share link   <country origin>/l/<code>?c=<channel>
//   code         shareCode(listingId): the FIRST 40 BITS of the listing's uuid (its first
//                10 hex digits) written in base 36, padded to 8 characters [0-9a-z].
//                Same listing → same code everywhere, no table, no lookup to make one.
//                The redirect finds the listing back with a uuid RANGE query
//                (codeRange: id >= lo AND id <= hi) — 2^40 values, so two listings of one
//                country sharing a code is practically impossible (and handled: newest live wins).
//   channel      ig | fb | wa | x | tt | li | copy | qr  (unknown → 'copy')
//   /l/<code>    307 → /propiedad/<id>?utm_source=<channel name>&utm_medium=share
//                &utm_campaign=listing_share&utm_content=<code>[&ref=<owner referral code>]
export const CHANNELS = ['ig', 'fb', 'wa', 'x', 'tt', 'li', 'copy', 'qr'];
export const CHANNEL_NAMES = Object.freeze({ ig: 'instagram', fb: 'facebook', wa: 'whatsapp', x: 'x', tt: 'tiktok', li: 'linkedin', copy: 'copy', qr: 'qr' });
// the networks a caption is written for (copy / qr reuse the WhatsApp text)
export const CAPTION_CHANNELS = ['ig', 'fb', 'wa', 'x', 'tt', 'li'];
export const SHARE_MEDIUM = 'share';
export const SHARE_CAMPAIGN = 'listing_share';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[0-9a-z]{8}$/;
const MAX40 = 2 ** 40;

export const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);
export const channelOf = (c) => (CHANNELS.includes(String(c || '').toLowerCase()) ? String(c).toLowerCase() : 'copy');

// listing uuid → 8-char code, or null when it is not a uuid.
export function shareCode(listingId) {
  if (!isUuid(listingId)) return null;
  const n = parseInt(listingId.replace(/-/g, '').slice(0, 10).toLowerCase(), 16);
  return n.toString(36).padStart(8, '0');
}

export function isShareCode(code) {
  if (typeof code !== 'string' || !CODE_RE.test(code)) return false;
  return parseInt(code, 36) < MAX40;
}

// code → the uuid range its listing lies in ({ lo, hi }), or null.
export function codeRange(code) {
  if (!isShareCode(code)) return null;
  const hex = parseInt(code, 36).toString(16).padStart(10, '0');
  const head = `${hex.slice(0, 8)}-${hex.slice(8, 10)}`;
  return { lo: `${head}00-0000-0000-000000000000`, hi: `${head}ff-ffff-ffff-ffffffffffff` };
}

const trim = (origin) => String(origin || '').replace(/\/+$/, '');

// The link a seller posts: <origin>/l/<code>?c=<channel>
export function shareUrl(origin, listingId, channel = 'copy') {
  const code = shareCode(listingId);
  return code ? `${trim(origin)}/l/${code}?c=${channelOf(channel)}` : null;
}

// Every channel's link → { ig, fb, wa, x, tt, li, copy, qr }
export function shareLinks(origin, listingId) {
  return Object.fromEntries(CHANNELS.map((c) => [c, shareUrl(origin, listingId, c)]));
}

// Where /l/<code> sends the visitor.
export function shareTarget(origin, listingId, { code, channel, refCode } = {}) {
  const ch = channelOf(channel);
  const q = new URLSearchParams({
    utm_source: CHANNEL_NAMES[ch], utm_medium: SHARE_MEDIUM, utm_campaign: SHARE_CAMPAIGN, utm_content: code || shareCode(listingId) || '',
  });
  if (refCode) q.set('ref', refCode);
  return `${trim(origin)}/propiedad/${encodeURIComponent(listingId)}?${q.toString()}`;
}

// The buttons of the share sheet that open a network directly. caption = the network's text
// (already containing the link where the network wants it in the text).
//   wa  wa.me with the caption       fb  Facebook sharer (link only: Facebook ignores text)
//   x   X intent (text + url)         li  LinkedIn share-offsite (link only)
export function networkUrls({ links = {}, captions = {} } = {}) {
  const e = encodeURIComponent;
  const out = {};
  if (links.wa) out.wa = `https://wa.me/?text=${e(captions.wa || links.wa)}`;
  if (links.fb) out.fb = `https://www.facebook.com/sharer/sharer.php?u=${e(links.fb)}`;
  if (links.x) {
    // the X caption carries the link at its end: pass it as url= instead, so X counts it as a link
    const text = String(captions.x || '').replace(links.x, '').trim();
    out.x = `https://x.com/intent/tweet?${text ? `text=${e(text)}&` : ''}url=${e(links.x)}`;
  }
  if (links.li) out.li = `https://www.linkedin.com/sharing/share-offsite/?url=${e(links.li)}`;
  return out;
}

// The listing's share page (emails' "Compartir mi propiedad" button, the app's web fallback).
export const sharePageUrl = (origin, listingId) => `${trim(origin)}/compartir/${encodeURIComponent(listingId)}`;
