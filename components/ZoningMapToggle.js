'use client';
// "Zonificación" map layer — button + legend + the hook that puts Asunción's
// Plan Regulador tiles on/off the Google map held in mapRef ({ google, map }).
// Shared by the desktop marketplace and the mobile web marketplace.
import { useEffect, useRef } from 'react';
import { addZoningOverlay } from '@/utils/zoningOverlay';

export function useZoningOverlay(mapRef, on) {
  const layer = useRef(null);   // { map, handle }
  useEffect(() => {
    let timer;
    const sync = (tries = 0) => {
      const ref = mapRef.current;
      if (on && !ref) { if (tries < 20) timer = setTimeout(() => sync(tries + 1), 300); return; }   // map still loading
      if (layer.current && (!on || layer.current.map !== ref?.map)) { layer.current.handle.remove(); layer.current = null; }
      if (on && ref && !layer.current) layer.current = { map: ref.map, handle: addZoningOverlay(ref.google, ref.map) };
    };
    sync();
    return () => clearTimeout(timer);
  }, [mapRef, on]);
}

const TXT = {
  es: {
    btn: 'Zonificación', title: 'Zonificación · Asunción',
    legend: [['#f2d64b', 'Residencial (casas y edificios bajos)'], ['#e8902e', 'Residencial alta densidad'], ['#b8323a', 'Centro y franjas mixtas (edificios altos)'], ['#c04fc8', 'Industrial'], ['#5aa05a', 'Parques y áreas verdes']],
    note: 'Lo que la zona permite construir, no lo ya construido. Fuente: Plan Regulador de Asunción (Ord. 163/18). Verificá con la Municipalidad.',
  },
  en: {
    btn: 'Zoning', title: 'Zoning · Asunción',
    legend: [['#f2d64b', 'Residential (houses, low buildings)'], ['#e8902e', 'High-density residential'], ['#b8323a', 'Centre and mixed-use strips (tall buildings)'], ['#c04fc8', 'Industrial'], ['#5aa05a', 'Parks and green areas']],
    note: 'What the zone allows to be built, not what is built. Source: Asunción Plan Regulador (Ord. 163/18). Check with the municipality.',
  },
};

export default function ZoningMapToggle({ on, onToggle, lang = 'es', className = '' }) {
  const t = TXT[lang === 'en' ? 'en' : 'es'];
  return (
    <div className={`flex flex-col items-end gap-2 ${className}`}>
      <button
        type="button" onClick={onToggle} aria-pressed={on}
        className={`px-3.5 py-2 rounded-pill text-[12.5px] font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.3)] active:translate-y-px ${on ? 'bg-ink text-paper' : 'bg-white text-ink'}`}
      >
        {t.btn}
      </button>
      {on && (
        <div className="w-[250px] max-w-[70vw] bg-paper/95 rounded-[14px] border border-ink/15 shadow-[0_2px_10px_rgba(0,0,0,0.15)] p-3">
          <div className="text-[12px] font-bold text-ink mb-1.5">{t.title}</div>
          <ul className="flex flex-col gap-1">
            {t.legend.map(([c, label]) => (
              <li key={label} className="flex items-center gap-2 text-[11.5px] text-ink/75">
                <span className="w-3 h-3 rounded-[3px] flex-none border border-ink/10" style={{ background: c }} />{label}
              </li>
            ))}
          </ul>
          <p className="text-[10.5px] leading-snug text-ink/50 mt-2">{t.note}</p>
        </div>
      )}
    </div>
  );
}
