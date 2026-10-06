// The marketplace completeness gate, extracted as a PURE module (no
// `server-only`) so both the Next app and the offline recompute script use the
// exact same logic — this is what keeps the persisted `is_complete` flag in
// parity with what the portal would show.
import { dualPrice } from './money.js';
import { COUNTRY } from './country.js';
import { rentPriceOk } from './rentFloor.js';

// A scraped/published deal is shown ONLY when its essential data is present AND
// plausible: contact path, location, price with FX-aware floors, no sale-as-rent
// junk, sane bed/bath/parking caps, and a believable built area (buildings).
//
// opts.loose (Paraguay, lib/unverified.js): only contact + location hold a listing
// back; the remaining checks no longer hide it, the page shows "Contact seller for …"
// for each field that fails them instead. Array.filter passes an index as the 2nd
// argument, which reads as not loose.
export function isCompleteListing(l, opts) {
  if (!l) return false;

  const digits = String(l.contact_phone || '').replace(/\D/g, '');
  if (digits.length < 6) return false;

  if (!l.city && !l.neighborhood) return false;

  if (opts && opts.loose === true) return true;

  const rent = l.mode === 'alquiler';
  if (rent) {
    if (!rentPriceOk(l, COUNTRY.currencyCode)) return false;   // missing or too low (lib/rentFloor.js)
    if (l.usd != null && Number(l.usd) > 15000) return false; // sale price shown as rent
  } else {
    if (!(Number(l.usd) > 0)) return false;
    if (Number(l.usd) < 5000) return false;
  }

  const overCap = (v, max) => v != null && (Number(v) < 0 || Number(v) > max);
  if (overCap(l.beds, 10) || overCap(l.baths, 10) || overCap(l.parking, 10)) return false;

  const landType = /terreno|campo|loteamiento|lote|chacra|estancia/i.test(l.type || '');
  const builtArea = l.covered != null ? Number(l.covered) : (l.area != null ? Number(l.area) : null);
  if (!landType && builtArea != null && (builtArea < 5 || builtArea > 2000)) return false;

  return true;
}

// Minimal shaping of a raw DB row into just the fields the gate reads (so the
// recompute script doesn't need the full server-only shape()).
export function shapeForGate(r, rate) {
  const m = dualPrice(r.price, r.currency, rate);
  const num = (v) => (v == null ? null : Number(v));
  return {
    mode: r.listing_type === 'rent' ? 'alquiler' : 'venta',
    usd: m.usd, pyg: m.pyg,
    contact_phone: r.contact_phone || null,
    city: r.city || null, neighborhood: r.neighborhood || null,
    beds: num(r.bedrooms), baths: num(r.bathrooms), parking: num(r.parking_spaces),
    covered: num(r.covered_area) || num(r.floor_area) || null,
    area: num(r.covered_area) || num(r.floor_area) || num(r.land_area) || null,
    type: r.property_type || null,
  };
}
