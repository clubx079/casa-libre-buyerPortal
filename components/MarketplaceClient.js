'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { typeLabel } from '@/lib/propertyType';
import { T, fmtUsd, fmtPyg, shortUsd } from '@/lib/ui';
import { useLang } from '@/lib/useLang';
import AuthButton from '@/components/AuthButton';

export default function MarketplaceClient({ listings, initialOp = 'all' }) {
  const [lang, setLang] = useLang();
  const [filter, setFilter] = useState(['all', 'venta', 'alquiler'].includes(initialOp) ? initialOp : 'all');
  const [hot, setHot] = useState(null);
  const [bounds, setBounds] = useState(null); // {n,s,e,w} of the current map view; null = show all
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const didFit = useRef(false);
  const t = T[lang];

  // Guide's Listings screen only filters by operation (Todas / Venta / Alquiler).
  const rows = useMemo(
    () => listings.filter((l) => filter === 'all' || l.mode === filter),
    [listings, filter]
  );

  // Left-hand list follows the map: only listings whose pin is inside the current
  // viewport (DeelMap-style). Listings without coordinates can't be placed on the
  // map, so they're always kept visible (appended) rather than silently dropped.
  const visible = useMemo(() => {
    if (!bounds) return rows;
    const inView = rows.filter((l) => l.lat != null && l.lng != null && l.lat <= bounds.n && l.lat >= bounds.s && l.lng <= bounds.e && l.lng >= bounds.w);
    const noCoord = rows.filter((l) => l.lat == null || l.lng == null);
    return [...inView, ...noCoord];
  }, [rows, bounds]);

  const title = (l) => `${typeLabel(l.type, lang) || (lang === 'es' ? 'Propiedad' : 'Property')}${l.beds ? ` · ${l.beds} ${t.beds}` : ''}`;
  const place = (l) => [l.neighborhood, l.city].filter(Boolean).join(', ') || l.address || '';
  const meta = (l) => [l.area && `${l.area} m²`, l.baths && `${l.baths} ${t.baths}`, l.parking && `${l.parking} 🅿`].filter(Boolean).join(' · ');
  const sfx = (l) => (l.mode === 'alquiler' ? t.perMonth : '');

  // Leaflet init (client-only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { scrollWheelZoom: true, zoomControl: true }).setView([-25.29, -57.6], 11);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
      mapRef.current = { L, map };
      // Sync the left list to the visible area whenever the user pans / zooms.
      const onMove = () => {
        const b = map.getBounds();
        setBounds({ n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() });
      };
      map.on('moveend', onMove);
      drawMarkers();
      // Leaflet needs a size recalc once the flex container has its final size;
      // re-fit bounds afterwards so the initial zoom isn't computed on a 0-size map.
      const fix = () => map.invalidateSize();
      setTimeout(fix, 100);
      setTimeout(() => { map.invalidateSize(); drawMarkers(); }, 400);
      window.addEventListener('resize', fix);
      mapRef.current.fix = fix;
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { if (mapRef.current.fix) window.removeEventListener('resize', mapRef.current.fix); mapRef.current.map.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw markers when the operation filter or language changes
  useEffect(() => { didFit.current = false; drawMarkers(); /* eslint-disable-next-line */ }, [rows, lang]);

  function popupHtml(l) {
    const img = l.image
      ? `<img src="${l.image}" alt="" style="width:100%;height:120px;object-fit:cover;display:block" onerror="this.style.display='none'"/>`
      : `<div style="height:70px;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,#EAE6DD,#EAE6DD 10px,#F4F1EA 10px,#F4F1EA 20px);font:600 10px 'IBM Plex Mono',monospace;color:rgba(17,17,17,.45)">${t.noImg}</div>`;
    return `<a href="/propiedad/${l.slug}" style="display:block;width:200px;text-decoration:none;color:#111">
      ${img}
      <div style="padding:8px 10px 9px">
        <div style="font:700 15px 'Space Grotesk',sans-serif">${fmtUsd(l.usd, lang) || '—'}${sfx(l)}</div>
        <div style="font:500 12px 'Space Grotesk',sans-serif;margin-top:1px">${title(l)}</div>
        <div style="font:400 11px 'Space Grotesk',sans-serif;color:rgba(17,17,17,.55);margin-top:1px">${place(l)}</div>
      </div>
    </a>`;
  }

  function drawMarkers() {
    const ref = mapRef.current;
    if (!ref) return;
    const { L, map } = ref;
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};
    const pts = [];
    rows.forEach((l) => {
      if (l.lat == null || l.lng == null) return;
      const m = L.marker([l.lat, l.lng], {
        icon: L.divIcon({ className: '', html: `<div class="marker-pill" data-mid="${l.id}">${shortUsd(l.usd)}</div>` }),
      }).addTo(map);
      m.bindPopup(popupHtml(l), { closeButton: false, offset: [0, -6], minWidth: 200, maxWidth: 200 });
      m.on('mouseover', () => { setHot(l.id); m.openPopup(); });
      m.on('mouseout', () => setHot(null));
      m.on('click', () => { window.location.href = `/propiedad/${l.slug}`; });
      markersRef.current[l.id] = m;
      pts.push([l.lat, l.lng]);
    });
    // Fit once per filter change; afterwards respect the user's manual zoom/pan.
    if (pts.length && !didFit.current) {
      didFit.current = true;
      try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); } catch {}
    }
  }

  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const el = m.getElement()?.querySelector('.marker-pill');
      if (el) el.classList.toggle('hot', String(id) === String(hot));
    });
  }, [hot]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* NAV */}
      <nav className="flex items-center justify-between flex-wrap gap-3 px-5 md:px-9 py-4 border-b border-ink/12">
        <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif not-italic italic font-normal">.py</em></Link>
        <div className="hidden sm:flex gap-2">
          {t.tabs.map(([label, href], i) => (
            <Link key={i} href={href} className={`px-4 py-2 rounded-pill text-[14px] font-medium border border-ink ${i === 0 ? 'bg-ink text-paper' : ''}`}>{label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>
            ))}
          </div>
          <AuthButton />
          <Link href="/publicar" className="px-[18px] py-2.5 rounded-pill bg-ink text-paper text-[14px] font-medium">{t.cta}</Link>
        </div>
      </nav>

      {/* FILTERS — guide has only the operation chips + a result count */}
      <div className="flex items-center gap-2 flex-wrap px-5 md:px-9 py-3 border-b border-ink/12">
        {['all', 'venta', 'alquiler'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-pill text-[13px] font-medium border ${filter === f ? 'bg-ink text-paper border-ink' : 'bg-card border-ink/30'}`}>
            {f === 'all' ? t.all : t[f]}
          </button>
        ))}
        <span className="ml-auto font-mono text-[12px] text-ink/50">{t.results(visible.length)}</span>
      </div>

      {/* SPLIT — fills remaining viewport; map on top (mobile) / right (desktop) */}
      <div className="flex-1 min-h-0 flex flex-col-reverse md:flex-row">
        <div className="md:w-[42%] md:min-w-[360px] flex-1 md:flex-initial min-h-0 overflow-y-auto px-4 md:px-6 py-5 flex flex-col gap-4">
          {visible.length === 0 && <div className="text-center text-ink/50 py-20">{lang === 'es' ? 'No hay propiedades en esta zona del mapa.' : 'No listings in this map area.'}</div>}
          {visible.map((l) => (
            <Link
              key={l.id} href={`/propiedad/${l.slug}`}
              onMouseEnter={() => setHot(l.id)} onMouseLeave={() => setHot(null)}
              className={`grid grid-cols-[140px_minmax(0,1fr)] min-h-[120px] bg-card border rounded-[18px] overflow-hidden transition-all ${hot === l.id ? 'border-ink -translate-y-0.5 shadow-hard-sm' : 'border-ink/15'}`}
            >
              <div className="relative cl-hatch flex items-center justify-center">
                {l.image
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : <span className="font-mono text-[10px] text-ink/45 text-center px-2">{t.noImg}</span>}
                <span className="absolute top-2 left-2 text-[10px] font-semibold bg-ink text-paper px-2.5 py-1 rounded-pill">{l.mode === 'alquiler' ? t.forRent : t.forSale}</span>
              </div>
              <div className="p-3.5">
                <div className="text-[18px] font-bold tracking-head whitespace-nowrap">{fmtUsd(l.usd, lang) || '—'}{sfx(l)}</div>
                <div className="text-[12px] font-semibold text-ink/55">{fmtPyg(l.pyg, lang) || ''}{l.pyg ? sfx(l) : ''}</div>
                <div className="text-[14px] font-medium mt-1 line-clamp-1">{title(l)}</div>
                <div className="text-[12px] text-ink/55 mt-0.5 line-clamp-1">{place(l)}</div>
                <div className="font-mono text-[11px] text-ink/45 mt-1">{meta(l)}</div>
              </div>
            </Link>
          ))}
        </div>
        <div ref={mapEl} className="h-[42vh] md:h-auto md:flex-1 min-h-0 border-b md:border-b-0 md:border-l border-ink/12" />
      </div>
    </div>
  );
}
