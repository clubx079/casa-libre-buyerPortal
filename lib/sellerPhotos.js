// Which listings show a seller photo: property id → the owner's APPROVED profile photo url
// (lib/profilePhoto.js). Attached to listings at read time, outside the long listing caches,
// so an approval or removal shows within seconds. Only sellers with an approved photo are
// looked up (a small set) and only their live listings; everyone else looks as before.
// Kept in memory for 30 s per server process; invalidated in-process when a photo changes.
import 'server-only';
import { select, selectWithCount } from './db';
import { withSellerPhotos } from './profilePhoto';
import { publicProfile, sellerInfo } from './sellerProfile';

const TTL_MS = 30_000;
let memo = { at: 0, map: new Map() };
let inflight = null;

export function invalidateSellerPhotos() { memo = { at: 0, map: new Map() }; }

async function load() {
  const users = await select('users', 'select=id,profile_photo_url&profile_photo_url=not.is.null&active=eq.true&limit=5000');
  const byUser = new Map((users || []).filter((u) => u.profile_photo_url).map((u) => [String(u.id), u.profile_photo_url]));
  const map = new Map();
  const ids = [...byUser.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const inList = ids.slice(i, i + 100).map((id) => `"${id.replace(/"/g, '')}"`).join(',');
    const props = await select('properties', `select=id,created_by&created_by=in.(${inList})&admin_status=eq.active&limit=10000`);
    for (const p of props || []) if (byUser.has(String(p.created_by))) map.set(String(p.id), byUser.get(String(p.created_by)));
  }
  return map;
}

// Never throws: before migration 021 (no column) or on a DB blip → no photos (site as before).
export async function getSellerPhotoMap() {
  if (Date.now() - memo.at < TTL_MS) return memo.map;
  if (!inflight) {
    inflight = load()
      .then((map) => { memo = { at: Date.now(), map }; return map; })
      .catch(() => { memo = { at: Date.now(), map: new Map() }; return memo.map; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export async function attachSellerPhotos(listings) {
  if (!Array.isArray(listings) || !listings.length) return listings;
  return withSellerPhotos(listings, await getSellerPhotoMap());
}

// The property page: the photo plus the seller's "Perfil profesional" (name, title, company,
// website — lib/sellerProfile.js) for the seller card, and seller_info for the "Sobre el
// vendedor" popover (member since, verified WhatsApp, active listings). Only for listings
// sellers published (scraped / agency listings never reveal their source).
export async function attachSellerPhoto(listing) {
  if (!listing) return listing;
  const [[l], seller] = await Promise.all([
    attachSellerPhotos([listing]),
    listing.user_published ? getSeller(listing.id) : null,
  ]);
  if (!seller) return l;
  return { ...l, ...(seller.profile ? { seller_profile: seller.profile } : {}), ...(seller.info ? { seller_info: seller.info } : {}) };
}

// property id → { profile, info } of its owner, 30 s per server process like the photos.
let profiles = new Map();
export function invalidateSellerProfiles() { profiles = new Map(); }

const HIDDEN = 'payment_pending,expired,scanning,rejected,duplicate_review';   // lib/listings.js HIDDEN_STATUS
const PRO_COLS = 'full_name,first_name,last_name,job_title,company_name,company_website';

async function loadSeller(propertyId) {
  const enc = encodeURIComponent;
  const [p] = await select('properties', `select=created_by&id=eq.${enc(propertyId)}&limit=1`);
  if (!p?.created_by) return null;
  const uid = enc(p.created_by);
  const base = `id=eq.${uid}&active=eq.true&limit=1`;
  // the profile columns exist only after migration 022 → fall back to the basic row
  let u;
  try { [u] = await select('users', `select=created_at,phone_verified_at,${PRO_COLS}&${base}`); }
  catch { [u] = await select('users', `select=created_at,phone_verified_at&${base}`); }
  if (!u) return null;
  let count = null;
  try {
    ({ count } = await selectWithCount('properties', `select=id&created_by=eq.${uid}&admin_status=eq.active&or=(status.is.null,status.not.in.(${HIDDEN}))&limit=1`));
  } catch { count = null; }
  return { profile: publicProfile(u), info: sellerInfo(u, count) };
}

// Never throws: on a DB blip → null (card and popover fall back to what the listing has).
export async function getSeller(propertyId) {
  if (!propertyId) return null;
  const key = String(propertyId);
  const hit = profiles.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.seller;
  let seller = null;
  try { seller = await loadSeller(key); } catch { seller = null; }
  if (profiles.size > 2000) profiles = new Map();
  profiles.set(key, { at: Date.now(), seller });
  return seller;
}

export async function getSellerProfile(propertyId) {
  return (await getSeller(propertyId))?.profile || null;
}

// Map pins carry it as `sp` (short: 8,000 pins per response).
export async function attachPinPhotos(pins) {
  const map = await getSellerPhotoMap();
  if (!map.size || !Array.isArray(pins)) return pins;
  return pins.map((p) => (map.has(String(p.id)) ? { ...p, sp: map.get(String(p.id)) } : p));
}

// A searchListings() page ({ listings, ... }) with seller photos — used after the caches.
export async function withSellerPhotosPage(res) {
  if (!res || !Array.isArray(res.listings)) return res;
  return { ...res, listings: await attachSellerPhotos(res.listings) };
}
