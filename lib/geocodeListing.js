// The listing's map pin when the form sent no position: OpenStreetMap Nominatim, best
// effort (never throws — a listing without coords still shows in the list). Used by
// /api/publish and /api/account/listings/edit.
import { COUNTRY } from './country';

// Best-effort geocode via OpenStreetMap Nominatim so the listing gets a map pin.
// Never throws — a listing without coords still shows in the list. Tries the
// most specific query first, then falls back to the city.
async function geocodeOne(q) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=${COUNTRY.geoCountryCode}&q=${encodeURIComponent(q)}`,
      { signal: ctrl.signal, cache: 'no-store', headers: { 'User-Agent': `CasaLibre/1.0 (listings@casalibre${COUNTRY.tld})` } }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    if (Array.isArray(j) && j[0]) return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
  } catch {}
  return null;
}
export async function geocode(neighborhood, city, street = null) {
  const queries = [...(street ? [`${street}, ${city}, ${COUNTRY.name}`] : []), `${neighborhood}, ${city}, ${COUNTRY.name}`, `${city}, ${COUNTRY.name}`];
  for (const q of queries) { const hit = await geocodeOne(q); if (hit) return hit; }
  return null;
}
