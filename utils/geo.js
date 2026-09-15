// Pure geo helpers (no Google Maps / no DOM) so they're unit-testable and can be
// imported anywhere. Country-agnostic — callers pass the user's real coords and
// use COUNTRY.mapCenter as the fallback.

// Great-circle distance in kilometres between two lat/lng points (haversine).
// Returns a Number (km). Inputs are degrees.
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // mean Earth radius (km)
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Default "near me" radius (km) shared by desktop + mobile marketplace.
export const NEAR_RADIUS_KM = 10;

// Promise wrapper around navigator.geolocation.getCurrentPosition that never
// rejects — resolves to { lat, lng } on success, or null if geolocation is
// unavailable / denied / times out. Safe to call from an event handler.
export function getUserLocation() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}
