// Phone numbers for WhatsApp sign-in, as E.164 (+595981234567) — the form Relay wants
// and the form we store on a verified account. Pure (no server/env imports) so it is
// unit-tested; the country prefix comes from lib/country.js (COUNTRY.phonePrefix).
//
//   "0981 123 456"      + 595 → +595981123456   (local, leading 0 dropped)
//   "981123456"         + 595 → +595981123456
//   "+595 981 123-456"        → +595981123456   (already international)
//   "00595981123456"          → +595981123456
// A number written with + or 00 keeps its own country (a Bolivian on the PY site is fine).
export function toE164(input, prefix) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (raw.startsWith('+')) return valid(d);
  if (d.startsWith('00')) return valid(d.slice(2));
  const p = String(prefix || '').replace(/\D/g, '');
  if (p && d.startsWith(p) && d.length - p.length >= 6) return valid(d);
  d = d.replace(/^0+/, '');
  return valid(p + d);
}

// E.164: up to 15 digits; we also want a real subscriber number (8+ digits overall).
function valid(digits) {
  return digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0') ? `+${digits}` : null;
}
