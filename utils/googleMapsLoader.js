// Shared Google Maps API loader (single load, dedup across components).
// Matches DeelMap's setup so both sites use the same Google basemap.
let mapsApiLoadPromise = null;

// Public (client-exposed) Maps JS key. Prefer the env var; fall back to the
// shared key so the map works without an env change. NOTE: this key is
// referrer-restricted in Google Cloud — casa-libre.com.py (and the
// *.apps.airosofts.com preview host) must be added to the key's allowed
// referrers, or Google returns RefererNotAllowedMapError.
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyBRMxUxsq4taEGbcelOv-IvlJk6R36IbLA';

export const loadGoogleMapsAPI = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (mapsApiLoadPromise) return mapsApiLoadPromise;

  mapsApiLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      if (window.google?.maps) return resolve();
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps API')));
      return;
    }
    const script = document.createElement('script');
    // `marker` = Advanced Markers (HTML pin content, used by the property maps);
    // `places` = address autocomplete.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
  });
  return mapsApiLoadPromise;
};
