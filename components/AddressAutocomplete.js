'use client';
// Google Places autocomplete input (restricted to Paraguay). On pick it parses
// the chosen place into a standardized { neighborhood, city, address } and calls
// onSelect. Loads the Maps JS `places` library via the shared loader.
import { useEffect, useRef } from 'react';
import { loadGoogleMapsAPI } from '@/utils/googleMapsLoader';

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }) {
  const ref = useRef(null);

  useEffect(() => {
    let ac;
    let cancelled = false;
    loadGoogleMapsAPI()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.maps?.places) return;
        ac = new window.google.maps.places.Autocomplete(ref.current, {
          componentRestrictions: { country: 'py' },
          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
          types: ['geocode'],
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace() || {};
          const comp = (type) => {
            const c = (place.address_components || []).find((x) => x.types.includes(type));
            return c ? c.long_name : '';
          };
          const city = comp('locality') || comp('administrative_area_level_2') || comp('administrative_area_level_1') || 'Asunción';
          const neighborhood = comp('sublocality_level_1') || comp('neighborhood') || comp('sublocality') || comp('route') || place.name || '';
          const address = place.formatted_address || place.name || '';
          onChange?.(address);
          onSelect?.({ neighborhood, city, address });
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
