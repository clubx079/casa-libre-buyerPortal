// Where a buyer was when they tapped WhatsApp / call / copy number on a listing:
// IP + country (+ city if Cloudflare's "visitor location headers" are on). Saved on
// the contact row so the admin can show it — PostHog only has it for website taps
// that weren't blocked by an ad blocker, never for the mobile app.
// Pure: takes a Headers object (tests/contactGeo.test.mjs).
const IP = /^[0-9a-fA-F:.]{3,45}$/;

export function contactGeo(headers) {
  const h = headers;
  const ipRaw = (h.get('cf-connecting-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || h.get('x-real-ip') || '').trim();
  const cc = (h.get('cf-ipcountry') || '').trim().toUpperCase();
  let city = null;
  try { city = decodeURIComponent(h.get('cf-ipcity') || '').trim().slice(0, 80) || null; } catch { city = null; }
  return {
    buyer_ip: IP.test(ipRaw) ? ipRaw : null,
    // XX = unknown, T1 = Tor
    buyer_country: /^[A-Z]{2}$/.test(cc) && !['XX', 'T1'].includes(cc) ? cc : null,
    buyer_city: city,
  };
}
