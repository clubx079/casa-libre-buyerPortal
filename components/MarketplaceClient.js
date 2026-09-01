'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { typeLabel, typeKey } from '@/lib/propertyType';
import { T, fmtUsd, fmtPyg, shortUsd, titleCaseZone, bedAbbr, bathWord, parkWord } from '@/lib/ui';
import { fmtRate } from '@/lib/money';
import { useLang } from '@/lib/useLang';
import AuthButton from '@/components/AuthButton';
import { useSellFlow } from '@/components/SellFlow';
import { track } from '@/lib/analytics';
import { loadGoogleMapsAPI, mapOptions, pinIcon, clusterIcon } from '@/utils/gmap';

// Marketplace-specific bilingual strings (search / filters / sort).
const M = {
  es: {
    searchPh: 'Buscar por barrio o tipo…',
    empty: 'Sin resultados — probá con otro barrio',
    types: { all: 'Tipo: todos', casa: 'Casa', depto: 'Departamento', duplex: 'Dúplex', terreno: 'Terreno', comercial: 'Local comercial', oficina: 'Oficina', deposito: 'Depósito', edificio: 'Edificio', condominio: 'Condominio', campo: 'Campo', otro: 'Otro' },
    pricesUsd: { all: 'Precio: todos', p1: 'Hasta US$ 100k', p2: 'US$ 100k – 200k', p3: 'Más de US$ 200k' },
    pricesPyg: { all: 'Precio: todos', p1: 'Hasta US$ 500/mes', p2: 'US$ 500 – 1.000/mes', p3: 'Más de US$ 1.000/mes' },
    beds: { all: 'Dormitorios: todos', b1: '1+', b2: '2+', b3: '3+' },
    sort: { relevancia: 'Relevancia', precio_asc: 'Precio: menor a mayor', precio_desc: 'Precio: mayor a menor', area_desc: 'Superficie: mayor primero' },
    listView: 'Lista', mapView: 'Mapa',
    loadMore: 'Ver más propiedades', showing: (n, total) => `Mostrando ${n} de ${total}`,
  },
  en: {
    searchPh: 'Search by neighborhood or type…',
    empty: 'No results — try another neighborhood',
    types: { all: 'Type: all', casa: 'House', depto: 'Apartment', duplex: 'Duplex', terreno: 'Lot', comercial: 'Commercial', oficina: 'Office', deposito: 'Warehouse', edificio: 'Building', condominio: 'Condo', campo: 'Rural land', otro: 'Other' },
    pricesUsd: { all: 'Price: any', p1: 'Under US$ 100k', p2: 'US$ 100k – 200k', p3: 'Over US$ 200k' },
    pricesPyg: { all: 'Price: any', p1: 'Under US$ 500/mo', p2: 'US$ 500 – 1,000/mo', p3: 'Over US$ 1,000/mo' },
    beds: { all: 'Bedrooms: any', b1: '1+', b2: '2+', b3: '3+' },
    sort: { relevancia: 'Relevance', precio_asc: 'Price: low to high', precio_desc: 'Price: high to low', area_desc: 'Area: largest first' },
    listView: 'List', mapView: 'Map',
    loadMore: 'Load more properties', showing: (n, total) => `Showing ${n} of ${total}`,
  },
};

// List page size — the map plots every match (clustered), the list grows 24 at a time.
const PER_PAGE = 24;

