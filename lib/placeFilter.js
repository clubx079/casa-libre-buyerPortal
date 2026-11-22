// A place picked from the search suggestions (lib/places.js) → the PostgREST filter for
// "the listings in that barrio / city / departamento". Pure, so `npm test` runs it.
//
// The place index knows which listings belong to a place, but sending thousands of ids
// would not fit in a URL. So the filter is: the place's name as stored (each spelling seen,
// accent-insensitive) in the columns that name it, AND inside the place's box (outliers
// dropped, lib/areaGeom.js) — which keeps "Las Mercedes" of San Lorenzo out of Asunción's
// Las Mercedes. The few listings of the place that sit outside its box (a bad geocode)
// are added back by id, and listings without coordinates are kept.
import { searchBounds } from './areaGeom.js';

// Geocoder fallbacks: where an address lands when only the country is recognised (Google's
// centre of Paraguay). Pins there are hidden from the map (2026-11-13: 39 PY listings).
export const UNKNOWN_SPOTS = { py: [{ lat: -23.442503, lng: -58.443832 }] };
export const atUnknownSpot = (code, lat, lng) => (UNKNOWN_SPOTS[code] || []).some((c) => Math.abs(lat - c.lat) <= 0.002 && Math.abs(lng - c.lng) <= 0.002);

const MAX_SPELLINGS = 6;
const MAX_EXTRA_IDS = 40;

// The DB columns that can name a place of this kind.
export function placeColumns(place) {
  if (!place) return [];
  if (place.kind === 'barrio') return ['neighborhood', 'city', 'address'];
  // In the capital most listings carry the barrio in `city` and the capital in `province`.
  if (place.kind === 'city') return place.capital ? ['city', 'province', 'neighborhood', 'address'] : ['city', 'address'];
  // A departamento only ever comes from the province column (lib/places.js rawPlace).
  return ['province'];
}

// `regexOf` = the accent-insensitive pattern builder (lib/marketplace.js accentRegex).
// Returns PostgREST query parts (each one an `or=(…)`, ANDed together), [] without a place.
export function placeParts(place, regexOf) {
  if (!place || !place.name) return [];
  const pats = [];
  for (const s of [...(place.raw || []), place.name]) {
    const r = s ? regexOf(s) : '';
    if (r && r.trim().length >= 2 && !pats.includes(r)) pats.push(r);
    if (pats.length >= MAX_SPELLINGS) break;
  }
  const cols = placeColumns(place);
  const parts = [`or=(${cols.flatMap((c) => pats.map((r) => `${c}.imatch.${encodeURIComponent(r)}`)).join(',')})`];
  // The capital is no part of the departamento around it ("Asunción, Central" counts as
  // Asunción in the index), so a departamento leaves the capital's listings out.
  if (place.kind === 'dept' && place.notCity) parts.push(`or=(city.is.null,city.not.imatch.${encodeURIComponent(regexOf(place.notCity))})`);
  const pts = place.pts || [];
  const b = pts.length ? searchBounds(pts, place.kind) : null;
  if (b) {
    const f = (v) => Number(v.toFixed(5));
    const s = f(b.s - 0.0005), n = f(b.n + 0.0005), w = f(b.w - 0.0005), e = f(b.e + 0.0005);
    const outside = pts.filter((p) => p[2] != null && (p[0] < s || p[0] > n || p[1] < w || p[1] > e)).map((p) => String(p[2]));
    const loc = ['latitude.is.null', `and(latitude.gte.${s},latitude.lte.${n},longitude.gte.${w},longitude.lte.${e})`];
    if (outside.length) loc.push(`id.in.(${[...new Set(outside)].slice(0, MAX_EXTRA_IDS).map((id) => encodeURIComponent(`"${id.replace(/"/g, '')}"`)).join(',')})`);
    parts.push(`or=(${loc.join(',')})`);
  } else if (place.kind === 'barrio' && place.city) {
    // No located listing to draw a box from: the barrio's city must be named too, so
    // "Centro" of Capiatá is not every "Centro".
    const c = encodeURIComponent(regexOf(place.city));
    parts.push(`or=(city.imatch.${c},province.imatch.${c},address.imatch.${c})`);
  }
  return parts;
}
