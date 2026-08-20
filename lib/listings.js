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
  'description,features,feature_image_url,external_url,contact_name,contact_phone,created_at',
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
    covered: num(r.covered_area) || num(r.floor_area) || null,
    lot: num(r.land_area) || null,
    created_at: r.created_at || null,
    image: imgs[0] || r.feature_image_url || null,
    images: imgs.length ? imgs : (r.feature_image_url ? [r.feature_image_url] : []),
    description: r.description || null,
    features: Array.isArray(r.features) ? r.features.filter(Boolean) : [],
    external_url: r.external_url || null,
    contact_name: r.contact_name || null,
    contact_phone: r.contact_phone || null,
  };
}

// ── COMPLETE / INCOMPLETE data gate ─────────────────────────────────────────
// A scraped deal is shown on the buyer portal ONLY when its essential data is
// present AND plausible. Every public path (marketplace, landing, detail,
// saved) passes through this. Enforces audit #1/#2/#3/#5b: no missing
// price/contact/location, no impossible bed/bath/parking/area, and no
// mode-swap junk (a sale price shown as a monthly rent, or vice-versa).
export function isCompleteListing(l) {
  if (!l) return false;

  // Contact path required — the marketplace's whole model is WhatsApp/phone (#5b).
  const digits = String(l.contact_phone || '').replace(/\D/g, '');
  if (digits.length < 6) return false;

  // Location required.
  if (!l.city && !l.neighborhood) return false;

  // Price present + plausible (#1/#2/#3).
  const rent = l.mode === 'alquiler';
  if (rent) {
    if (!(Number(l.pyg) > 0)) return false;                    // needs a ₲/mes price
    if (Number(l.pyg) < 300000) return false;                  // floor ₲300.000/mes
    if (l.usd != null && Number(l.usd) > 15000) return false;  // sale price shown as rent → drop
  } else {
    if (!(Number(l.usd) > 0)) return false;                    // needs a US$ price
    if (Number(l.usd) < 5000) return false;                    // floor US$5.000 (kills US$0/28/149/750 junk)
  }

  // Attribute caps — reject impossible values (#1/#2).
  const overCap = (v, max) => v != null && (Number(v) < 0 || Number(v) > max);
  if (overCap(l.beds, 10) || overCap(l.baths, 10) || overCap(l.parking, 10)) return false;

  // Built-area sanity for buildings (marketplace excludes land): 5–2.000 m².
  const landType = /terreno|campo|loteamiento|lote|chacra|estancia/i.test(l.type || '');
  const builtArea = l.covered != null ? Number(l.covered) : (l.area != null ? Number(l.area) : null);
  if (!landType && builtArea != null && (builtArea < 5 || builtArea > 2000)) return false;

  return true;
}

// Buildings for the marketplace (land excluded). Newest first.
export async function getListings({ limit = 400 } = {}) {
  const parts = [
    `select=${SELECT}`,
    'admin_status=eq.active',
    // Pre-filter the two highest-impact completeness checks at the DB so the
    // limited fetch returns complete rows; isCompleteListing() then refines
    // (price floors, attribute caps, mode-swaps, area). See the gate above.
    'contact_phone=not.is.null',
    'price=gt.0',
    'order=created_at.desc',
    `limit=${limit}`,
    ...buildingsParts(),
  ];
  // Retry a few times so a momentary network blip doesn't render an empty
  // marketplace (it would otherwise silently fall back to zero listings).
  let rows = [], count = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { ({ rows, count } = await selectWithCount('properties', parts.join('&'))); break; }
    catch (e) {
      if (attempt === 3) { rows = []; count = 0; }
      else await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  const rate = await getUsdToPyg();
  // Only complete deals reach the buyer portal; count reflects the complete set.
  const complete = rows.map((r) => shape(r, rate)).filter(isCompleteListing);
  return { rate, count: complete.length, listings: complete };
}

// Hydrate a set of property ids into shaped listings, preserving the id order.
export async function getListingsByIds(ids) {
  const rate = await getUsdToPyg();
  if (!ids || !ids.length) return { rate, listings: [] };
  const inList = ids.map((x) => `"${String(x).replace(/"/g, '')}"`).join(',');
  const parts = [`select=${SELECT}`, `id=in.(${inList})`, `limit=${ids.length}`];
  let rows = [];
  try { rows = await select('properties', parts.join('&')); } catch { rows = []; }
  const byId = new Map(rows.map((r) => [r.id, r]));
  const listings = ids.map((id) => byId.get(id)).filter(Boolean).map((r) => shape(r, rate)).filter(isCompleteListing);
  return { rate, listings };
}

// All listings a user has published (any status), newest first.
export async function getUserListings(userId) {
  const rate = await getUsdToPyg();
  if (!userId) return { rate, listings: [] };
  const parts = [`select=${SELECT},admin_status,created_at`, `created_by=eq.${encodeURIComponent(userId)}`, 'order=created_at.desc', 'limit=300'];
  let rows = [];
  try { rows = await select('properties', parts.join('&')); } catch { rows = []; }
  const listings = rows.map((r) => ({ ...shape(r, rate), admin_status: r.admin_status || null, created_at: r.created_at || null }));
  return { rate, listings };
}

// A single building by slug (detail page).
export async function getListing(idOrSlug) {
  const key = String(idOrSlug || '');
  // Public URLs carry our internal uuid; old source-based slugs still resolve (fallback).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  const parts = [`select=${SELECT}`, `${isUuid ? 'id' : 'slug'}=eq.${encodeURIComponent(key)}`, 'limit=1'];
  let rows = [];
  try { rows = await select('properties', parts.join('&')); } catch { rows = []; }
  if (!rows.length) return null;
  const rate = await getUsdToPyg();
  // Incomplete deals are never publicly viewable (direct-URL access 404s).
  const l = shape(rows[0], rate);
  return isCompleteListing(l) ? l : null;
}
