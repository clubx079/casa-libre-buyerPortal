// Self-contained codec for WhatsApp short-link codes (/s/<code>). The code
// embeds the property UUID so the redirect can ALWAYS resolve the listing
// without a DB lookup — even if the contact-tracking write was dropped. Format:
//
//   <base62(uuid)>-<token>
//
// where base62(uuid) is the 128-bit UUID rendered in base62 (~22 chars) and
// <token> is the per-share tracking token (also used as ?t= for "seller opened"
// analytics). The '-' separator is safe because the base62 alphabet excludes it.
//
// Shared by lib/contactTrack.js (client, builds the link) and app/s/[code] (server,
// resolves it). Pure functions — no DB, no browser/server-only APIs.

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// UUID string -> base62 string. Returns null if not a valid UUID.
export function encodeUuidB62(uuid) {
  if (!uuid || !UUID_RE.test(uuid)) return null;
  let n = BigInt('0x' + uuid.replace(/-/g, ''));
  if (n === 0n) return '0';
  let s = '';
  while (n > 0n) {
    s = B62[Number(n % 62n)] + s;
    n /= 62n;
  }
  return s;
}

// base62 string -> UUID string. Returns null if it doesn't decode to 128 bits.
export function decodeUuidB62(s) {
  if (!s) return null;
  let n = 0n;
  for (const ch of s) {
    const idx = B62.indexOf(ch);
    if (idx < 0) return null;
    n = n * 62n + BigInt(idx);
  }
  let hex = n.toString(16);
  if (hex.length > 32) return null;
  hex = hex.padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Build the short code from a property UUID + tracking token. Returns null if
// the property id isn't a UUID (caller then falls back to the full tracked URL).
export function buildCode(propertyId, token) {
  const p = encodeUuidB62(propertyId);
  if (!p || !token) return null;
  return `${p}-${token}`;
}

// Parse a short code back into { propertyId, token }. Handles both the new
// self-encoding format (<b62>-<token>) and the legacy token-only format
// (returns { propertyId: null, token: <code> } so the route can DB-fall-back).
export function parseCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return { propertyId: null, token: null };
  const dash = raw.indexOf('-');
  if (dash > 0) {
    const propertyId = decodeUuidB62(raw.slice(0, dash));
    const token = raw.slice(dash + 1) || null;
    if (propertyId && token) return { propertyId, token };
  }
  // Legacy: whole code is the tracking token, property recovered via DB.
  return { propertyId: null, token: raw };
}
