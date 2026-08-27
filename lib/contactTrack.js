'use client';
// Client helpers for trackable WhatsApp contact links. A token is generated per
// contact button; the WhatsApp message links back to the listing with UTM + the
// token, so when the seller opens it we can flag the contact as "opened".

// Short, URL-safe base62 code (~10 chars). Used both as the contact tracking
// token AND as the /s/<code> short-link slug, so the shared WhatsApp URL stays
// short. 62^10 ≈ 8e17 combinations — collisions are negligible, and the
// contact-track upsert is keyed on this token anyway.
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function genToken() {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(10);
      crypto.getRandomValues(bytes);
      let s = '';
      for (const b of bytes) s += B62[b % 62];
      return s;
    }
  } catch { /* noop */ }
  return 'cl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Append UTM tracking + the token to the listing URL that goes inside the message.
export function trackedUrl(url, token) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=whatsapp&utm_medium=seller_contact&utm_campaign=property_share&t=${encodeURIComponent(token)}`;
}

// Short WhatsApp share link: <origin>/s/<token>. The /s/<code> route resolves
// the token back to its property and 302-redirects to the full listing URL WITH
// the UTM params + ?t=<token>, so the message stays short but tracking is
// identical to trackedUrl(). Derives the origin from the property URL (which
// already carries the correct production domain), and falls back to the full
// tracked URL if the URL can't be parsed.
export function shortUrl(url, token) {
  if (!url || !token) return trackedUrl(url, token);
  try {
    const origin = new URL(url).origin;
    return `${origin}/s/${encodeURIComponent(token)}`;
  } catch {
    return trackedUrl(url, token);
  }
}

// Record that a buyer initiated contact (fire-and-forget; keepalive so it
// survives the immediate navigation to wa.me).
export function trackContact(payload) {
  try {
    fetch('/api/contact-track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), keepalive: true,
    }).catch(() => {});
  } catch { /* noop */ }
}

// Flag a contact record as opened (called when the seller lands on ?t=<token>).
export function markOpened(token) {
  try {
    fetch('/api/contact-track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ open: true, token }), keepalive: true,
    }).catch(() => {});
  } catch { /* noop */ }
}
