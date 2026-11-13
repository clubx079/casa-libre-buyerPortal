// Shared server-side marketplace query — used by /api/listings/search + /pins
// AND by the /propiedades page for the initial (SSR) render, so the first paint
// already has results/pins (no client loading wait).
import { parseArea, areaParts } from './mapArea';
import { typeKeywords } from './propertyTypeOptions';
import 'server-only';
import { select, selectWithCount } from './db';
import { getUsdToPyg } from './fx';
import { dualPrice } from './money';
import { COUNTRY } from './country';
import { zoningEnabled, zoningFilterPart } from './zoning/categories';
import { looseFor, hideUnverified, unverifiedFields } from './unverified';

// Paraguay: fields that fail the checks are blanked and shown as "Contact seller for …".
const LOOSE = looseFor(COUNTRY.code);

// PostgREST here uses %-wildcards (encoded %25); values are percent-encoded so
// commas/parens can't break an or=() group.
const ilikeCond = (col, v) => `${col}.ilike.%25${encodeURIComponent(String(v))}%25`;
// Accent-insensitive text search: phones rarely type accents, so "asuncion", "encarnacion", "lambare"
// or "nemby" found nothing while the data says "Asunción". Each letter that can carry an accent becomes
// a small regex class ([oó], [nñ]…); every other letter must match exactly (an earlier "_" wildcard
// version was too loose: "asuncion" matched "casi Calle"). Anything that isn't a letter, digit or space
// becomes "." so commas/parentheses can't break PostgREST's or=() and no regex syntax gets through.
const ACCENT_CLASS = { a: '[aáàâä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôö]', u: '[uúùûü]', n: '[nñ]' };
export function accentRegex(v) {
  const t = String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return [...t].map((ch) => ACCENT_CLASS[ch] || (/[a-z0-9 ]/.test(ch) ? ch : '.')).join('');
}
const matchLoose = (col, v) => `${col}.imatch.${encodeURIComponent(accentRegex(v))}`;
const has = (v) => v != null && v !== '' && v !== 'all';
// Geocoder fallbacks: where an address lands when only the country is recognised (Google's
// centre of Paraguay). Pins there are hidden from the map (2026-11-13: 39 PY listings).
export const UNKNOWN_SPOTS = { py: [{ lat: -23.442503, lng: -58.443832 }] };

function baseParts(p, { forPins } = {}) {
  const op = p.op === 'alquiler' || p.op === 'venta' ? p.op : 'all';
  // is_complete=true already implies an active building (the recompute only flags
  // active buildings; land/incomplete stay false) → no not.ilike land filter
  // needed, so the (is_complete, admin_status, listing_type) index serves counts.
  const parts = ['is_complete=eq.true', 'admin_status=eq.active'];
  // Map area (the visitor moved the map) → only listings inside it. Not used for pins.
  if (!forPins) parts.push(...areaParts(parseArea(p)));
  if (forPins) {
    const b = COUNTRY.bounds;
    parts.push('latitude=not.is.null', 'longitude=not.is.null', `latitude=gte.${b.latMin}`, `latitude=lte.${b.latMax}`, `longitude=gte.${b.lngMin}`, `longitude=lte.${b.lngMax}`);
    // A location of exactly the country's centre means "address not found, only the country matched"
    // (e.g. a Barrio Herrera house pinned in the Chaco). Treat it as unknown: listed, but no map pin.
    for (const c of UNKNOWN_SPOTS[COUNTRY.code] || []) {
      // "outside a tiny box around that spot" (this PostgREST has no not.and)
      parts.push(`or=(latitude.lt.${c.lat - 0.002},latitude.gt.${c.lat + 0.002},longitude.lt.${c.lng - 0.002},longitude.gt.${c.lng + 0.002})`);
    }
  }
  if (op === 'alquiler') parts.push('listing_type=eq.rent');
  else if (op === 'venta') parts.push('listing_type=neq.rent');
  const typeKw = has(p.type) ? typeKeywords(p.type) : []; // lib/propertyTypeOptions.js, same list as the publish form
  if (typeKw.length) parts.push(`or=(${typeKw.map((k) => ilikeCond('property_type', k)).join(',')})`);
  if (has(p.beds)) parts.push(`bedrooms=gte.${parseInt(p.beds, 10)}`);
  if (p.priceMin != null && p.priceMin !== '') parts.push(`price_usd=gte.${Number(p.priceMin)}`);
  if (p.priceMax != null && p.priceMax !== '') parts.push(`price_usd=lte.${Number(p.priceMax)}`);
  if (has(p.barrio)) parts.push(`neighborhood=imatch.${encodeURIComponent(accentRegex(p.barrio))}`);
  if (p.seller === 'owner') parts.push('source_id=is.null');
  else if (p.seller === 'agent') parts.push('source_id=not.is.null');
  if (has(p.q)) parts.push(`or=(${['neighborhood', 'city', 'address', 'property_type'].map((c) => matchLoose(c, p.q)).join(',')})`);
  // Allowed building height (zoned cities only — Asunción today). Unzoned listings drop out while it's set.
  if (zoningEnabled()) { const zp = zoningFilterPart(p.height); if (zp) parts.push(zp); }
  return parts;
}

