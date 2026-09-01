'use client';
// Mobile-only marketplace — mirrors the Casa Libre mobile-app listing UI
// (search, En venta/En alquiler segmented, Filtros/Tipo/Precio/Dorm. row,
// Lista/Mapa toggle, sort, filters bottom sheet, property cards). Rendered only
// below `md`; the desktop MarketplaceClient is untouched.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useSellFlow } from '@/components/SellFlow';
import { useFavorites } from '@/components/FavoritesProvider';
import { typeLabel, typeKey } from '@/lib/propertyType';
import { T, fmtUsd, fmtPyg, shortUsd, titleCaseZone, bedAbbr, bathWord, parkWord, loc } from '@/lib/ui';
import { loadGoogleMapsAPI, mapOptions, pinIcon, clusterIcon } from '@/utils/gmap';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PER_PAGE = 24;

const TXT = {
  es: { forSale: 'En venta', forRent: 'En alquiler', filters: 'Filtros', type: 'Tipo', price: 'Precio', beds: 'Dorm.', list: 'Lista', map: 'Mapa', cta: 'Publicá gratis', searchPh: 'Barrio, ciudad o edificio…', propType: 'Tipo de propiedad', priceUsd: 'Precio · US$', bedrooms: 'Dormitorios', barrio: 'Barrio', listedBy: 'Publicado por', ownerDirect: 'Dueño directo', agent: 'Inmobiliaria', clearAll: 'Borrar todo', show: 'Ver', close: 'Cerrar', sortBy: 'Ordenar por', noResults: 'Sin resultados', loadMore: 'Ver más', propsWord: 'propiedades' },
  en: { forSale: 'For sale', forRent: 'For rent', filters: 'Filters', type: 'Type', price: 'Price', beds: 'Beds', list: 'List', map: 'Map', cta: 'List for free', searchPh: 'Neighborhood, city or building…', propType: 'Property type', priceUsd: 'Price · US$', bedrooms: 'Bedrooms', barrio: 'Barrio', listedBy: 'Listed by', ownerDirect: 'Owner direct', agent: 'Agent', clearAll: 'Clear all', show: 'Show', close: 'Close', sortBy: 'Sort by', noResults: 'No results', loadMore: 'Load more', propsWord: 'listings' },
};

const TYPE_PILLS = [
  { k: 'depto', es: 'Departamento', en: 'Apartment' }, { k: 'casa', es: 'Casa', en: 'House' },
  { k: 'duplex', es: 'Dúplex', en: 'Duplex' }, { k: 'terreno', es: 'Terreno', en: 'Land' },
  { k: 'oficina', es: 'Oficina', en: 'Office' }, { k: 'deposito', es: 'Depósito', en: 'Warehouse' },
];
const typePillLabel = (k, lang) => { const o = TYPE_PILLS.find((x) => x.k === k); return o ? o[lang === 'en' ? 'en' : 'es'] : ''; };

const priceBuckets = (mode, lang) => mode === 'alquiler'
  ? [{ k: 'p1', l: lang === 'en' ? 'Under $500' : 'Hasta $500', t: (v) => v < 500 },
     { k: 'p2', l: '$500 – 1.000', t: (v) => v >= 500 && v <= 1000 },
     { k: 'p3', l: '$1.000 – 2.000', t: (v) => v > 1000 && v <= 2000 },
     { k: 'p4', l: '$2.000+', t: (v) => v > 2000 }]
  : [{ k: 'p1', l: lang === 'en' ? 'Under 80k' : 'Hasta 80k', t: (v) => v < 80000 },
     { k: 'p2', l: '80k – 200k', t: (v) => v >= 80000 && v <= 200000 },
     { k: 'p3', l: '200k – 400k', t: (v) => v > 200000 && v <= 400000 },
     { k: 'p4', l: '400k+', t: (v) => v > 400000 }];

const SORTS = [
  { k: 'relevancia', es: 'Relevancia', en: 'Relevance', esS: 'Relevancia', enS: 'Relevance' },
  { k: 'precio_asc', es: 'Precio: menor a mayor', en: 'Price: low to high', esS: 'Precio ↑', enS: 'Price ↑' },
  { k: 'precio_desc', es: 'Precio: mayor a menor', en: 'Price: high to low', esS: 'Precio ↓', enS: 'Price ↓' },
  { k: 'area_desc', es: 'Superficie: mayor primero', en: 'Area: largest first', esS: 'Mayor', enS: 'Largest' },
];

