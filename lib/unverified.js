// Listings with data we couldn't verify. Roland, Oct 5 2026: instead of holding a
// listing back because one field looks wrong (a sale price under US$ 5,000, 25
// bedrooms, 9,000 m² built), show it and replace each field that fails the checks
// with "Contact seller for …" plus one fine-print note. Listings with no contact,
// no location, or that duplicate another are still held back (lib/completeness.js).
//
// Paraguay first; other countries keep the strict gate until they're added here.
// No server-only imports (country.js is client-safe) so the gate, the recompute script, the
// marketplace search and the UI all apply the same rules.
import { COUNTRY } from './country.js';
import { rentPriceOk } from './rentFloor.js';

export const LOOSE_COUNTRIES = new Set(['py']);
export const looseFor = (cc) => LOOSE_COUNTRIES.has(String(cc || '').toLowerCase());

export const UNVERIFIED_FIELDS = ['price', 'area', 'bedrooms', 'bathrooms', 'parking'];

const LAND_RE = /terreno|campo|loteamiento|lote|chacra|estancia/i;
const overCap = (v, max) => v != null && (Number(v) < 0 || Number(v) > max);

// Which fields fail the checks. Same thresholds as the strict gate and the admin's
// lib/ingest.validateListing. g = { mode ('venta' | 'alquiler'), usd, pyg, beds,
// baths, parking, covered (built m²), type }.
export function unverifiedFields(g) {
  if (!g) return [];
  const out = [];
  const usd = g.usd == null ? null : Number(g.usd);
  const pyg = g.pyg == null ? null : Number(g.pyg);
  const badPrice = g.mode === 'alquiler'
    ? !rentPriceOk({ usd, pyg }, COUNTRY.currencyCode) || (usd != null && usd > 15000)   // missing, too low, or a sale price on a rental
    : !(usd > 0) || usd < 5000 || usd > 50000000;                    // missing, too low, or absurdly high
  if (badPrice) out.push('price');
  if (!LAND_RE.test(g.type || '') && g.covered != null && (Number(g.covered) < 5 || Number(g.covered) > 2000)) out.push('area');
  if (overCap(g.beds, 10)) out.push('bedrooms');
  if (overCap(g.baths, 10)) out.push('bathrooms');
  if (overCap(g.parking, 10)) out.push('parking');
  return out;
}

// Blank the values we couldn't verify so no part of the site can show them, and
// record which ones they were (l.unverified) for the "Contact seller for …" text.
// l is a shaped listing (lib/listings shape / lib/marketplace search row).
export function hideUnverified(l) {
  const fields = unverifiedFields(l);
  if (!fields.length) return l;
  const o = { ...l, unverified: fields };
  if (fields.includes('price')) Object.assign(o, { usd: null, pyg: null, price: null });
  if (fields.includes('area')) Object.assign(o, { covered: null, area: o.lot ?? null });
  if (fields.includes('bedrooms')) o.beds = null;
  if (fields.includes('bathrooms')) o.baths = null;
  if (fields.includes('parking')) o.parking = null;
  return o;
}

// --- "Contact seller for …" texts ---
// l.unverified lists the fields; each shows "Contact seller for …" in its place, and the
// property page adds one fine-print note naming all of them.
export const isUnverified = (l, field) => Array.isArray(l?.unverified) && l.unverified.includes(field);
const CONTACT_FOR = {
  es: { price: 'Consultá el precio con el vendedor', area: 'Consultá la superficie con el vendedor', bedrooms: 'Consultá los dormitorios con el vendedor', bathrooms: 'Consultá los baños con el vendedor', parking: 'Consultá las cocheras con el vendedor' },
  en: { price: 'Contact seller for price', area: 'Contact seller for area', bedrooms: 'Contact seller for bedrooms', bathrooms: 'Contact seller for bathrooms', parking: 'Contact seller for parking' },
};
export const contactSellerFor = (field, lang) => CONTACT_FOR[lang === 'en' ? 'en' : 'es'][field] || '';
// Map pins and the specs row have room for one short word.
export const contactShort = (lang) => (lang === 'en' ? 'Ask seller' : 'Consultar');
const NOTE_PART = {
  es: { price: 'el precio correcto', area: 'la superficie correcta', bedrooms: 'la cantidad correcta de dormitorios', bathrooms: 'la cantidad correcta de baños', parking: 'la cantidad correcta de cocheras' },
  en: { price: 'price', area: 'area', bedrooms: 'number of bedrooms', bathrooms: 'number of bathrooms', parking: 'number of parking spaces' },
};
const listJoin = (parts, and) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`);
export function unverifiedNote(fields, lang) {
  const en = lang === 'en';
  const parts = (fields || []).map((f) => NOTE_PART[en ? 'en' : 'es'][f]).filter(Boolean);
  if (!parts.length) return '';
  return en
    ? `Our system could not verify the correct ${listJoin(parts, 'and')} of this property. Please contact the seller directly.`
    : `Nuestro sistema no pudo verificar ${listJoin(parts, 'y')} de esta propiedad. Por favor, contactá directamente al vendedor.`;
}
