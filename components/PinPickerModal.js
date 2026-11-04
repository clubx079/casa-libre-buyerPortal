'use client';
// "Confirmá la ubicación": a map with one pin the seller drags (or taps the map) onto their
// property. Opens at our best guess (their neighbourhood or city centre). Used by the sell /
// edit wizard (components/SellFlow.js) when Google couldn't find the exact address in the city
// they typed, and from the "Ajustar en el mapa" link. Only the pin changes — never the
// neighbourhood or city the seller typed.
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsAPI, mapOptions } from '@/utils/gmap';
import { km, FAR_KM } from '@/lib/pinLocate';

export default function PinPickerModal({ open, start, zoom = 16, expected, city, t, onConfirm, onClose }) {
  const box = useRef(null);
  const [pos, setPos] = useState(start);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !start) return undefined;
    setPos(start); setFailed(false);
    let marker; let map; let alive = true;
    loadGoogleMapsAPI().then(() => {
      if (!alive || !box.current || !window.google?.maps) return;
      const g = window.google;
      map = new g.maps.Map(box.current, mapOptions(g, { center: start, zoom, gestureHandling: 'greedy', mapTypeControl: false, streetViewControl: false }));
      marker = new g.maps.Marker({ position: start, map, draggable: true });
      const move = (ll) => { const p = { lat: ll.lat(), lng: ll.lng() }; marker.setPosition(p); setPos(p); };
      marker.addListener('dragend', (e) => move(e.latLng));
      map.addListener('click', (e) => move(e.latLng));
    }).catch(() => setFailed(true));
    return () => { alive = false; if (marker) marker.setMap(null); };
  }, [open, start?.lat, start?.lng, zoom]);

  if (!open) return null;
  const far = expected && pos && km(expected, pos) > FAR_KM;
  return (
    <div className="fixed inset-0 z-[1100] bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" data-testid="pin-picker">
      <div className="bg-paper w-full sm:max-w-[560px] sm:rounded-[20px] rounded-t-[20px] overflow-hidden flex flex-col h-[92vh] sm:h-[620px]">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[19px] font-bold tracking-head">{t.pinTitle}</h3>
          <p className="text-[13px] text-ink/60 mt-1">{t.pinHelp}</p>
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