export default function MobileMarketplace({ listings = [], initialOp = 'all', initialQuery = '' }) {
  const [lang, setLang] = useLang();
  const { openSell } = useSellFlow();
  const { isSaved, toggle } = useFavorites();
  const X = TXT[lang];
  const t = T[lang];

  const [mode, setMode] = useState(initialOp === 'alquiler' ? 'alquiler' : 'venta');
  const [q, setQ] = useState(initialQuery || '');
  const [typeF, setTypeF] = useState('all');
  const [priceF, setPriceF] = useState('all');
  const [bedF, setBedF] = useState('all');
  const [barrioF, setBarrioF] = useState('all');
  const [sellerF, setSellerF] = useState('all');
  const [sort, setSort] = useState('relevancia');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [imgMap, setImgMap] = useState({});
  const imgReq = useRef(new Set());

  useEffect(() => { setPriceF('all'); }, [mode]);

  const barrios = useMemo(() => {
    const m = {};
    listings.forEach((l) => { if (mode !== 'all' && l.mode !== mode) return; const nb = (l.neighborhood || '').trim(); if (nb) m[nb] = (m[nb] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([nb]) => nb);
  }, [listings, mode]);

  const buckets = priceBuckets(mode, lang);
  const usdVal = (l) => (l.usd != null ? l.usd : l.pyg != null ? l.pyg / 7500 : 0);
  const filtered = useMemo(() => {
    let out = listings.filter((l) => l.mode === mode);
    if (q.trim()) { const nq = norm(q); out = out.filter((l) => norm([l.neighborhood, l.city, l.address, l.type, typeLabel(l.type, 'es'), typeLabel(l.type, 'en')].filter(Boolean).join(' ')).includes(nq)); }
    if (typeF !== 'all') out = out.filter((l) => typeKey(l.type) === typeF);
    if (bedF !== 'all') { const mn = Number(bedF); out = out.filter((l) => (l.beds || 0) >= mn); }
    if (barrioF !== 'all') out = out.filter((l) => norm(l.neighborhood) === norm(barrioF));
    if (sellerF !== 'all') out = out.filter((l) => (sellerF === 'owner' ? !!l.user_published : !l.user_published));
    if (priceF !== 'all') { const b = buckets.find((x) => x.k === priceF); if (b) out = out.filter((l) => b.t(mode === 'alquiler' ? (l.usd || 0) : usdVal(l))); }
    if (sort === 'precio_asc') out = [...out].sort((a, b) => usdVal(a) - usdVal(b));
    else if (sort === 'precio_desc') out = [...out].sort((a, b) => usdVal(b) - usdVal(a));
    else if (sort === 'area_desc') out = [...out].sort((a, b) => (b.area || 0) - (a.area || 0));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, mode, q, typeF, priceF, bedF, barrioF, sellerF, sort, lang]);

  const activeCount = (typeF !== 'all' ? 1 : 0) + (priceF !== 'all' ? 1 : 0) + (bedF !== 'all' ? 1 : 0) + (barrioF !== 'all' ? 1 : 0) + (sellerF !== 'all' ? 1 : 0);
  useEffect(() => { setPage(1); }, [q, typeF, priceF, bedF, barrioF, sellerF, sort, mode]);
  const visible = filtered.slice(0, page * PER_PAGE);
  const clearAll = () => { setTypeF('all'); setPriceF('all'); setBedF('all'); setBarrioF('all'); setSellerF('all'); };
  const nf = (x) => x.toLocaleString(loc(lang));

  // lazy feature images for visible cards
  const ensureImages = useCallback(async (ids) => {
    const need = ids.filter((id) => id && !imgReq.current.has(id));
    if (!need.length) return;
    need.forEach((id) => imgReq.current.add(id));
    let got = {};
    try { const res = await fetch('/api/listings/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: need }) }); got = (await res.json()).images || {}; } catch { got = {}; }
    setImgMap((prev) => { const m = { ...prev }; need.forEach((id) => { m[id] = got[id] || null; }); return m; });
  }, []);
  useEffect(() => { ensureImages(visible.map((l) => l.id)); }, [visible, ensureImages]);

  // ---- map (lazy: only init when the map tab is first opened) — Google Maps ----
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  useEffect(() => {
    if (view !== 'map' || mapRef.current || !mapEl.current) return;
    let cancelled = false;
    (async () => {
      const { MarkerClusterer, SuperClusterAlgorithm } = await import('@googlemaps/markerclusterer');
      await loadGoogleMapsAPI();
      if (cancelled || !mapEl.current || mapRef.current || !window.google?.maps) return;
      const google = window.google;
      const map = new google.maps.Map(mapEl.current, mapOptions(google, { center: { lat: -25.293, lng: -57.60 }, zoom: 12, gestureHandling: 'greedy' }));
      const renderer = { render: ({ count, position }) => new google.maps.Marker({ position, zIndex: 1000 + count, icon: clusterIcon(google, count, false) }) };
      const cluster = new MarkerClusterer({ map, renderer, algorithm: new SuperClusterAlgorithm({ radius: 46, maxZoom: 16 }) });
      mapRef.current = { google, map }; clusterRef.current = cluster;
      drawMarkers();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const drawMarkers = useCallback(() => {
    const ref = mapRef.current, cluster = clusterRef.current;
    if (!ref || !cluster) return;
    const { google, map } = ref;
    cluster.clearMarkers();
    const markers = [];
    const bounds = new google.maps.LatLngBounds();
    let n = 0;
    filtered.forEach((l) => {
      if (l.lat == null || l.lng == null) return;
      const mk = new google.maps.Marker({ position: { lat: l.lat, lng: l.lng }, icon: pinIcon(google, shortUsd(l.usd), false) });
      mk.addListener('click', () => { window.location.href = `/propiedad/${l.id}`; });
      markers.push(mk); bounds.extend({ lat: l.lat, lng: l.lng }); n++;
    });
    cluster.addMarkers(markers);
    if (n && (typeF !== 'all' || priceF !== 'all' || bedF !== 'all' || barrioF !== 'all' || q)) { try { map.fitBounds(bounds, 36); } catch {} }
  }, [filtered, typeF, priceF, bedF, barrioF, q]);
  useEffect(() => { if (view === 'map') drawMarkers(); }, [view, drawMarkers]);

  const priceMain = (l) => (fmtUsd(l.usd, lang) || '—') + (l.mode === 'alquiler' ? t.perMonth : '');
  const priceSub = (l) => (fmtPyg(l.pyg, lang) ? fmtPyg(l.pyg, lang) + (l.mode === 'alquiler' ? t.perMonth : '') : '');
  const title = (l) => { let tp = typeLabel(l.type, lang) || (lang === 'es' ? 'Inmueble' : 'Property'); const zone = titleCaseZone(l.neighborhood || l.city || ''); const base = l.beds ? `${tp} · ${l.beds} ${bedAbbr(lang)}` : tp; return zone ? `${base} · ${zone}` : base; };
  const meta = (l) => [l.area && `${l.area} m²`, l.baths && `${l.baths} ${bathWord(l.baths, lang)}`, l.parking && `${l.parking} ${parkWord(l.parking, lang)}`].filter(Boolean).join(' · ');

  const Pill = ({ label, on, onClick }) => (
    <button onClick={onClick} className={`shrink-0 border-[1.5px] rounded-pill px-4 py-[9px] text-[14px] font-medium ${on ? 'bg-ink text-paper border-ink' : 'bg-card border-ink/30 text-ink'}`}>{label}</button>
  );
  const Section = ({ children }) => <div className="font-mono text-[11px] tracking-[1px] text-ink/45 mt-[22px] mb-2.5 uppercase">{children}</div>;
  const sortShort = (SORTS.find((s) => s.k === sort) || SORTS[0])[lang === 'en' ? 'enS' : 'esS'];

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center border-[1.5px] border-ink rounded-pill overflow-hidden text-[12px] font-semibold">
            {['es', 'en'].map((l) => <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 ${lang === l ? 'bg-ink text-paper' : 'text-ink'}`}>{l.toUpperCase()}</button>)}
          </div>
          <button onClick={openSell} className="bg-ink text-paper rounded-pill px-4 py-[9px] text-[13px] font-bold">{X.cta}</button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="px-4 pb-3">
        <div className="flex items-center bg-card border-[1.5px] border-ink/12 rounded-pill h-[54px] pl-[18px] pr-[5px]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={X.searchPh} className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink/45" />
          {q && <button onClick={() => setQ('')} className="mr-1.5 text-ink/30 text-[18px] leading-none">✕</button>}
          <span className="w-11 h-11 rounded-pill bg-ink text-paper flex items-center justify-center text-[20px]">→</span>
        </div>
      </div>

      {/* EN VENTA / EN ALQUILER */}
      <div className="px-4 pb-3">
        <div className="flex bg-card border-[1.5px] border-ink rounded-pill p-1">
          {[['venta', X.forSale], ['alquiler', X.forRent]].map(([k, lb]) => (
            <button key={k} onClick={() => setMode(k)} className={`flex-1 text-center py-[11px] rounded-pill text-[15px] font-bold ${mode === k ? 'bg-ink text-paper' : 'text-ink'}`}>{lb}</button>
          ))}
        </div>
      </div>

      {/* FILTER ROW */}
      <div className="pb-3 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 px-4 w-max">
          <button onClick={() => setFiltersOpen(true)} className={`shrink-0 flex items-center gap-2 border-[1.5px] rounded-pill h-10 pl-4 ${activeCount ? 'bg-ink text-paper border-ink pr-2' : 'bg-card border-ink/30 text-ink pr-4'}`}>
            <span className="text-[14px] font-bold">{X.filters}</span>
            {activeCount ? <span className="min-w-[20px] h-5 rounded-full bg-paper text-ink flex items-center justify-center px-[5px] font-mono text-[11px]">{activeCount}</span> : null}
          </button>
          {[[X.type, typeF !== 'all', typeF !== 'all' ? typePillLabel(typeF, lang) : X.type], [X.price, priceF !== 'all', priceF !== 'all' ? (buckets.find((b) => b.k === priceF)?.l || X.price) : X.price], [X.beds, bedF !== 'all', bedF !== 'all' ? `${bedF}+` : X.beds]].map(([base, on, label], i) => (
            <button key={i} onClick={() => setFiltersOpen(true)} className={`shrink-0 flex items-center gap-1.5 border-[1.5px] rounded-pill h-10 pl-4 pr-3 ${on ? 'bg-ink text-paper border-ink' : 'bg-card border-ink/30 text-ink'}`}>
              <span className="text-[14px] font-medium">{label}</span><span className="text-[11px] opacity-70">▾</span>
            </button>
          ))}
        </div>
      </div>

      {/* RESULTS ROW */}
      <div className="flex items-center gap-2.5 px-4 pb-3">
        <span className="font-mono text-[12.5px] text-ink/60 shrink-0">{nf(filtered.length)} {X.propsWord}</span>
        <div className="flex-1 flex items-center justify-end gap-2.5">
          <div className="flex bg-ink rounded-pill p-[3px]">
            {[['list', X.list], ['map', X.map]].map(([k, lb]) => (
              <button key={k} onClick={() => setView(k)} className={`px-4 py-[7px] rounded-pill text-[13px] font-bold ${view === k ? 'bg-paper text-ink' : 'text-paper'}`}>{lb}</button>
            ))}
          </div>
          <button onClick={() => setSortOpen(true)} className="flex items-center gap-1.5 border-[1.5px] border-ink/30 rounded-pill px-3.5 h-9 text-[13px] font-medium text-ink">{sortShort}<span className="text-[13px]">⇅</span></button>
        </div>
      </div>

      {/* BODY */}
      {view === 'map' ? (
        <div className="relative flex-1 min-h-[70vh]">
          <div ref={mapEl} className="absolute inset-0 z-0" />
          <button onClick={() => setView('list')} className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2 bg-ink text-paper rounded-pill py-3 px-5 text-[15px] font-medium shadow-hard">☰ {X.list}</button>
        </div>
      ) : (
        <div className="px-4 pb-8 flex flex-col gap-4">
          {filtered.length === 0 && <div className="py-14 text-center font-mono text-[13px] text-ink/45">{X.noResults}</div>}
          {visible.map((l) => (
            <Link key={l.id} href={`/propiedad/${l.id}`} className="block bg-card border border-ink/12 rounded-[18px] overflow-hidden">
              <div className="relative h-[220px] cl-hatch">
                {imgMap[l.id] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imgMap[l.id]} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                <span className="absolute top-3 left-3 text-[12px] font-semibold bg-ink text-paper px-3 py-1.5 rounded-pill">{l.mode === 'alquiler' ? X.forRent : X.forSale}</span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(l.id); }}
                  aria-label="save"
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-paper/90 flex items-center justify-center text-[16px]"
                >{isSaved(l.id) ? '♥' : '♡'}</button>
              </div>
              <div className="px-4 pt-3.5 pb-4">
                <div className="text-[24px] font-bold tracking-[-0.02em]">{priceMain(l)}</div>
                {priceSub(l) && <div className="text-[13px] font-medium text-ink/50">{priceSub(l)}</div>}
                <div className="text-[15px] font-bold mt-1.5 line-clamp-1">{title(l)}</div>
                <div className="text-[13px] text-ink/55 mt-0.5 line-clamp-1">{meta(l)}</div>
                {l.user_published && <span className="inline-block mt-2.5 text-[12px] font-medium text-ink/60 border border-ink/20 rounded-pill px-3 py-1">{X.ownerDirect}</span>}
              </div>
            </Link>
          ))}
          {filtered.length > visible.length && (
            <button onClick={() => setPage((p) => p + 1)} className="self-center mt-1 px-6 py-2.5 rounded-pill bg-ink text-paper text-[13px] font-semibold">{X.loadMore}</button>
          )}
        </div>
      )}

      {/* SORT SHEET */}
      {sortOpen && (
        <div className="fixed inset-0 z-[500] bg-ink/40 flex items-end" onClick={() => setSortOpen(false)}>
          <div className="w-full bg-paper rounded-t-[24px] pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center py-2.5"><div className="w-[42px] h-[5px] rounded-full bg-ink/12" /></div>
            <div className="font-mono text-[11px] tracking-[1px] text-ink/45 px-5 pb-1 uppercase">{X.sortBy}</div>
            {SORTS.map((s) => (
              <button key={s.k} onClick={() => { setSort(s.k); setSortOpen(false); }} className={`w-full flex items-center justify-between px-5 py-3.5 text-[15px] ${s.k === sort ? 'font-bold' : ''}`}>
                {s[lang === 'en' ? 'en' : 'es']}{s.k === sort ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FILTERS BOTTOM SHEET */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[500] bg-ink/40 flex items-end" onClick={() => setFiltersOpen(false)}>
          <div className="w-full bg-paper rounded-t-[24px] max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-2 pb-1"><div className="w-[42px] h-[5px] rounded-full bg-ink/12" /></div>
            <div className="flex items-center justify-between px-5 pb-1">
              <div className="text-[22px] font-bold">{X.filters}</div>
              <button onClick={() => setFiltersOpen(false)} className="border-[1.5px] border-ink/30 rounded-pill px-[18px] py-2 text-[14px] font-medium">{X.close}</button>
            </div>
            <div className="px-5 overflow-y-auto flex-1 pb-3">
              <Section>{X.propType}</Section>
              <div className="flex flex-wrap gap-2.5">{TYPE_PILLS.map((tp) => <Pill key={tp.k} label={tp[lang === 'en' ? 'en' : 'es']} on={typeF === tp.k} onClick={() => setTypeF(typeF === tp.k ? 'all' : tp.k)} />)}</div>
              <Section>{X.priceUsd}</Section>
              <div className="flex flex-wrap gap-2.5">{buckets.map((b) => <Pill key={b.k} label={b.l} on={priceF === b.k} onClick={() => setPriceF(priceF === b.k ? 'all' : b.k)} />)}</div>
              <Section>{X.bedrooms}</Section>
              <div className="flex flex-wrap gap-2.5">{['1', '2', '3', '4'].map((b) => <Pill key={b} label={`${b}+`} on={bedF === b} onClick={() => setBedF(bedF === b ? 'all' : b)} />)}</div>
              {barrios.length > 0 && (<><Section>{X.barrio}</Section><div className="flex flex-wrap gap-2.5">{barrios.map((nb) => <Pill key={nb} label={nb} on={barrioF === nb} onClick={() => setBarrioF(barrioF === nb ? 'all' : nb)} />)}</div></>)}
              <Section>{X.listedBy}</Section>
              <div className="flex flex-wrap gap-2.5">
                <Pill label={X.ownerDirect} on={sellerF === 'owner'} onClick={() => setSellerF(sellerF === 'owner' ? 'all' : 'owner')} />
                <Pill label={X.agent} on={sellerF === 'agent'} onClick={() => setSellerF(sellerF === 'agent' ? 'all' : 'agent')} />
              </div>
            </div>
            <div className="flex gap-3 p-5 pb-8 border-t border-ink/8">
              <button onClick={clearAll} className="flex-1 py-3.5 rounded-pill border-[1.5px] border-ink text-[15px] font-medium">{X.clearAll}</button>
              <button onClick={() => setFiltersOpen(false)} className="flex-[2] py-3.5 rounded-pill bg-ink text-paper text-[15px] font-bold shadow-hard-soft">{X.show} {nf(filtered.length)} {X.propsWord}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
