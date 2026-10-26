// What a seller types in the sell form that the publish API saves as is (after these
// checks): the street + number, the map position picked from the address list, and
// bedrooms / bathrooms. Pure — test/listingInput.test.js.
import { normalizeTypeKey } from './propertyTypeOptions.js';

// Types that have bedrooms and bathrooms (not land, shops, offices, warehouses…).
const ROOMY = new Set(['casa', 'depto', 'duplex', 'condominio']);
export const hasRooms = (ptype) => ROOMY.has(normalizeTypeKey(ptype));

// "Mcal. López 1234" — the street and number. Before this field the API saved the
// neighborhood as the address, so every owner listing's address was its barrio.
// Empty, too short, or the same text as the neighborhood/city → null (no street given).
export function cleanStreet(v, { neighborhood = '', city = '' } = {}) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (s.length < 3) return null;
  const same = (x) => String(x || '').trim().toLowerCase() === s.toLowerCase();
  return same(neighborhood) || same(city) ? null : s;
}

// Bedrooms / bathrooms: a whole number 0–50, else null.
export function roomCount(v) {
  const s = String(v ?? '').trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n <= 50 ? n : null;
}

// A map position inside the country's rough box (lat −90…90, lng −180…180, not 0,0).
export function cleanCoords(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (String(lat ?? '').trim() === '' || String(lng ?? '').trim() === '') return null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) return null;
  return { lat: a, lng: b };
}
