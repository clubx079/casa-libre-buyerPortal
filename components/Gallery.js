'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/useLang';

// Compact carousel gallery: ONE main image at a fixed height (page doesn't grow
// with photo count) + arrows + a slim thumbnail strip. Click opens a full-screen
// lightbox with the full set.
export default function Gallery({ images = [], noImg = 'Foto próximamente' }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState(false);
  const [lang] = useLang();
  const n = images.length;
  const stripRef = useRef(null);
  const L = lang === 'en'
    ? { viewAll: (k) => `View all photos (${k})`, close: 'Close', count: (k) => `${k} photos` }
    : { viewAll: (k) => `Ver todas las fotos (${k})`, close: 'Cerrar', count: (k) => `${k} fotos` };

  const go = (d) => setI((x) => (x + d + n) % n);
  const at = (k) => setI(((k % n) + n) % n);

  useEffect(() => {
    if (!open && !grid) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); setGrid(false); }
      if (open && e.key === 'ArrowRight') go(1);
      if (open && e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, grid, n]);

  // keep active thumbnail in view
  useEffect(() => {
    const el = stripRef.current?.children?.[i];
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [i]);

  if (!n) {
    return <div className="h-[280px] md:h-[420px] cl-hatch rounded-card grid place-items-center font-mono text-sm text-ink/40">{noImg}</div>;
  }

  const Arrow = ({ d, cls }) => (
    <button
      onClick={(e) => { e.stopPropagation(); go(d); }}
      aria-label={d < 0 ? 'Anterior' : 'Siguiente'}
      className={`absolute top-1/2 -translate-y-1/2 ${cls} w-10 h-10 rounded-full bg-paper/85 hover:bg-paper text-ink grid place-items-center text-xl shadow-hard-soft`}
    >{d < 0 ? '‹' : '›'}</button>
  );

  return (
    <>
      <div>
        {/* main */}
        <div className="relative h-[280px] md:h-[420px] cl-hatch rounded-card overflow-hidden select-none">
          <button onClick={() => setOpen(true)} className="block w-full h-full" aria-label="Ampliar foto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[i]} alt="" className="w-full h-full object-cover" />
          </button>
          {n > 1 && <Arrow d={-1} cls="left-3" />}
          {n > 1 && <Arrow d={1} cls="right-3" />}
          <span className="absolute bottom-3 right-3 text-[11px] font-semibold bg-ink/80 text-paper px-2.5 py-1 rounded-pill pointer-events-none">{i + 1} / {n}</span>
          {n > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setGrid(true); }}
              className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 text-[11px] font-semibold bg-paper/90 hover:bg-paper text-ink px-3 py-1.5 rounded-pill shadow-hard-soft"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="0" y="0" width="5" height="5" rx="1" /><rect x="7" y="0" width="5" height="5" rx="1" /><rect x="0" y="7" width="5" height="5" rx="1" /><rect x="7" y="7" width="5" height="5" rx="1" /></svg>
              {L.viewAll(n)}
            </button>
          )}
        </div>

        {/* slim thumbnail strip */}
        {n > 1 && (
          <div ref={stripRef} className="flex gap-2 mt-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {images.map((im, k) => (
              <button key={k} onClick={() => at(k)} className={`shrink-0 w-[68px] h-[52px] rounded-input overflow-hidden cl-hatch ${k === i ? 'ring-2 ring-ink' : 'opacity-70 hover:opacity-100'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* full grid overview — see every photo at once, tap to open */}
      {grid && (
        <div className="fixed inset-0 z-50 bg-ink/95 overflow-y-auto" onClick={() => setGrid(false)}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 text-paper bg-ink/95" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-[13px]">{L.count(n)}</span>
            <button onClick={() => setGrid(false)} className="text-[13px] font-semibold px-4 py-2 rounded-pill border border-paper/40">{L.close} ✕</button>
          </div>
          <div className="max-w-[1100px] mx-auto px-4 pb-12 grid grid-cols-2 md:grid-cols-3 gap-2.5" onClick={(e) => e.stopPropagation()}>
            {images.map((im, k) => (
              <button key={k} onClick={() => { at(k); setGrid(false); setOpen(true); }} className="aspect-[4/3] rounded-card overflow-hidden cl-hatch group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im} alt="" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* lightbox */}
      {open && (
        <div className="fixed inset-0 z-50 bg-ink/92 flex flex-col" onClick={() => setOpen(false)}>
          <div className="flex items-center justify-between px-5 py-4 text-paper" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-[13px]">{i + 1} / {n}</span>
            <button onClick={() => setOpen(false)} className="text-[13px] font-semibold px-4 py-2 rounded-pill border border-paper/40">Cerrar ✕</button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-6 relative" onClick={(e) => e.stopPropagation()}>
            {n > 1 && <button onClick={() => go(-1)} className="absolute left-3 md:left-8 text-paper text-3xl w-12 h-12 rounded-full bg-ink/40 hover:bg-ink/70 grid place-items-center">‹</button>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[i]} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
            {n > 1 && <button onClick={() => go(1)} className="absolute right-3 md:right-8 text-paper text-3xl w-12 h-12 rounded-full bg-ink/40 hover:bg-ink/70 grid place-items-center">›</button>}
          </div>
        </div>
      )}
    </>
  );
}
