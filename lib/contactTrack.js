'use client';
// Client helpers for trackable WhatsApp contact links. A token is generated per
// contact button; the WhatsApp message links back to the listing with UTM + the
// token, so when the seller opens it we can flag the contact as "opened".

export function genToken() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { /* noop */ }
  return 'cl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Append UTM tracking + the token to the listing URL that goes inside the message.
export function trackedUrl(url, token) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=whatsapp&utm_medium=seller_contact&utm_campaign=property_share&t=${encodeURIComponent(token)}`;
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
