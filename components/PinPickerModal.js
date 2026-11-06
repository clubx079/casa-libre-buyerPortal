'use client';
// "Confirmá la ubicación": a map with one pin the seller drags (or taps the map) onto their
// property. Opens at our best guess (their neighbourhood or city centre). Used by the sell /
// edit wizard (components/SellFlow.js) when Google couldn't find the exact address in the city
// they typed, and from the "Ajustar en el mapa" link. Only the pin changes — never the
// neighbourhood or city the seller typed.
// A search box on top (Google Places, this country only, favouring what's on the map): pick a
// street, a place or a landmark and the map + pin jump there; the seller can still drag the pin
// or tap the map to fine-tune it.
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsAPI, mapOptions } from '@/utils/gmap';
import { km, FAR_KM } from '@/lib/pinLocate';
import { COUNTRY } from '@/lib/country';

export default function PinPickerModal({ open, start, zoom = 16, expected, city, t, onConfirm, onClose }) {
  const box = useRef(null);
  const search = useRef(null);
  const [pos, setPos] = useState(start);
  const [q, setQ] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !start) return undefined;
    setPos(start); setFailed(false); setQ('');
    let marker; let map; let ac; let alive = true;
    loadGoogleMapsAPI().then(() => {
      if (!alive || !box.current || !window.google?.maps) return;
      const g = window.google;
      map = new g.maps.Map(box.current, mapOptions(g, { center: start, zoom, gestureHandling: 'greedy', mapTypeControl: false, streetViewControl: false }));
      marker = new g.maps.Marker({ position: start, map, draggable: true });
      const move = (ll) => { const p = { lat: ll.lat(), lng: ll.lng() }; marker.setPosition(p); setPos(p); };
      marker.addListener('dragend', (e) => move(e.latLng));
      map.addListener('click', (e) => move(e.latLng));
      // search: the place's spot becomes the pin (then drag to fine-tune)
      if (search.current && g.maps.places) {
        ac = new g.maps.places.Autocomplete(search.current, {
          componentRestrictions: { country: COUNTRY.geoCountryCode },
          fields: ['geometry', 'name', 'formatted_address'],
        });
        ac.bindTo('bounds', map);   // favour places near what the map shows
        ac.addListener('place_changed', () => {
          const place = ac.getPlace() || {};
          const loc = place.geometry?.location;
          if (!loc) return;
          if (place.geometry.viewport && !place.geometry.viewport.isEmpty?.()) map.fitBounds(place.geometry.viewport);
          map.setCenter(loc);
          if (map.getZoom() < 16 || map.getZoom() > 18) map.setZoom(17);
          move(loc);
          setQ(place.name || place.formatted_address || '');   // the place's name (no plus codes)
        });
      }
    }).catch(() => setFailed(true));
    return () => {
      alive = false;
      if (marker) marker.setMap(null);
      if (ac && window.google?.maps?.event) window.google.maps.event.clearInstanceListeners(ac);
    };
  }, [open, start?.lat, start?.lng, zoom]);

  if (!open) return null;
  const far = expected && pos && km(expected, pos) > FAR_KM;
  return (
    <div className="fixed inset-0 z-[1100] bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" data-testid="pin-picker">
      <div className="bg-paper w-full sm:max-w-[560px] sm:rounded-[20px] rounded-t-[20px] overflow-hidden flex flex-col h-[92vh] sm:h-[620px]">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[19px] font-bold tracking-head">{t.pinTitle}</h3>
          <p className="text-[13px] text-ink/60 mt-1">{t.pinHelp}</p>
          <div className="relative mt-3">
            <svg aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              placeholder={t.pinSearchPh || 'Buscá una dirección o un lugar'} autoComplete="off" enterKeyHint="search"
              className="w-full pl-10 pr-9 py-2.5 rounded-input border border-ink/20 bg-card text-[14px] outline-none focus:border-ink/60" data-testid="pin-search" />
            {q ? <button type="button" onClick={() => { setQ(''); search.current?.focus(); }} aria-label="Borrar" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-ink/50 hover:bg-ink/5">×</button> : null}
          </div>
        </div>
        <div className="relative flex-1 bg-card">
          <div ref={box} className="absolute inset-0" />
          {failed ? <p className="absolute inset-0 flex items-center justify-center text-[13px] text-ink/60 px-6 text-center">{t.pinMapError}</p> : null}
        </div>
        <div className="px-5 py-4 border-t border-ink/10">
          {far ? <p className="text-[13px] font-medium text-red-600 mb-3" data-testid="pin-far">{t.pinFar(city)}</p> : null}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-pill border-[1.5px] border-ink/30 font-bold text-[14px]">{t.pinCancel}</button>
            <button type="button" onClick={() => onConfirm(pos)} disabled={!pos || failed} className="flex-[2] py-3 rounded-pill bg-ink text-paper font-bold text-[14px] disabled:opacity-50" data-testid="pin-confirm">{t.pinConfirm}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
