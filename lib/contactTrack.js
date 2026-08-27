'use client';
// Client helpers for trackable WhatsApp contact links. A token is generated per
// contact button; the WhatsApp message links back to the listing with UTM + the
// token, so when the seller opens it we can flag the contact as "opened".
import { buildCode } from '@/lib/shortcode';

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

// Short WhatsApp share link: <origin>/s/<code>, where <code> embeds the property
// UUID + tracking token (see lib/shortcode.js). The /s/<code> route decodes the
// property directly and 302-redirects to the full listing URL WITH the UTM
// params + ?t=<token> — so the message stays short, tracking is identical to
// trackedUrl(), and the link resolves even if the contact-tracking write was
// dropped (no DB dependency). Falls back to the full tracked URL if the property
// id can't be parsed from the URL.
export function shortUrl(url, token) {
  if (!url || !token) return trackedUrl(url, token);
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/propiedad\/([0-9a-f-]{36})/i);
    const code = m ? buildCode(m[1], token) : null;
    if (!code) return trackedUrl(url, token);
    return `${u.origin}/s/${code}`;
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
