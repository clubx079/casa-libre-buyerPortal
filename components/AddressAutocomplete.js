'use client';
// Google Places autocomplete input (restricted to Paraguay). On pick it parses
// the chosen place into a standardized { neighborhood, city, address, street, lat, lng }
// (street = street + number when the place has one; lat/lng = its map position) and calls
// onSelect. A street address in Paraguay usually comes without a barrio, so then the barrio
// is looked up from the map position (Google reverse geocoding) — the seller only types it
// when Google has none for that spot. Loads the Maps JS `places` library via the shared loader.
import { useEffect, useRef } from 'react';
import { loadGoogleMapsAPI } from '@/utils/googleMapsLoader';
import { COUNTRY } from '@/lib/country';

const BARRIO_TYPES = ['sublocality_level_1', 'neighborhood', 'sublocality'];
const barrioOf = (components = []) => {
  for (const t of BARRIO_TYPES) { const c = components.find((x) => x.types.includes(t)); if (c) return c.long_name; }
  return '';
};

// The barrio at a map position (the first reverse-geocoding result that names one), or ''.
async function barrioAt(loc) {
  try {
    const { results } = await new window.google.maps.Geocoder().geocode({ location: loc });
    for (const r of results || []) { const b = barrioOf(r.address_components); if (b) return b; }
  } catch { /* no barrio → the seller types it */ }
  return '';
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }) {
  const ref = useRef(null);

  useEffect(() => {
    let ac;
    let cancelled = false;
    loadGoogleMapsAPI()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.maps?.places) return;
        ac = new window.google.maps.places.Autocomplete(ref.current, {
          componentRestrictions: { country: COUNTRY.geoCountryCode },
          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
          types: ['geocode'],
        });
        ac.addListener('place_changed', async () => {
          const place = ac.getPlace() || {};
          const comp = (type) => {
            const c = (place.address_components || []).find((x) => x.types.includes(type));
            return c ? c.long_name : '';
          };
          const city = comp('locality') || comp('administrative_area_level_2') || comp('administrative_area_level_1') || COUNTRY.capital;
          // The barrio only — never the street (it has its own field) or the place name.
          let neighborhood = barrioOf(place.address_components);
          const address = place.formatted_address || place.name || '';
          const street = [comp('route'), comp('street_number')].filter(Boolean).join(' ');
          const loc = place.geometry?.location;
          const lat = loc ? loc.lat() : null;
          const lng = loc ? loc.lng() : null;
          if (!neighborhood && loc) neighborhood = await barrioAt(loc);
          onChange?.(address);
          onSelect?.({ neighborhood, city, address, street, lat, lng });
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (ac && window.google?.maps?.event) window.google.maps.event.clearInstanceListeners(ac);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
