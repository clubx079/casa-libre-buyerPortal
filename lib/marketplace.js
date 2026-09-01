// Shared server-side marketplace query — used by /api/listings/search + /pins
// AND by the /propiedades page for the initial (SSR) render, so the first paint
// already has results/pins (no client loading wait).
import 'server-only';
import { select, selectWithCount } from './db';
import { getUsdToPyg } from './fx';
import { dualPrice } from './money';

const TYPE_KW = {
  casa: ['casa', 'house'], depto: ['departamento', 'depto', 'apartment', 'flat'],
  duplex: ['duplex', 'dúplex'], oficina: ['oficina', 'office'],
  deposito: ['deposito', 'depósito', 'warehouse', 'galp'], comercial: ['comercial', 'local', 'commercial', 'tienda'],
  edificio: ['edificio', 'building'], condominio: ['condominio', 'condo'],
};
// PostgREST here uses %-wildcards (encoded %25); values are percent-encoded so
// commas/parens can't break an or=() group.
const ilikeCond = (col, v) => `${col}.ilike.%25${encodeURIComponent(String(v))}%25`;
const has = (v) => v != null && v !== '' && v !== 'all';

function baseParts(p, { forPins } = {}) {
  const op = p.op === 'alquiler' || p.op === 'venta' ? p.op : 'all';
  // is_complete=true already implies an active building (the recompute only flags
  // active buildings; land/incomplete stay false) → no not.ilike land filter
  // needed, so the (is_complete, admin_status, listing_type) index serves counts.
  const parts = ['is_complete=eq.true', 'admin_status=eq.active'];
  if (forPins) parts.push('latitude=not.is.null', 'longitude=not.is.null', 'latitude=gte.-28', 'latitude=lte.-19', 'longitude=gte.-63', 'longitude=lte.-54');
  if (op === 'alquiler') parts.push('listing_type=eq.rent');
  else if (op === 'venta') parts.push('listing_type=neq.rent');
  if (has(p.type) && TYPE_KW[p.type]) parts.push(`or=(${TYPE_KW[p.type].map((k) => ilikeCond('property_type', k)).join(',')})`);
  if (has(p.beds)) parts.push(`bedrooms=gte.${parseInt(p.beds, 10)}`);
  if (p.priceMin != null && p.priceMin !== '') parts.push(`price_usd=gte.${Number(p.priceMin)}`);
  if (p.priceMax != null && p.priceMax !== '') parts.push(`price_usd=lte.${Number(p.priceMax)}`);
  if (has(p.barrio)) parts.push(`neighborhood=ilike.%25${encodeURIComponent(p.barrio)}%25`);
  if (p.seller === 'owner') parts.push('source_id=is.null');
  else if (p.seller === 'agent') parts.push('source_id=not.is.null');
  if (has(p.q)) parts.push(`or=(${['neighborhood', 'city', 'address', 'property_type'].map((c) => ilikeCond(c, p.q)).join(',')})`);
  return parts;
}

const num = (v) => (v == null ? null : Number(v));

export async function searchListings(p = {}) {
  const page = Math.max(1, parseInt(p.page, 10) || 1);
  const pageSize = Math.min(60, Math.max(1, parseInt(p.pageSize, 10) || 24));
  const parts = baseParts(p);
  parts.push('select=id,latitude,longitude,listing_type,price,currency,property_type,city,neighborhood,address,province,bedrooms,bathrooms,parking_spaces,covered_area,floor_area,land_area,source_id');
  const sort = ['relevancia', 'precio_asc', 'precio_desc', 'area_desc'].includes(p.sort) ? p.sort : 'relevancia';
  parts.push(sort === 'precio_asc' ? 'order=price_usd.asc.nullslast' : sort === 'precio_desc' ? 'order=price_usd.desc.nullslast' : sort === 'area_desc' ? 'order=covered_area.desc.nullslast' : 'order=created_at.desc');
  parts.push(`limit=${pageSize}`, `offset=${(page - 1) * pageSize}`);
  let rows = [], count = 0;
  try { ({ rows, count } = await selectWithCount('properties', parts.join('&'))); } catch { rows = []; count = 0; }
  const rate = await getUsdToPyg();
  const listings = rows.map((r) => {
    const m = dualPrice(r.price, r.currency, rate);
    return {
      id: r.id, lat: num(r.latitude), lng: num(r.longitude),
      mode: r.listing_type === 'rent' ? 'alquiler' : 'venta', usd: m.usd, pyg: m.pyg,
      type: r.property_type || null, city: r.city || null, neighborhood: r.neighborhood || null,
      address: r.address || null, province: r.province || null,
      beds: num(r.bedrooms), baths: num(r.bathrooms), parking: num(r.parking_spaces),
      area: num(r.covered_area) || num(r.floor_area) || num(r.land_area) || null,
      user_published: !r.source_id,
    };
  });
  return { listings, count, page, pageSize };
}

export const PIN_LIMIT = 8000;
export async function getPins(p = {}) {
  const parts = baseParts(p, { forPins: true });
  parts.push('select=id,latitude,longitude,listing_type,price,currency', 'order=created_at.desc', `limit=${PIN_LIMIT}`);
  let rows = [];
  try { rows = await select('properties', parts.join('&')); } catch { rows = []; }
  const rate = await getUsdToPyg();
  return (rows || []).map((r) => {
    const m = dualPrice(r.price, r.currency, rate);
    return { id: r.id, lat: Number(Number(r.latitude).toFixed(5)), lng: Number(Number(r.longitude).toFixed(5)), usd: m.usd, mode: r.listing_type === 'rent' ? 'alquiler' : 'venta' };
  });
}