const num = (v) => (v == null ? null : Number(v));
// A property counts as currently promoted only while its paid window is live.
const isPromoted = (r) => !!(r.promotion_plan && r.promotion_expires_at && new Date(r.promotion_expires_at) > new Date());
const planOf = (r) => (isPromoted(r) ? r.promotion_plan : null);

export async function searchListings(p = {}) {
  const page = Math.max(1, parseInt(p.page, 10) || 1);
  const pageSize = Math.min(60, Math.max(1, parseInt(p.pageSize, 10) || 24));
  const parts = baseParts(p);
  parts.push('select=id,latitude,longitude,listing_type,price,currency,property_type,city,neighborhood,address,province,bedrooms,bathrooms,parking_spaces,covered_area,floor_area,land_area,feature_image_url,source_id,promotion_plan,promotion_expires_at');
  const sort = ['relevancia', 'precio_asc', 'precio_desc', 'area_desc'].includes(p.sort) ? p.sort : 'relevancia';
  const primary = sort === 'precio_asc' ? 'price_usd.asc.nullslast' : sort === 'precio_desc' ? 'price_usd.desc.nullslast' : sort === 'area_desc' ? 'covered_area.desc.nullslast' : 'created_at.desc';
  // Promotions no longer float to the top — the chosen sort (incl. relevance) fully
  // governs order, so verified/home listings rank by the same rules as everything else.
  parts.push(`order=${primary}`);
  parts.push(`limit=${pageSize}`, `offset=${(page - 1) * pageSize}`);
  let rows = [], count = 0;
  try { ({ rows, count } = await selectWithCount('properties', parts.join('&'))); } catch { rows = []; count = 0; }
  const rate = await getUsdToPyg();
  const listings = rows.map((r) => {
    const m = dualPrice(r.price, r.currency, rate);
    const l = {
      id: r.id, lat: num(r.latitude), lng: num(r.longitude),
      mode: r.listing_type === 'rent' ? 'alquiler' : 'venta', usd: m.usd, pyg: m.pyg,
      type: r.property_type || null, city: r.city || null, neighborhood: r.neighborhood || null,
      address: r.address || null, province: r.province || null,
      beds: num(r.bedrooms), baths: num(r.bathrooms), parking: num(r.parking_spaces),
      area: num(r.covered_area) || num(r.floor_area) || num(r.land_area) || null,
      covered: num(r.covered_area) || num(r.floor_area) || null,
      image: r.feature_image_url || null,
      user_published: !r.source_id,
      verified: isPromoted(r), plan: planOf(r), highlighted: isPromoted(r),
    };
    return LOOSE ? hideUnverified(l) : l;
  });
  return { listings, count, page, pageSize };
}

export const PIN_LIMIT = 8000;
export async function getPins(p = {}) {
  const parts = baseParts(p, { forPins: true });
  parts.push('select=id,latitude,longitude,listing_type,price,currency,promotion_plan,promotion_expires_at', 'order=created_at.desc', `limit=${PIN_LIMIT}`);
  let rows = [];
  try { rows = await select('properties', parts.join('&')); } catch { rows = []; }
  const rate = await getUsdToPyg();
  return (rows || []).map((r) => {
    const m = dualPrice(r.price, r.currency, rate);
    const mode = r.listing_type === 'rent' ? 'alquiler' : 'venta';
    // nv = price not verified → the pin says "Consultar" instead of a price.
    const nv = LOOSE && unverifiedFields({ mode, usd: m.usd, pyg: m.pyg }).includes('price');
    // hl = promoted → the client draws a star pin and keeps it out of clusters.
    return { id: r.id, lat: Number(Number(r.latitude).toFixed(5)), lng: Number(Number(r.longitude).toFixed(5)), usd: nv ? null : m.usd, mode, hl: isPromoted(r), plan: planOf(r), ...(nv ? { nv: 1 } : {}) };
  });
}
