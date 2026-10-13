// Instant duplicate check at publish (/api/publish). A new listing is held as a possible
// duplicate of one of the SAME account's listings when BOTH are true:
//   1. every detail is exactly the same (lib/automations/duplicateListings.js fingerprint:
//      sale/rent, type, price, currency, neighbourhood, city, areas, rooms, phone,
//      description), and
//   2. half or more of the new listing's photos are the same photos as that listing's
//      (picture fingerprints, lib/photoHash.js — a re-saved / resized / stamped copy of a
//      photo still matches; a different photo of the same house does not).
// The held copy is NOT published: status 'duplicate_review', shown to the owner as
// "Under review — possible duplicate", held in the admin Quarantine (reason 'duplicate',
// "Approve anyway" publishes it) and the owner is emailed right away. Pure parts here;
// DB/photos injected — tests/duplicateCheck.test.mjs.
import { fingerprint } from './automations/duplicateListings.js';

export const DUPLICATE_STATUS = 'duplicate_review';
export const SAME_PHOTO_MAX_DISTANCE = 10;   // of 64 bits

const BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += BITS[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

// How many of the new photos match one of the old ones.
export function matchingPhotos(newHashes = [], oldHashes = [], max = SAME_PHOTO_MAX_DISTANCE) {
  const old = oldHashes.filter(Boolean);
  return newHashes.filter((h) => h && old.some((o) => hamming(h, o) <= max)).length;
}

// Half or more of the new listing's photos are the same. No photos at all → the details alone decide.
export const enoughSamePhotos = (matched, total) => total === 0 || matched * 2 >= total;

export const DUP_COLS = 'id,created_by,created_at,status,raw_data,listing_type,property_type,price,currency,neighborhood,city,covered_area,land_area,floor_area,bedrooms,bathrooms,parking_spaces,contact_phone,description';

// → { id, matched, total } of the oldest listing of this account that the new one
// duplicates, or null. newRow = the listing about to be saved; newHashes = its photos'
// fingerprints; photoHashesOf(listing) → that listing's photo fingerprints.
export async function findDuplicateOf({ select, uid, newRow, newHashes = [], photoHashesOf }) {
  if (!uid) return null;
  const mine = await select('properties', `select=${DUP_COLS}&origin=eq.user&created_by=eq.${encodeURIComponent(uid)}&order=created_at.asc&limit=500`);
  const fp = fingerprint(newRow);
  const sameDetails = mine.filter((p) => fingerprint(p) === fp);
  const hashes = newHashes.filter(Boolean);
  for (const p of sameDetails) {
    const old = await photoHashesOf(p).catch(() => []);
    const matched = matchingPhotos(hashes, old);
    if (enoughSamePhotos(matched, hashes.length)) return { id: p.id, matched, total: hashes.length, listing: p, count: sameDetails.length + 1 };
  }
  return null;
}