// accent- and case-insensitive text for search ("asuncion" should match "Asunción")
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function MarketplaceClient({ listings, rate, rateSource, rateDate, initialOp = 'all', initialQuery = '' }) {
  const [lang, setLang] = useLang();
  const { openSell } = useSellFlow();
  const [filter, setFilter] = useState(['all', 'venta', 'alquiler'].includes(initialOp) ? initialOp : 'all');
  const [query, setQuery] = useState(initialQuery || '');
  const [typeF, setTypeF] = useState('all');
  const [priceF, setPriceF] = useState('all');
  const [bedF, setBedF] = useState('all');
  const [sortBy, setSortBy] = useState('relevancia');
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // mobile: 'list' | 'map'
  const [hot, setHot] = useState(null);
  const [visible, setVisible] = useState(PER_PAGE); // #16 how many list cards are rendered
  const [mapReady, setMapReady] = useState(false); // show a branded loader until tiles paint
  // Feature images are NOT shipped with the listings (keeps the page light);
  // they're fetched lazily for the cards/popups actually on screen.
  const [imgMap, setImgMap] = useState({}); // { id: url | null }
  const imgMapRef = useRef({});             // latest map, for imperative Leaflet handlers
  const imgReq = useRef(new Set());         // ids already requested (dedupe)
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  const infoRef = useRef(null); // shared Google InfoWindow (hover popup)
  const markersRef = useRef({});
  const didFit = useRef(false);
  const hoverRevealRef = useRef(null); // id of the pin currently styled/opened by hover
  const hoverTargetRef = useRef(null); // latest hover target requested; guards stale zoomToShowLayer callbacks
  const t = T[lang];
  const m = M[lang];
  // Price buckets + value accessor switch together based on venta/alquiler mode:
  // alquiler filters guaraníes/month (l.pyg), venta/todas keep USD (usdVal(l)).
  const isRent = filter === 'alquiler';
  const prices = isRent ? m.pricesPyg : m.pricesUsd;

  // Reset a stale bucket selection whenever the operation mode changes so a USD
  // bucket key (e.g. "p2" = US$100k-200k) never gets applied against ₲ data.
  useEffect(() => { setPriceF('all'); }, [filter]);

  // ---- classification / value helpers (from real property fields) ----
  // Delegates to lib/propertyType.js's typeKey() so the DB-label -> bucket
  // mapping lives in one place, shared with typeLabel()'s display rules.
  const typeOf = (l) => typeKey(l.type);
  const usdVal = (l) => (l.usd != null ? l.usd : l.pyg != null ? l.pyg / 7500 : 0);
  const bedsOf = (l) => l.beds || 0;
  const areaVal = (l) => l.area || 0;

  const rows = useMemo(() => {
    let r = listings.filter((l) => filter === 'all' || l.mode === filter);
    if (typeF !== 'all') r = r.filter((l) => typeOf(l) === typeF);
    if (priceF !== 'all') {
      if (isRent) r = r.filter((l) => { const v = l.usd || 0; return priceF === 'p1' ? v < 500 : priceF === 'p2' ? v >= 500 && v <= 1000 : v > 1000; });
      else r = r.filter((l) => { const v = usdVal(l); return priceF === 'p1' ? v < 100000 : priceF === 'p2' ? v >= 100000 && v <= 200000 : v > 200000; });
    }
    if (bedF !== 'all') r = r.filter((l) => bedsOf(l) >= Number(bedF.slice(1)));
    if (query) {
      const q = norm(query);
      r = r.filter((l) => norm([l.neighborhood, l.city, l.address, l.type, typeLabel(l.type, 'es'), typeLabel(l.type, 'en')].filter(Boolean).join(' ')).includes(q));
    }
    if (sortBy === 'precio_asc') r = [...r].sort((a, b) => usdVal(a) - usdVal(b));
    else if (sortBy === 'precio_desc') r = [...r].sort((a, b) => usdVal(b) - usdVal(a));
    else if (sortBy === 'area_desc') r = [...r].sort((a, b) => areaVal(b) - areaVal(a));
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, filter, typeF, priceF, bedF, query, sortBy]);

  const rowsById = useMemo(() => new Map(rows.map((l) => [l.id, l])), [rows]);

  // Lazily fetch feature images for a set of ids (deduped). imgMapRef is the
  // source of truth (readable synchronously by the imperative map popups);
  // setImgMap re-renders the cards. Missing/failed ids resolve to null.
  const ensureImages = useCallback(async (ids) => {
    const need = (ids || []).filter((id) => id && !imgReq.current.has(id));
    if (!need.length) return;
    need.forEach((id) => imgReq.current.add(id));
    let got = {};
    try {
      const res = await fetch('/api/listings/images', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: need }),
      });
      got = (await res.json()).images || {};
    } catch { got = {}; }
    const merged = { ...imgMapRef.current };
    need.forEach((id) => { merged[id] = got[id] || null; });
    imgMapRef.current = merged;
    setImgMap(merged);
  }, []);

  // Load images for the visible list cards whenever the window or results change.
  useEffect(() => { ensureImages(rows.slice(0, visible).map((l) => l.id)); }, [rows, visible, ensureImages]);

  // Report the active filter set to analytics, debounced so free-text typing
  // doesn't fire an event per keystroke. Captures the initial view too.
  useEffect(() => {
    const id = setTimeout(() => {
      track('search_applied', {
        operation: filter,
        query: query || null,
        property_type: typeF,
        price_range: priceF,
        bedrooms: bedF,
        sort: sortBy,
        results_count: rows.length,
      });
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, typeF, priceF, bedF, query, sortBy]);

  // ---- display helpers ----
  const title = (l) => {
    let tp = typeLabel(l.type, lang) || (lang === 'es' ? 'Inmueble' : 'Property');
    if (tp === 'Departamento') tp = 'Depto'; // title-only abbreviation (mock: "Depto 2 dorm · Villa Morra")
    const zone = titleCaseZone(l.neighborhood || l.city || '');
    const base = l.beds ? `${tp} ${l.beds} ${bedAbbr(lang)}` : tp;
    return zone ? `${base} · ${zone}` : base;
  };
  const meta = (l) => {
    const parts = [];
    if (l.area) parts.push(`${l.area} m²`);
    if (l.baths) parts.push(`${l.baths} ${bathWord(l.baths, lang)}`);
    if (l.parking) parts.push(`${l.parking} ${parkWord(l.parking, lang)}`);
    return parts.join(' · ');
  };
  // Standardized: USD is always the main price; local ₲ is the sub. Rent adds /mes|/mo.
  const priceMain = (l) => ((fmtUsd(l.usd, lang) || '—') + (l.mode === 'alquiler' ? t.perMonth : ''));
  const priceSub = (l) => (fmtPyg(l.pyg, lang) ? fmtPyg(l.pyg, lang) + (l.mode === 'alquiler' ? t.perMonth : '') : '');
  const shortPill = (l) => shortUsd(l.usd);

  // ---- Google Maps init with marker clustering (Advanced Markers) ----
  useEffect(() => {
    // Below `md` this desktop layout is hidden (the mobile view uses
    // MobileMarketplace), so skip the heavy map init there. Desktop unchanged.
    if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(min-width: 768px)').matches) return;
    let cancelled = false;
    (async () => {
      const { MarkerClusterer, SuperClusterAlgorithm } = await import('@googlemaps/markerclusterer');
      await loadGoogleMapsAPI();
      if (cancelled || !mapEl.current || mapRef.current || !window.google?.maps) return;
      const google = window.google;
      const map = new google.maps.Map(mapEl.current, mapOptions(google, { center: { lat: -25.293, lng: -57.60 }, zoom: 13, gestureHandling: 'greedy' }));
      const info = new google.maps.InfoWindow({ disableAutoPan: true });
      // Cluster bubble → brand-coloured SVG pill (matches `.cluster-pill`).
      const renderer = {
        render: ({ count, position }) => new google.maps.Marker({ position, zIndex: 1000 + count, icon: clusterIcon(google, count, false) }),
      };
      const cluster = new MarkerClusterer({ map, renderer, algorithm: new SuperClusterAlgorithm({ radius: 46, maxZoom: 16 }) });
      mapRef.current = { google, map };
      clusterRef.current = cluster;
      infoRef.current = info;
      google.maps.event.addListenerOnce(map, 'tilesloaded', () => { if (!cancelled) setMapReady(true); });
      setTimeout(() => { if (!cancelled) setMapReady(true); }, 1500);
      drawMarkers();
    })();
    return () => { cancelled = true; mapRef.current = null; clusterRef.current = null; infoRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { didFit.current = false; drawMarkers(); /* eslint-disable-next-line */ }, [rows, lang]);

  // #16 Reset the list window to the first page whenever the result set changes.
  useEffect(() => { setVisible(PER_PAGE); }, [filter, typeF, priceF, bedF, query, sortBy]);

  function popupHtml(l, imgUrl) {
    const img = imgUrl
      ? `<img src="${imgUrl}" alt="" style="width:100%;height:118px;object-fit:cover;display:block" onerror="this.style.display='none'"/>`
      : `<div style="height:64px;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,#EAE6DD,#EAE6DD 10px,#F4F1EA 10px,#F4F1EA 20px);font:600 10px 'IBM Plex Mono',monospace;color:rgba(17,17,17,.45)">${t.noImg}</div>`;
    return `<a href="/propiedad/${l.id}" target="_blank" rel="noopener noreferrer" style="display:block;width:210px;text-decoration:none;color:#111">
      ${img}
      <div style="padding:9px 11px 10px">
        <div style="font:700 15px 'Space Grotesk',sans-serif">${priceMain(l)}</div>
        ${priceSub(l) ? `<div style="font:500 11px 'Space Grotesk',sans-serif;color:rgba(17,17,17,.5)">${priceSub(l)}</div>` : ''}
        <div style="font:500 12px 'Space Grotesk',sans-serif;margin-top:2px">${title(l)}</div>
        <div style="font:400 11px 'Space Grotesk',sans-serif;color:rgba(17,17,17,.55);margin-top:1px">${meta(l)}</div>
      </div></a>`;
  }

  function drawMarkers() {
    const ref = mapRef.current;
    const cluster = clusterRef.current;
    if (!ref || !cluster) return;
    const { google, map } = ref;
    cluster.clearMarkers();
    markersRef.current = {};
    const markers = [];
    const bounds = new google.maps.LatLngBounds();
    let n = 0;
    rows.forEach((l) => {
      if (l.lat == null || l.lng == null) return;
      const label = shortPill(l);
      const marker = new google.maps.Marker({ position: { lat: l.lat, lng: l.lng }, icon: pinIcon(google, label, false) });
      marker.__label = label;
      marker.addListener('mouseover', () => setHot(l.id));
      marker.addListener('mouseout', () => setHot(null));
      marker.addListener('click', () => {
        track('map_pin_clicked', {
          property_id: l.id,
          location_name: l.neighborhood || l.city || l.address || null,
          neighborhood: l.neighborhood || null,
          city: l.city || null,
          address: l.address || null,
          province: l.province || null,
          lat: l.lat, lng: l.lng,
        });
        window.open(`/propiedad/${l.id}`, '_blank', 'noopener');
      });
      markersRef.current[l.id] = marker;
      markers.push(marker);
      bounds.extend({ lat: l.lat, lng: l.lng });
      n++;
    });
    cluster.addMarkers(markers);
    // Default view stays zoomed on Asunción; only auto-fit to the results once
    // the user actually filters/searches (Buy/Rent/All keep the default view).
    const isFiltered = typeF !== 'all' || priceF !== 'all' || bedF !== 'all' || !!query;
    if (n && !didFit.current && isFiltered) { didFit.current = true; try { map.fitBounds(bounds, 40); } catch {} }
  }

  // Highlight the hovered card's pin on the map WITHOUT changing zoom: pan the
  // map (keeping the current zoom) only if the pin sits outside the current
  // viewport, then light up either the pin itself — or, if it's still grouped in
  // a cluster at this zoom, the cluster bubble that contains it. Never zooms,
  // never navigates.
  const hotMarkerRef = useRef(null); // { marker, icon } — restore its normal icon on clear

  const clearHover = () => {
    if (hotMarkerRef.current) { try { hotMarkerRef.current.marker.setIcon(hotMarkerRef.current.icon); } catch { /* removed */ } hotMarkerRef.current = null; }
    if (infoRef.current) infoRef.current.close();
    hoverRevealRef.current = null;
  };

  useEffect(() => {
    const ref = mapRef.current;
    const cluster = clusterRef.current;
    if (!ref || !cluster) return;
    const { google, map } = ref;

    // Clear the previously-lit pin/cluster (covers hot->null and hot flipping
    // straight from one card to another without an intermediate null).
    if (hoverRevealRef.current != null && hoverRevealRef.current !== hot) clearHover();

    hoverTargetRef.current = hot;
    if (hot == null) { clearHover(); return; }

    const mk = markersRef.current[hot];
    if (!mk) return;

    // Pan only when the pin is off-screen — keep the current zoom level intact.
    const p = mk.getPosition?.();
    const b = map.getBounds();
    if (p && b && !b.contains(p)) map.panTo(p);

    // Is this marker currently rolled up inside a multi-marker cluster bubble?
    const parent = (cluster.clusters || []).find((c) => (c.markers?.length > 1) && c.markers.includes(mk));
    if (parent && parent.marker && typeof parent.marker.setIcon === 'function') {
      const cm = parent.marker;
      hotMarkerRef.current = { marker: cm, icon: cm.getIcon() };
      cm.setIcon(clusterIcon(google, parent.count ?? parent.markers.length, true));
      hoverRevealRef.current = hot;
    } else {
      // Standalone pin → invert its pill + open its popup (lazy-load image, then refresh).
      hotMarkerRef.current = { marker: mk, icon: mk.getIcon() };
      mk.setIcon(pinIcon(google, mk.__label, true));
      hoverRevealRef.current = hot;
      const l = rowsById.get(hot);
      if (l && infoRef.current) {
        infoRef.current.setContent(popupHtml(l, imgMapRef.current[l.id]));
        infoRef.current.open({ map, anchor: mk });
        ensureImages([l.id]).then(() => { if (hoverTargetRef.current === hot && infoRef.current) infoRef.current.setContent(popupHtml(l, imgMapRef.current[l.id])); });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hot]);

  // On mobile the map panel is hidden until its tab is selected — nudge Google to
  // recompute size once it becomes visible or it renders grey/blank.
  useEffect(() => {
    if (mobileView === 'map' && mapRef.current) {
      const { google, map } = mapRef.current;
      setTimeout(() => google.maps.event.trigger(map, 'resize'), 60);
    }
  }, [mobileView]);

  const chipCls = (on) => `px-4 py-2 rounded-pill text-[13px] font-medium border cursor-pointer ${on ? 'bg-ink text-paper border-ink' : 'bg-card border-ink/30'}`;
  const selCls = 'cl-select pr-[30px] pl-4 py-2 rounded-pill text-[13px] font-medium border border-ink/30 bg-card outline-none cursor-pointer';

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* NAV */}
      <nav className="flex items-center justify-between flex-wrap gap-3 px-5 md:px-9 py-4 border-b border-ink/12">
        <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
        <div className="hidden sm:flex gap-2">
          {t.tabs.map(([label, href, op], i) => (
            op ? (
              <button key={i} onClick={() => setFilter(op)} className={`inline-flex items-center h-[40px] px-[18px] rounded-pill text-[14px] font-medium border border-ink ${filter === op ? 'bg-ink text-paper' : ''}`}>{label}</button>
            ) : (
              <button key={i} onClick={openSell} className="inline-flex items-center h-[40px] px-[18px] rounded-pill text-[14px] font-medium border border-ink">{label}</button>
            )
          ))}
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center h-[40px] border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`h-full flex items-center px-3 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>
            ))}
          </div>
          <AuthButton />
          <button onClick={openSell} className="inline-flex items-center h-[40px] px-[18px] rounded-pill bg-ink text-paper text-[14px] font-medium border border-ink">{t.cta}</button>
        </div>
      </nav>

      {/* FILTERS */}
      <div className="flex items-center gap-2.5 flex-wrap px-5 md:px-9 py-3 border-b border-ink/12">
        <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2 bg-card border-[1.5px] border-ink rounded-pill pl-4 pr-1 py-1 min-w-[min(300px,100%)]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={m.searchPh} className="flex-1 min-w-0 bg-transparent outline-none font-sans font-medium text-[14px] text-ink placeholder:text-[#757575] placeholder:font-normal" />
          <button type="submit" aria-label="Buscar" className="w-[34px] h-[34px] flex-none flex items-center justify-center rounded-pill bg-ink text-paper" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 600, lineHeight: 1 }}>→</button>
        </form>
        {['all', 'venta', 'alquiler'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={chipCls(filter === f)}>{f === 'all' ? t.all : t[f]}</button>
        ))}
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className={selCls}>
          {Object.entries(m.types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={priceF} onChange={(e) => setPriceF(e.target.value)} className={selCls}>
          {Object.entries(prices).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={bedF} onChange={(e) => setBedF(e.target.value)} className={selCls}>
          {Object.entries(m.beds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {/* view toggle — mockup .view-toggle, right-aligned, mobile only */}
        <div className="ml-auto md:hidden inline-flex items-center border-[1.5px] border-ink rounded-pill p-[3px] bg-card">
          {[['list', m.listView], ['map', m.mapView]].map(([v, label]) => (
            <button key={v} onClick={() => setMobileView(v)} className={`px-4 py-[7px] rounded-pill text-[13px] font-semibold ${mobileView === v ? 'bg-ink text-paper' : 'text-ink/55'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* SPLIT — desktop: side-by-side; mobile: one panel per selected tab */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div className={`min-h-0 flex-col md:flex md:w-[44%] md:min-w-[400px] md:flex-none ${mobileView === 'map' ? 'hidden' : 'flex flex-1'}`}>
          {/* list head: count + sort */}
          <div className="flex items-center justify-between gap-2.5 px-4 md:px-7 pt-3.5">
            <span className="font-mono text-[12px] text-ink/50">{t.results(rows.length)}</span>
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setSortOpen((o) => !o); }} className="flex items-center gap-2 border border-ink/30 bg-card rounded-pill px-3.5 py-2 text-[13px] font-medium">
                {m.sort[sortBy]}<span className="text-[12px] font-bold tracking-[-2px]">↑↓</span>
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-[40]" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+6px)] min-w-[220px] bg-card border-[1.5px] border-ink rounded-[14px] shadow-hard-sm overflow-hidden z-[50]">
                    {Object.entries(m.sort).map(([k, v]) => (
                      <div key={k} onClick={() => { setSortBy(k); setSortOpen(false); }} className={`px-4 py-[11px] text-[13.5px] cursor-pointer ${sortBy === k ? 'bg-ink text-paper font-semibold' : 'font-medium hover:bg-hatch2'}`}>{v}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-7 py-5 flex flex-col gap-4">
            {rows.length === 0 && <div className="py-10 text-center font-mono text-[12px] text-ink/45">{m.empty}</div>}
            {rows.slice(0, visible).map((l) => (
              <Link
                key={l.id} href={`/propiedad/${l.id}`} target="_blank" rel="noopener noreferrer"
                onMouseEnter={() => setHot(l.id)} onMouseLeave={() => setHot(null)}
                className={`flex items-stretch shrink-0 min-h-[120px] bg-card border rounded-[18px] overflow-hidden transition-all ${hot === l.id ? 'border-ink -translate-y-0.5 shadow-hard-sm' : 'border-ink/15'}`}
              >
                <div className="relative w-[150px] max-[560px]:w-[110px] shrink-0 cl-hatch overflow-hidden flex items-center justify-center">
                  {imgMap[l.id]
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={imgMap[l.id]} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <span className="font-mono text-[10px] text-ink/45 text-center px-2">{t.noImg}</span>}
                  <span className="absolute top-2 left-2 text-[10px] font-semibold bg-ink text-paper px-2.5 py-1 rounded-pill z-10">{l.mode === 'alquiler' ? t.alquiler : t.venta}</span>
                </div>
                <div className="flex-1 min-w-0 pt-3.5 pb-4 px-4">
                  <div className="text-[18px] font-bold tracking-[-0.02em] whitespace-nowrap">{priceMain(l)}</div>
                  {priceSub(l) && <div className="text-[12px] font-medium text-ink/50 whitespace-nowrap">{priceSub(l)}</div>}
                  <div className="text-[14px] font-medium mt-[3px] line-clamp-1">{title(l)}</div>
                  <div className="text-[12px] text-ink/55 mt-[3px] line-clamp-1">{meta(l)}</div>
                </div>
              </Link>
            ))}
            {/* #16 Pagination — the list grows 24 at a time; the map keeps every pin. */}
            {rows.length > visible && (
              <div className="flex flex-col items-center gap-2 pt-1 pb-2">
                <button
                  onClick={() => setVisible((v) => v + PER_PAGE)}
                  className="px-6 py-2.5 rounded-pill bg-ink text-paper text-[13px] font-semibold shadow-hard-soft hover:-translate-y-0.5 transition-transform"
                >
                  {m.loadMore}
                </button>
                <span className="font-mono text-[11px] text-ink/45">{m.showing(Math.min(visible, rows.length), rows.length)}</span>
              </div>
            )}
          </div>
        </div>
        {/* relative wrapper gives Leaflet a definite-size, clipped box (fixes the
            mobile overflow where pins spilled outside the map) + hosts the loader. */}
        <div className={`relative min-h-0 md:block md:flex-1 md:border-l border-ink/12 ${mobileView === 'list' ? 'hidden' : 'block flex-1'}`}>
          <div ref={mapEl} className="absolute inset-0 z-0 overflow-hidden" />
          {!mapReady && (
            <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3" style={{ background: 'repeating-linear-gradient(45deg,#EAE6DD,#EAE6DD 10px,#F4F1EA 10px,#F4F1EA 20px)' }}>
              <span className="w-7 h-7 rounded-full border-2 border-ink/20 border-t-ink animate-spin" aria-hidden="true" />
              <span className="font-mono text-[12px] text-ink/55">{lang === 'es' ? 'Cargando mapa…' : 'Loading map…'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
