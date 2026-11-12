// Which listings show a seller photo: property id → the owner's APPROVED profile photo url
// (lib/profilePhoto.js). Attached to listings at read time, outside the long listing caches,
// so an approval or removal shows within seconds. Only sellers with an approved photo are
// looked up (a small set) and only their live listings; everyone else looks as before.
// Kept in memory for 30 s per server process; invalidated in-process when a photo changes.
import 'server-only';
import { select } from './db';
import { withSellerPhotos } from './profilePhoto';

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

export async function attachSellerPhoto(listing) {
  if (!listing) return listing;
  const [l] = await attachSellerPhotos([listing]);
  return l;
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
