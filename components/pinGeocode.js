'use client';
// Finds the map pin for what the seller typed (street + neighbourhood + city), in the browser.
//   → { lat, lng, exact, level }   level: 'street' | 'area' | 'city'
//   exact = Google found a real street/building inside their city → no need to ask them.
//   Otherwise the best guess to open the map at: the neighbourhood (Google, then OpenStreetMap),
//   else the city centre. null = nothing found (the map then opens at the old pin / the country).
// The rules (what counts as exact, same city…) are in lib/pinLocate.js.
import { loadGoogleMapsAPI } from '@/utils/googleMapsLoader';
import { COUNTRY } from '@/lib/country';
import { plainResult, exactIn, areaIn, cityIs, samePlace, fold } from '@/lib/pinLocate';

async function google(address) {
  try {
    await loadGoogleMapsAPI();
    const { results } = await new window.google.maps.Geocoder().geocode({ address, componentRestrictions: { country: COUNTRY.geoCountryCode } });
    return (results || []).map(plainResult);
  } catch { return []; }
}

// OpenStreetMap knows many Paraguayan barrios Google doesn't. Accepted only inside their city.
async function osm(neighborhood, city) {
  try {
    const q = `${neighborhood}, ${city}, ${COUNTRY.name}`;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=3&countrycodes=${COUNTRY.geoCountryCode}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    for (const h of await res.json()) {
      const a = h.address || {};
      const inCity = [a.city, a.town, a.village, a.municipality, a.county].some((c) => samePlace(c, city));
      const isBarrio = [a.quarter, a.suburb, a.neighbourhood, a.city_district, h.name].some((n) => samePlace(n, neighborhood));
      if (inCity && isBarrio) return { lat: Number(h.lat), lng: Number(h.lon) };
    }
  } catch { /* nothing from OpenStreetMap */ }
  return null;
}

export async function locatePin({ street, neighborhood, city }) {
  if (!fold(city)) return null;
  // 1) the street, in the neighbourhood and city they typed → exact only if Google puts it in that city
  if (fold(street)) {
    const hit = (await google([street, neighborhood, city].filter(Boolean).join(', '))).find((r) => exactIn(r, city));
    if (hit) return { lat: hit.lat, lng: hit.lng, exact: true, level: 'street' };
  }
  // 2) their neighbourhood: Google, then OpenStreetMap
  if (fold(neighborhood)) {
    const area = (await google(`${neighborhood}, ${city}`)).find((r) => areaIn(r, city));
    if (area) return { lat: area.lat, lng: area.lng, exact: false, level: 'area' };
    const o = await osm(neighborhood, city);
    if (o) return { ...o, exact: false, level: 'area' };
  }
  // 3) the city centre
  const c = (await google(city)).find((r) => cityIs(r, city));
  if (c) return { lat: c.lat, lng: c.lng, exact: false, level: 'city' };
  return null;
}
