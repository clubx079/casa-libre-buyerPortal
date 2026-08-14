// Server-side listings loader for the buyer marketplace. Reads BUILDINGS only
// (land excluded) from the Casa Libre AiroBase DB, attaches images (served via the
// /api/media proxy) and the live USD/Gs conversion.
import 'server-only';
import { select, selectWithCount } from './db';
import { buildingsParts } from './land';
import { getUsdToPyg } from './fx';
import { dualPrice } from './money';

const SELECT = [
  'id,slug,address,city,neighborhood,province,price,currency,listing_type,property_type',
  'bedrooms,bathrooms,floor_area,covered_area,land_area,parking_spaces,latitude,longitude',
  'description,feature_image_url,external_url,contact_name,contact_phone',
  'property_images(storage_url,is_feature,position)',
].join(',');

function shape(r, rate) {
  const imgs = (r.property_images || [])
    .slice()
    .sort((a, b) => (b.is_feature - a.is_feature) || (a.position - b.position))
    .map((x) => x.storage_url)
    .filter(Boolean);
  const m = dualPrice(r.price, r.currency, rate);
  const num = (v) => (v == null ? null : Number(v));
  return {
    id: r.id, slug: r.slug,
    lat: num(r.latitude), lng: num(r.longitude),
    mode: r.listing_type === 'rent' ? 'alquiler' : 'venta',
    price: num(r.price), currency: r.currency, usd: m.usd, pyg: m.pyg,
    type: r.property_type || null,
    city: r.city || null, neighborhood: r.neighborhood || null, province: r.province || null,
    address: r.address || null,
    beds: num(r.bedrooms), baths: num(r.bathrooms), parking: num(r.parking_spaces),
    area: num(r.covered_area) || num(r.floor_area) || num(r.land_area) || null,
    image: imgs[0] || r.feature_image_url || null,
    images: imgs.length ? imgs : (r.feature_image_url ? [r.feature_image_url] : []),
    description: r.description || null,
    external_url: r.external_url || null,
    contact_name: r.contact_name || null,
    contact_phone: r.contact_phone || null,
  };
}

// Buildings for the marketplace (land excluded). Newest first.
export async function getListings({ limit = 400 } = {}) {
  const parts = [
    `select=${SELECT}`,
    'admin_status=eq.active',
    'order=created_at.desc',
    `limit=${limit}`,
    ...buildingsParts(),
  ];
  let rows = [], count = 0;
  try { ({ rows, count } = await selectWithCount('properties', parts.join('&'))); } catch { rows = []; count = 0; }
  const rate = await getUsdToPyg();
  return { rate, count, listings: rows.map((r) => shape(r, rate)) };
}

// A single building by slug (detail page).
export async function getListing(slug) {
  const parts = [`select=${SELECT}`, `slug=eq.${encodeURIComponent(slug)}`, 'limit=1'];
  let rows = [];
  try { rows = await select('properties', parts.join('&')); } catch { rows = []; }
  if (!rows.length) return null;
  const rate = await getUsdToPyg();
  return shape(rows[0], rate);
}
