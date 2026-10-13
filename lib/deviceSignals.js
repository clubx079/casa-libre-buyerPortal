// Browser side of lib/samePerson.js: a random device id kept on this browser (cookie
// cl_did + localStorage, 2 years) and a short hash of the device's profile (browser and
// model, screen, language, time zone, cores). Sent with each publish so one person with
// several emails shares one free-listings quota. No personal data — just two ids.
export const DEVICE_COOKIE = 'cl_did';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};

export function deviceId() {
  if (typeof window === 'undefined') return null;
  let id = null;
  try { id = window.localStorage.getItem(DEVICE_COOKIE); } catch {}
  if (!id) { const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${DEVICE_COOKIE}=([^;]+)`)); id = m ? decodeURIComponent(m[1]) : null; }
  if (!/^[a-z0-9-]{8,64}$/i.test(String(id || ''))) {
    id = (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
  }
  try { window.localStorage.setItem(DEVICE_COOKIE, id); } catch {}
  try { document.cookie = `${DEVICE_COOKIE}=${encodeURIComponent(id)}; Max-Age=${60 * 60 * 24 * 730}; path=/; SameSite=Lax`; } catch {}
  return id;
}

export function deviceFingerprint() {
  if (typeof window === 'undefined') return null;
  const n = window.navigator || {};
  const s = window.screen || {};
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  const parts = [
    n.userAgent, n.platform, (n.languages || [n.language]).join(','), tz,
    `${s.width}x${s.height}x${s.colorDepth}`, window.devicePixelRatio, n.hardwareConcurrency, n.deviceMemory, n.maxTouchPoints,
  ];
  return fnv(parts.map((x) => String(x ?? '')).join('|')) + fnv(parts.reverse().map((x) => String(x ?? '')).join('#'));
}

// Fields to add to a publish request (FormData or URLSearchParams).
export function appendDeviceSignals(form) {
  try {
    const id = deviceId(); const fp = deviceFingerprint();
    if (id) form.set('device_id', id);
    if (fp) form.set('device_fp', fp);
  } catch {}
  return form;
}
