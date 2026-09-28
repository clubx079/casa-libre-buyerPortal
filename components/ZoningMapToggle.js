'use client';
// "Zonificación" map layer — button + legend + the hook that puts Asunción's
// zoning (pre-rendered tiles in our colours, see utils/zoningOverlay) on/off the
// Google map held in mapRef ({ google, map }). Shared by the desktop and mobile web
// marketplace. The button shows a spinner while tiles download, a check when drawn.
import { useEffect, useRef, useState } from 'react';
import { addZoningOverlay, ZONE_COLORS, ZONE_CATEGORIES } from '@/utils/zoningOverlay';

// height: the filter's pick ('all' | 'baja' | 'media' | 'alta') — when set, only that group is drawn.
// Returns true while zoning tiles are still loading.
export function useZoningOverlay(mapRef, on, height = 'all') {
  const layer = useRef(null);   // { map, key, handle }
  const [loading, setLoading] = useState(false);
  const key = ZONE_CATEGORIES.includes(height) ? height : 'all';
  useEffect(() => {
    let timer;
    const sync = (tries = 0) => {
      const ref = mapRef.current;
      if (on && !ref) { if (tries < 20) timer = setTimeout(() => sync(tries + 1), 300); return; }   // map still loading
      const categories = key === 'all' ? ZONE_CATEGORIES : [key];
      if (layer.current && (!on || layer.current.map !== ref?.map)) { layer.current.handle.remove(); layer.current = null; setLoading(false); }
      if (on && ref && layer.current && layer.current.key !== key) { layer.current.handle.setCategories(categories); layer.current.key = key; }
      if (on && ref && !layer.current) {
        setLoading(true);
        layer.current = { map: ref.map, key, handle: addZoningOverlay(ref.google, ref.map, { categories, onLoading: setLoading }) };
      }
    };
    sync();
    return () => clearTimeout(timer);
  }, [mapRef, on, key]);
  return on && loading;
}

const TXT = {
  es: { btn: 'Zonificación', title: 'Altura permitida · Asunción', rows: { baja: 'Baja · hasta 4 pisos', media: 'Media · 5–6 pisos', alta: 'Alta · 7+ pisos' } },
  en: { btn: 'Zoning', title: 'Allowed height · Asunción', rows: { baja: 'Low · up to 4 floors', media: 'Mid · 5–6 floors', alta: 'High · 7+ floors' } },
};

const Check = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const Layers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 8.5 12 14l10-5.5L12 3Z" /><path d="m2 15.5 10 5.5 10-5.5" /></svg>
);
const Spinner = () => (
  <span className="w-[13px] h-[13px] rounded-full border-2 border-current/30 border-t-current animate-spin" aria-hidden="true" data-testid="zoning-spinner" />
);

export default function ZoningMapToggle({ on, onToggle, height = 'all', loading = false, lang = 'es', className = '' }) {
  const t = TXT[lang === 'en' ? 'en' : 'es'];
  const shown = ZONE_CATEGORIES.includes(height) ? [height] : ZONE_CATEGORIES;
  return (
    <div className={`flex flex-col items-end gap-2 ${className}`}>
      <button
        type="button" onClick={onToggle} aria-pressed={on} aria-busy={on && loading}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-[12.5px] font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.3)] active:translate-y-px transition-colors ${on ? 'bg-ink text-paper ring-2 ring-paper' : 'bg-white text-ink'}`}
      >
        {on ? (loading ? <Spinner /> : <Check />) : <Layers />}{t.btn}
      </button>
      {on && (
        <div className="w-[176px] md:w-[210px] bg-paper/95 rounded-[12px] border border-ink/15 shadow-[0_2px_10px_rgba(0,0,0,0.15)] px-2.5 py-2 md:p-3">
          <div className="text-[10.5px] md:text-[12px] font-bold text-ink mb-1">{t.title}</div>
          <ul className="flex flex-col gap-0.5 md:gap-1">
            {shown.map((c) => (
              <li key={c} className="flex items-center gap-1.5 md:gap-2 text-[10.5px] md:text-[11.5px] text-ink/80">
                <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-[3px] flex-none" style={{ background: ZONE_COLORS[c], opacity: 0.85 }} />{t.rows[c]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
