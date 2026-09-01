// Server-side listings loader for the buyer marketplace. Reads BUILDINGS only
// (land excluded) from the Casa Libre AiroBase DB, attaches images (served via the
// /api/media proxy) and the live USD/Gs conversion.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { select, selectWithCount } from './db';
import { buildingsParts } from './land';
import { getUsdToPyg, getFxMeta } from './fx';
import { dualPrice } from './money';
import { isCompleteListing } from './completeness';
export { isCompleteListing };

const SELECT = [
  'id,slug,address,city,neighborhood,province,price,currency,listing_type,property_type',
  'bedrooms,bathrooms,floor_area,covered_area,land_area,parking_spaces,latitude,longitude',
  'description,features,feature_image_url,external_url,contact_name,contact_phone,created_at,source_id',
  'property_images(storage_url,is_feature,position)',
].join(',');

// Trimmed projection for the marketplace list/map/filters. It ships everything
// the cards, client-side filters and map need — but drops the heavy per-listing
// image ARRAY (the property_images join, ~16 urls/listing), description,
// features and contact_name, which the marketplace never reads. That per-listing
// weight is the bulk of the ~6MB page at a few thousand listings. shape() falls
// back to feature_image_url for the card image when the array isn't fetched.
// contact_phone is kept because the completeness gate (isCompleteListing) checks it.
const LIGHT_SELECT = [
  'id,slug,address,city,neighborhood,province,price,currency,listing_type,property_type',
  'bedrooms,bathrooms,floor_area,covered_area,land_area,parking_spaces,latitude,longitude',
  'created_at,source_id,contact_phone',
].join(',');

// Feature images for a set of ids — fetched lazily by the marketplace only for
// the cards/popups actually on screen, so the ~6MB "every image url up front"
// cost is removed from the initial page. Returns { [id]: url }.
export async function getListingImages(ids) {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return {};
  const inList = list.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
  const q = [
    'select=id,feature_image_url',
    `id=in.(${inList})`,
    'feature_image_url=not.is.null',
    `limit=${list.length}`,
  ].join('&');
  let rows = [];
  try { ({ rows } = await selectWithCount('properties', q)); } catch { rows = []; }
  const out = {};
  for (const r of rows) if (r.feature_image_url) out[r.id] = r.feature_image_url;
  return out;
}

// Features can arrive as plain strings OR as objects (e.g. RE/MAX GryphTech:
// { FeatureID, FeatureName, GroupingName }). Coerce every entry to a label
// string so nothing renders an object as a React child (React error #31).
function featureLabel(f) {
  if (f == null) return null;
  if (typeof f === 'string') return f.trim() || null;
  if (typeof f === 'object') return (f.FeatureName || f.featureName || f.name || f.label || f.feature || f.Name || f.value || '').toString().trim() || null;
  return String(f);
}

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
    features: Array.isArray(r.features) ? r.features.map(featureLabel).filter(Boolean) : [],
    external_url: r.external_url || null,
    contact_name: r.contact_name || null,
    contact_phone: r.contact_phone || null,
    // User-published listings (no source) may show the owner's own name; scraped
    // ones must NOT reveal the competitor source/agency in the public contact card.
    user_published: !r.source_id,
  };
}

// The completeness gate now lives in ./completeness (shared with the recompute
// script); imported + re-exported above.

// Buildings for the marketplace (land excluded). Newest first.
export async function getListings({ limit = 400, light = false } = {}) {
  const parts = [
    `select=${light ? LIGHT_SELECT : SELECT}`,
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
  const fx = await getFxMeta();
  const rate = fx.rate;
  // Only complete deals reach the buyer portal; `count` is the loaded/complete
  // set, `totalCount` is the exact active-inventory total from the DB (uncapped,
  // via count=exact) — shown as the real "N propiedades" instead of the load cap.
  const complete = rows.map((r) => shape(r, rate)).filter(isCompleteListing);
  return { rate, rateSource: fx.source, rateDate: fx.updated, count: complete.length, totalCount: count || complete.length, listings: complete };
}

// Exact count of marketplace-visible (complete) buildings — the SAME set the
// marketplace list shows, so the homepage "active listings" stat matches it.
// Applies the full completeness gate (not just the SQL pre-filter), but stays
// light by selecting only the columns the gate needs (no image join).
export async function getActiveCount() {
  // Exact, uncapped total via count=exact (Content-Range) — no row fetch, so it
  // is cheap AND reflects the real active inventory (not an 8k/5k cap).
  const parts = [
    'select=id',
    'admin_status=eq.active',
    'contact_phone=not.is.null',
    'price=gt.0',
    'limit=1',
    ...buildingsParts(),
  ];
  try {
    const { count } = await selectWithCount('properties', parts.join('&'));
    return count || 0;
  } catch { return 0; }
}

// ── Cached loaders ───────────────────────────────────────────────────────────
// The heavy marketplace/landing fetches run at most once per revalidate window
// (shared across all requests) instead of on every navigation — this is what
// makes clicking Buy/Rent feel instant instead of re-fetching thousands of rows.
// Marketplace browse/map set. Slimmed to ONLY the fields the list/map/filters
// read (feature images are lazy-loaded by id), which keeps the cached result
// well under Next's 2MB data-cache limit AND shrinks the payload the client
// downloads/hydrates — the two things that made Buy/Rent feel slow. The real
// inventory total rides along as totalCount.
const slimForMarketplace = (l) => ({
  id: l.id, lat: l.lat, lng: l.lng, mode: l.mode, usd: l.usd, pyg: l.pyg,
  type: l.type, city: l.city, neighborhood: l.neighborhood, address: l.address,
  province: l.province, beds: l.beds, baths: l.baths, parking: l.parking,
  area: l.area, user_published: l.user_published,
});
export const getMarketplaceListings = unstable_cache(
  async () => {
    const r = await getListings({ limit: 5000, light: true });
    return { rate: r.rate, rateSource: r.rateSource, rateDate: r.rateDate, totalCount: r.totalCount, listings: r.listings.map(slimForMarketplace) };
  },
  ['cl-marketplace-listings-v2'],
  { revalidate: 300 },
);
export const getLandingListings = unstable_cache(
  async () => getListings({ limit: 120 }),
  ['cl-landing-listings-v1'],
  { revalidate: 300 },
);
export const getActiveCountCached = unstable_cache(
  async () => getActiveCount(),
  ['cl-active-count-v1'],
  { revalidate: 600 },
);

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
