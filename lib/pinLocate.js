// Where a listing's map pin comes from, and when the seller has to place it on the map.
//   google  Google found the address the seller picked (or typed) as a real street/building
//           inside the city they say → used as is, nobody is asked.
//   owner   the seller placed it on the map (Confirmá la ubicación).
//   approx  we only know the neighbourhood or the city (its centre) and the seller didn't
//           place it → the listing is published with it and the team can fix it.
// Pure (no Google, no fetch): the browser side is components/pinGeocode.js.
// Tests: tests/pinLocate.test.mjs.

export const PIN_SOURCES = ['google', 'owner', 'approx'];
export const cleanPinSource = (v) => (PIN_SOURCES.includes(String(v || '')) ? String(v) : null);

// "Barrio San Pedro" ≈ "san pedro", "Encarnación" ≈ "encarnacion"
export function fold(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(barrio|bo|b|ciudad de|ciudad|distrito de|distrito) /, '')
    .trim();
}
// Same city / same neighbourhood (accents, case and "Barrio …" don't matter)
export function samePlace(a, b) {
  const x = fold(a); const y = fold(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x)));
}

// Did the seller change the neighbourhood or the city Google gave for the address they picked?
export function changedFromGoogle(geo, { neighborhood, city } = {}) {
  if (!geo) return true;
  return !samePlace(geo.city, city) || fold(geo.neighborhood) !== fold(neighborhood);
}

// Google result types that mean "a real street or building" (not a city, region or area)
// (never a shop or business: Google answers a vague text with the nearest store, which is not their house)
const STREET_TYPES = new Set(['street_address', 'premise', 'subpremise', 'route', 'intersection']);
export const isStreetLevel = (types = []) => (types || []).some((t) => STREET_TYPES.has(t));
const AREA_TYPES = new Set(['neighborhood', 'sublocality', 'sublocality_level_1', 'sublocality_level_2', 'colloquial_area']);
export const isArea = (types = []) => (types || []).some((t) => AREA_TYPES.has(t));

// The city of a Google result (same order as the address picker)
export function cityOf(components = []) {
  for (const t of ['locality', 'administrative_area_level_2', 'administrative_area_level_1']) {
    const c = (components || []).find((x) => (x.types || []).includes(t));
    if (c) return c.long_name;
  }
  return '';
}

// A Google geocoding result as a plain object (the Maps JS API gives lat()/lng() functions)
export function plainResult(r) {
  if (!r) return null;
  const loc = r.geometry?.location;
  const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
  const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;
  return { types: r.types || [], components: r.address_components || [], lat: Number(lat), lng: Number(lng) };
}

// Is this result the exact place of what the seller typed? A real street/building, inside their city.
export const exactIn = (r, city) => !!r && Number.isFinite(r.lat) && isStreetLevel(r.types) && samePlace(cityOf(r.components), city);
// Is it their neighbourhood, inside their city?
export const areaIn = (r, city) => !!r && Number.isFinite(r.lat) && isArea(r.types) && samePlace(cityOf(r.components), city);
// Is it their city?
export const cityIs = (r, city) => !!r && Number.isFinite(r.lat) && samePlace(cityOf(r.components), city);

// Kilometres between two points
export function km(a, b) {
  if (!a || !b) return 0;
  const R = 6371; const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// A pin placed further than this from where we expected the city → "are you sure?"
export const FAR_KM = 15;
// How close the map opens: a neighbourhood centre → street level; only the city → the whole city
export const zoomFor = (level) => (level === 'street' ? 17 : level === 'area' ? 16 : level === 'country' ? 6 : 13);
