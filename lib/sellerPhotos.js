// Which listings show a seller photo: property id → the owner's APPROVED profile photo url
// (lib/profilePhoto.js). Attached to listings at read time, outside the long listing caches,
// so an approval or removal shows within seconds. Only sellers with an approved photo are
// looked up (a small set) and only their live listings; everyone else looks as before.
// Kept in memory for 30 s per server process; invalidated in-process when a photo changes.
import 'server-only';
import { select } from './db';
import { withSellerPhotos } from './profilePhoto';
import { publicProfile } from './sellerProfile';

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
// website — lib/sellerProfile.js) for the seller card. Only for listings sellers published.
export async function attachSellerPhoto(listing) {
  if (!listing) return listing;
  const [[l], profile] = await Promise.all([
    attachSellerPhotos([listing]),
    listing.user_published ? getSellerProfile(listing.id) : null,
  ]);
  return profile ? { ...l, seller_profile: profile } : l;
}

// property id → the owner's public profile (or null), 30 s per server process like the photos.
let profiles = new Map();
export function invalidateSellerProfiles() { profiles = new Map(); }

async function loadSellerProfile(propertyId) {
  const enc = encodeURIComponent;
  const [p] = await select('properties', `select=created_by&id=eq.${enc(propertyId)}&limit=1`);
  if (!p?.created_by) return null;
  const [u] = await select('users', `select=first_name,last_name,job_title,company_name,company_website&id=eq.${enc(p.created_by)}&active=eq.true&limit=1`);
  return publicProfile(u || null);
}

// Never throws: before migration 022 (no columns) or on a DB blip → null (card as before).
export async function getSellerProfile(propertyId) {
  if (!propertyId) return null;
  const key = String(propertyId);
  const hit = profiles.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.profile;
  let profile = null;
  try { profile = await loadSellerProfile(key); } catch { profile = null; }
  if (profiles.size > 2000) profiles = new Map();
  profiles.set(key, { at: Date.now(), profile });
  return profile;
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
