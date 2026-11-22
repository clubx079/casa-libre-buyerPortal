'use client';
import SearchSpinner from '@/components/SearchSpinner';
import { roundArea } from '@/lib/mapArea';
import { gatedFetch } from '@/lib/gatedFetch';
import { typeOptions } from '@/lib/propertyTypeOptions';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { typeLabel, typeKey } from '@/lib/propertyType';
import { T, fmtUsd, fmtPyg, shortUsd, titleCaseZone, bedAbbr, bathWord, parkWord, isUnverified, contactSellerFor, NO_PRICE_PIN } from '@/lib/ui';
import { fmtRate } from '@/lib/money';
import { useLang } from '@/lib/useLang';
import { tr, localeFor } from '@/lib/i18n';
import AuthButton from '@/components/AuthButton';
import VerifiedTag from '@/components/VerifiedTag';
import { StickyAppBadges } from '@/components/AppBadges';
import { useSellFlow } from '@/components/SellFlow';
import { track } from '@/lib/analytics';
import { priceBand } from '@/lib/dataLayer';
import { loadGoogleMapsAPI, mapOptions, pinIcon, clusterIcon, inParaguay, youAreHereIcon } from '@/utils/gmap';
import { distanceKm, getUserLocation, NEAR_RADIUS_KM } from '@/utils/geo';
import { COUNTRY } from '@/lib/country';
import { CATEGORIES } from '@/lib/zoning/categories';
import ZoningMapToggle, { useZoningOverlay } from '@/components/ZoningMapToggle';
import PlaceAutocomplete, { submitSearch } from '@/components/PlaceAutocomplete';
import { exactPlace } from '@/lib/places';
import { usePlaces, loadPlaceArea } from '@/lib/placesClient';
import { searchBounds } from '@/lib/areaGeom';
import { fitBox, placeOutline, barrioLabelLayer } from '@/utils/placeOverlay';

// Marketplace-specific bilingual strings (search / filters / sort).
const M = {
  es: {
    searchPh: 'Buscar por barrio o tipo…',
    empty: 'Sin resultados — probá con otro barrio',
    types: { all: 'Tipo: todos', ...Object.fromEntries(typeOptions('es')) },
    pricesUsd: { all: 'Precio: todos', p1: 'Hasta US$ 100k', p2: 'US$ 100k – 200k', p3: 'Más de US$ 200k' },
    pricesPyg: { all: 'Precio: todos', p1: 'Hasta US$ 500/mes', p2: 'US$ 500 – 1.000/mes', p3: 'Más de US$ 1.000/mes' },
    beds: { all: 'Dormitorios: todos', b1: '1+', b2: '2+', b3: '3+' },
    sort: { relevancia: 'Relevancia', precio_asc: 'Precio: menor a mayor', precio_desc: 'Precio: mayor a menor', area_desc: 'Superficie: mayor primero' },
    listView: 'Lista', mapView: 'Mapa',
    nearMe: 'Cerca de mí', myLocation: 'Mi ubicación',
    geoDenied: 'No pudimos acceder a tu ubicación',
    inArea: 'Propiedades en el área del mapa', showAll: 'Ver todas', emptyArea: 'No hay propiedades en esta zona. Alejá o mové el mapa.',
    loadMore: 'Ver más propiedades', showing: (n, total) => `Mostrando ${n} de ${total}`,
    ownerDirect: 'Perfil del vendedor',
  },
  en: {
    searchPh: 'Search by neighborhood or type…',
    empty: 'No results — try another neighborhood',
    types: { all: 'Type: all', ...Object.fromEntries(typeOptions('en')) },
    pricesUsd: { all: 'Price: any', p1: 'Under US$ 100k', p2: 'US$ 100k – 200k', p3: 'Over US$ 200k' },
    pricesPyg: { all: 'Price: any', p1: 'Under US$ 500/mo', p2: 'US$ 500 – 1,000/mo', p3: 'Over US$ 1,000/mo' },
    beds: { all: 'Bedrooms: any', b1: '1+', b2: '2+', b3: '3+' },
    sort: { relevancia: 'Relevance', precio_asc: 'Price: low to high', precio_desc: 'Price: high to low', area_desc: 'Area: largest first' },
    listView: 'List', mapView: 'Map',
    nearMe: 'Near me', myLocation: 'My location',
    geoDenied: "We couldn't access your location",
    inArea: 'Properties in the map area', showAll: 'Show all', emptyArea: 'No properties in this area. Zoom out or move the map.',
    loadMore: 'Load more properties', showing: (n, total) => `Showing ${n} of ${total}`,
    ownerDirect: 'Seller profile',
  },
  pt: {
    searchPh: 'Pesquisar por bairro ou tipo…',
    empty: 'Sem resultados — tente outro bairro',
    types: { all: 'Tipo: todos', ...Object.fromEntries(typeOptions('pt')) },
    pricesUsd: { all: 'Preço: todos', p1: 'Até US$ 100k', p2: 'US$ 100k – 200k', p3: 'Acima de US$ 200k' },
    pricesPyg: { all: 'Preço: todos', p1: 'Até US$ 500/mês', p2: 'US$ 500 – 1.000/mês', p3: 'Acima de US$ 1.000/mês' },
    beds: { all: 'Quartos: todos', b1: '1+', b2: '2+', b3: '3+' },
    sort: { relevancia: 'Relevância', precio_asc: 'Preço: do menor ao maior', precio_desc: 'Preço: do maior ao menor', area_desc: 'Área: maior primeiro' },
    listView: 'Lista', mapView: 'Mapa',
    nearMe: 'Perto de mim', myLocation: 'Minha localização',
    geoDenied: "Não conseguimos acessar sua localização",
    inArea: 'Imóveis na área do mapa', showAll: 'Mostrar tudo', emptyArea: 'Nenhum imóvel nesta área. Afaste o zoom ou mova o mapa.',
    loadMore: 'Carregar mais imóveis', showing: (n, total) => `Mostrando ${n} de ${total}`,
    ownerDirect: 'Perfil do vendedor',
  },
};

// List page size — the map plots every match (clustered), the list grows 24 at a time.
const PER_PAGE = 24;

// accent- and case-insensitive text for search ("asuncion" should match "Asunción")
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// A picked place → its box right away (Omar, Nov 22: "the zoom and the list should change at
// once"): the map flies to it, the list's area is that box (so the FIRST request is already
// "this place, on the map"), and pins / cards outside it go at once instead of after the reply.
// The box is the place's own (misplaced pins left out) plus ~200 m so its edge listings stay in.
const placeBox = (p) => (p?.bounds ? { n: p.bounds.n + 0.002, s: p.bounds.s - 0.002, e: p.bounds.e + 0.002, w: p.bounds.w - 0.002 } : null);
const inBox = (box) => (o) => !!o && o.lat != null && o.lng != null && o.lat <= box.n && o.lat >= box.s && o.lng <= box.e && o.lng >= box.w;

export default function MarketplaceClient({ initialListings = [], initialCount = 0, initialPins = [], totalCount = 0, initialOp = 'all', initialQuery = '', initialType = 'all', initialPlace = '', zoningOn = false }) {
  const [lang, setLang] = useLang();
  const { openSell } = useSellFlow();
  const [filter, setFilter] = useState(['all', 'venta', 'alquiler'].includes(initialOp) ? initialOp : 'all');
  // `query` is the APPLIED search (drives the fetches); `queryInput` is just the text
  // box. Typing never searches — only the arrow button / Enter copies it over.
  const [query, setQuery] = useState(initialQuery || '');
  const [queryInput, setQueryInput] = useState(initialQuery || '');
  const [searching, setSearching] = useState(false); // spinner in the search button
  // A barrio / city / departamento picked from the suggestions (lib/places.js): the list and
  // pins are that place's listings, the map fits to it and draws its outline.
  const [placeSel, setPlaceSel] = useState(initialPlace ? { id: initialPlace, name: initialQuery } : null);
  const placeId = placeSel ? placeSel.id : '';
  const places = usePlaces(true);   // suggestions + barrio names on the map
  const [placeArea, setPlaceArea] = useState(null);
  const placeAreaRef = useRef(null);
  placeAreaRef.current = placeArea;
  const [typeF, setTypeF] = useState(initialType || 'all');
  const [priceF, setPriceF] = useState('all');
  const [bedF, setBedF] = useState('all');
  const [heightF, setHeightF] = useState('all');     // allowed building height (Asunción zoning)
  const [showZoning, setShowZoning] = useState(false);
  const [sortBy, setSortBy] = useState('relevancia');
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // mobile: 'list' | 'map'
  const [hot, setHot] = useState(null);
  const [mapReady, setMapReady] = useState(false); // show a branded loader until tiles paint
  // Bumped once the Google map exists, so the pins effect redraws with the CURRENT
  // pins: they often arrive before the Maps script has loaded, and the init code only
  // sees the first render's (empty) list — that left the map without pins.
  const [mapOn, setMapOn] = useState(0);
  // "My location" / "Near me" — the user's real coords (country-agnostic; falls
  // back to COUNTRY.mapCenter on denial), a near-me radius toggle, and a small
  // non-blocking toast when geolocation is unavailable.
  const [userLoc, setUserLoc] = useState(null);
  const [nearMe, setNearMe] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const youMarkerRef = useRef(null);
  const geoMsgTimer = useRef(null);
  const prevViewRef = useRef(null);   // map center+zoom saved when near-me is turned on
  const skipFitRef = useRef(false);   // one-shot: skip the next auto-fit (near-me toggle)
  const nearMeRef = useRef(false);    // latest nearMe, for the map-click listener closure
  const deactivateNearRef = useRef(null);
  // Feature images are NOT shipped with the listings (keeps the page light);
  // they're fetched lazily for the cards/popups actually on screen.
  const [imgMap, setImgMap] = useState({}); // { id: url | null }
  const [nearListings, setNearListings] = useState(null); // hydrated nearby listings when near-me is on
  const imgMapRef = useRef({});             // latest map, for imperative Leaflet handlers
  const imgReq = useRef(new Set());         // ids already requested (dedupe)
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const zoningLoading = useZoningOverlay(mapRef, zoningOn && showZoning, heightF);
  const clusterRef = useRef(null);
  const infoRef = useRef(null); // shared Google InfoWindow (hover popup)
  const markersRef = useRef({});
  const promotedMarkersRef = useRef([]);    // paid pins kept OUT of the clusterer (always visible)
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

  // ---- server-driven data: a paginated search page + all-pins for the map ----
  // Filters/search/sort hit /api/listings/search (all ~25k), not a client slice.
  const [rows, setRows] = useState(initialListings);
  const [count, setCount] = useState(initialCount || totalCount || 0);
  const [pins, setPins] = useState(initialPins);
  const [loadingList, setLoadingList] = useState(false);
  const [page, setPage] = useState(1);
  const reqRef = useRef(0);       // pins requests
  const listReqRef = useRef(0);   // list requests (filters and map area)
  // Listings follow the map: after the visitor drags or zooms, the list shows only
  // the listings inside the visible area (lib/mapArea.js). null = everything.
  const [area, setArea] = useState(null);
  const areaRef = useRef(null);
  areaRef.current = area;
  const userMovedRef = useRef(false);
  const camMoveUntil = useRef(0);  // our own camera moves (auto-fit, near me) aren't the visitor's
  const moveCamera = (fn) => { camMoveUntil.current = Date.now() + 1500; try { fn(); } catch {} };
  const firstRun = useRef(true); // initial page is SSR'd → don't refetch on mount

  // Desktop price bands (M.pricesUsd / pricesPyg) → USD min/max for the API.
  const priceBounds = () => {
    if (priceF === 'all') return {};
    if (isRent) return priceF === 'p1' ? { priceMax: 500 } : priceF === 'p2' ? { priceMin: 500, priceMax: 1000 } : { priceMin: 1000 };
    return priceF === 'p1' ? { priceMax: 100000 } : priceF === 'p2' ? { priceMin: 100000, priceMax: 200000 } : { priceMin: 200000 };
  };
  const bedsParam = bedF === 'all' ? undefined : bedF.replace(/\D/g, '');
  const searchBody = (pageN) => ({ op: filter, type: typeF === 'all' ? undefined : typeF, beds: bedsParam, q: query || undefined, place: placeId || undefined, height: heightF === 'all' ? undefined : heightF, sort: sortBy, page: pageN, pageSize: PER_PAGE, ...priceBounds(), ...(area || {}) });
  const pinsUrl = () => {
    const p = new URLSearchParams();
    if (filter !== 'all') p.set('op', filter);
    if (typeF !== 'all') p.set('type', typeF);
    if (bedsParam) p.set('beds', bedsParam);
    if (query) p.set('q', query);
    if (placeId) p.set('place', placeId);
    if (heightF !== 'all') p.set('height', heightF);
    const pb = priceBounds();
    if (pb.priceMin != null) p.set('priceMin', pb.priceMin);
    if (pb.priceMax != null) p.set('priceMax', pb.priceMax);
    return `/api/listings/pins?${p.toString()}`;
  };

  useEffect(() => {
    const id = ++reqRef.current;
    const lid = ++listReqRef.current;
    const doSearch = !firstRun.current; // mount: list is SSR'd, only load the pins
    firstRun.current = false;
    if (doSearch) setLoadingList(true);
    const tmo = setTimeout(async () => {
      if (doSearch) {
        try {
          const res = await gatedFetch('/api/listings/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(searchBody(1)) });
          const j = await res.json();
          if (lid === listReqRef.current) { setRows(j.listings || []); setCount(j.count || 0); setPage(1); }
        } catch { if (lid === listReqRef.current) { setRows([]); setCount(0); } }
        finally { if (lid === listReqRef.current) setLoadingList(false); }
      }
      // A failed request keeps the pins already on the map instead of emptying it.
      try { const pr = await gatedFetch(pinsUrl()); const pj = pr.ok ? await pr.json() : null; if (id === reqRef.current && Array.isArray(pj?.pins)) { didFit.current = false; setPins(pj.pins); } } catch {}
    }, doSearch ? 220 : 0);
    return () => clearTimeout(tmo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, typeF, priceF, bedF, heightF, query, placeId, sortBy]);

  // The visitor moved the map (or chose "Show all") → reload the list only; the pins
  // on the map stay as they are.
  const areaFirstRun = useRef(true);
  useEffect(() => {
    if (areaFirstRun.current) { areaFirstRun.current = false; return; }
    const lid = ++listReqRef.current;
    setLoadingList(true);
    (async () => {
      try {
        const res = await gatedFetch('/api/listings/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(searchBody(1)) });
        const j = await res.json();
        if (lid === listReqRef.current) { setRows(j.listings || []); setCount(j.count || 0); setPage(1); }
      } catch { if (lid === listReqRef.current) { setRows([]); setCount(0); } }
      finally { if (lid === listReqRef.current) setLoadingList(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area]);

  const loadMore = async () => {
    const next = page + 1;
    try {
      const res = await gatedFetch('/api/listings/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(searchBody(next)) });
      const j = await res.json();
      setRows((prev) => [...prev, ...(j.listings || [])]); setPage(next);
    } catch { /* keep current */ }
  };

  const rowsById = useMemo(() => new Map(rows.map((l) => [l.id, l])), [rows]);
  const pinsById = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);
  const headerCount = (nearMe && nearListings) ? nearListings.length : count;

  // Lazily fetch feature images for a set of ids (deduped). imgMapRef is the
  // source of truth (readable synchronously by the imperative map popups);
  // setImgMap re-renders the cards. Missing/failed ids resolve to null.
  const ensureImages = useCallback(async (ids) => {
    const need = (ids || []).filter((id) => id && !imgReq.current.has(id));
    if (!need.length) return;
    need.forEach((id) => imgReq.current.add(id));
    let got = {};
    try {
      const res = await gatedFetch('/api/listings/images', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: need }),
      });
      got = (await res.json()).images || {};
    } catch { got = {}; }
    const merged = { ...imgMapRef.current };
    need.forEach((id) => { merged[id] = got[id] || null; });
    imgMapRef.current = merged;
    setImgMap(merged);
  }, []);

  // Load feature images for the loaded list cards whenever results grow.
  useEffect(() => { ensureImages(rows.map((l) => l.id)); }, [rows, ensureImages]);

  // Report the active filter set to analytics, debounced so free-text typing
  // doesn't fire an event per keystroke. Captures the initial view too. Waits for the
  // search fetch to settle so results_count is the new total, not the old page.
  useEffect(() => {
    if (loadingList) return;
    const id = setTimeout(() => {
      // Desktop layout only — on phones MobileMarketplace reports the search (this
      // component is still mounted there, hidden by CSS).
      if (!window.matchMedia('(min-width: 768px)').matches) return;
      track('search_applied', {
        operation: filter,
        query: query || null,
        property_type: typeF,
        price_range: priceBand(priceBounds()),
        bedrooms: bedF,
        allowed_height: heightF,
        sort: sortBy,
        results_count: count,
      });
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, typeF, priceF, bedF, heightF, query, sortBy, loadingList]);

  // Apply the typed search. Unchanged text = nothing to fetch. The spinner clears
  // when the list request it triggers settles (loadingList true -> false).
  // A new search starts on the whole map again (not inside the area of the last one).
  const pickPlace = (p) => {
    setQueryInput(p.name);
    if (p.id === placeId && p.name === query) return;
    setSearching(true);
    const box = placeBox(p);
    setArea(box ? roundArea(box) : null);
    if (box) {
      setPins((ps) => ps.filter(inBox(box)));
      setRows((rs) => rs.filter(inBox(box)));
      const ref = mapRef.current;
      if (ref) { didFit.current = true; moveCamera(() => fitBox(ref.google, ref.map, p.bounds, { padding: 48, maxZoom: p.kind === 'barrio' ? 16 : 15 })); }
    }
    setPlaceSel({ id: p.id, name: p.name }); setQuery(p.name);
  };
  const applyText = (text) => {
    const next = String(text || '').trim();
    setQueryInput(next);
    if (next === query && !placeId) return;
    setSearching(true); setArea(null);
    setPlaceSel(null); setQuery(next);
  };
  // Enter / the arrow: a text naming a place picks it (lib/places.js exactPlace), else a text search.
  const applySearch = (e) => {
    e?.preventDefault?.();
    if (placeSel && queryInput.trim() === placeSel.name) return;   // the picked place, unchanged
    submitSearch(places.index, queryInput, { onPick: pickPlace, onText: applyText, lang });
  };

  // A search that arrived as text (?q=Villa Morra from a home chip / an old link, or Enter
  // pressed before the suggestions loaded) and names a place outright → that place, so the
  // map shows its area instead of every listing that mentions the words.
  const upgradedRef = useRef(false);
  useEffect(() => {
    if (upgradedRef.current || !places.index) return;
    upgradedRef.current = true;
    if (placeId || !query || query !== initialQuery || queryInput.trim() !== query) return;
    const p = exactPlace(places.index, query);
    if (p) { setQueryInput(p.name); setPlaceSel({ id: p.id, name: p.name }); setQuery(p.name); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.index]);

  // The picked place's outline / label / box (lib/placeIndex.js via /api/listings/places?id=).
  useEffect(() => {
    setPlaceArea(null);
    if (!placeId) return undefined;
    let on = true;
    loadPlaceArea(placeId).then((a) => { if (on) setPlaceArea(a); });
    return () => { on = false; };
  }, [placeId]);
  // Draw it and fit the map to it: the place's own box (misplaced pins left out, never
  // smaller than a few blocks), not the bounds of every pin.
  useEffect(() => {
    const ref = mapRef.current;
    if (!ref || !placeArea) return undefined;
    const { google, map } = ref;
    const outline = placeOutline(google, map, placeArea);
    if (!nearMeRef.current && !areaRef.current) {
      didFit.current = true;
      moveCamera(() => fitBox(google, map, placeArea.bounds, { padding: 48, maxZoom: placeArea.kind === 'barrio' ? 16 : 15 }));
      // The list = the picked place's listings THAT ARE ON THE MAP (Omar, Nov 22): once the map has
      // settled on the place, its visible area becomes the list's area, exactly as if the visitor had
      // moved the map. Listings of the place left off the map (no location, misplaced pin) drop out;
      // dragging / zooming further narrows it the usual way (the 'idle' listener).
      const once = google.maps.event.addListenerOnce(map, 'idle', () => {
        if (nearMeRef.current) return;
        const b = map.getBounds();
        if (!b) return;
        const ne = b.getNorthEast(); const sw = b.getSouthWest();
        setArea(roundArea({ n: ne.lat(), s: sw.lat(), e: ne.lng(), w: sw.lng() }));
      });
      return () => { outline.remove(); google.maps.event.removeListener(once); };
    }
    return () => outline.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeArea, mapOn]);
  // Barrio names on the map once zoomed in (the picked barrio has its own label).
  useEffect(() => {
    const ref = mapRef.current;
    if (!ref || !places.labels) return undefined;
    const layer = barrioLabelLayer(ref.google, ref.map, places.labels, { hide: () => (placeAreaRef.current && placeAreaRef.current.kind === 'barrio' ? placeAreaRef.current.id : null) });
    return () => layer.remove();
  }, [places.labels, mapOn]);
  useEffect(() => { if (!loadingList) setSearching(false); }, [loadingList]);

  // ---- display helpers ----
  const title = (l) => {
    let tp = typeLabel(l.type, lang) || tr(lang, 'Inmueble', 'Property', 'Imóvel');
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
  // A price we couldn't verify (lib/unverified.js; pins carry nv) reads "Contact seller for price".
  const noPrice = (l) => !!l.nv || isUnverified(l, 'price');
  const priceMain = (l) => (noPrice(l) ? contactSellerFor('price', lang) : (fmtUsd(l.usd, lang) || '—') + (l.mode === 'alquiler' ? t.perMonth : ''));
  const priceSub = (l) => (!noPrice(l) && fmtPyg(l.pyg, lang) ? fmtPyg(l.pyg, lang) + (l.mode === 'alquiler' ? t.perMonth : '') : '');
  const shortPill = (l) => (noPrice(l) ? NO_PRICE_PIN : shortUsd(l.usd));

  // ---- geolocation: "my location" recenter + "near me" radius filter ----
  const showGeoMsg = (text) => {
    setGeoMsg(text);
    if (geoMsgTimer.current) clearTimeout(geoMsgTimer.current);
    geoMsgTimer.current = setTimeout(() => setGeoMsg(''), 3400);
  };
  // Resolve a listing's coords (rows carry lat/lng; fall back to the pin set).
  const coordsOf = (l) => {
    if (l && l.lat != null && l.lng != null) return { lat: l.lat, lng: l.lng };
    const p = pinsById.get(l?.id);
    return p && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;
  };
  // Drop / move the distinct blue "you are here" marker.
  const dropYouMarker = (loc) => {
    const ref = mapRef.current;
    if (!ref) return;
    const { google, map } = ref;
    if (youMarkerRef.current) { try { youMarkerRef.current.setMap(null); } catch {} }
    youMarkerRef.current = new google.maps.Marker({
      position: loc, map, zIndex: 99999, icon: youAreHereIcon(google),
      title: tr(lang, 'Estás aquí', 'You are here', 'Você está aqui'),
    });
  };
  // Locate + "near me" as ONE toggle, fired by the map's triangle button. On:
  // find the user, drop the you-are-here dot, zoom in and LOCK the map on that
  // spot (gestures off), restricting the list + pins to what's nearby. Off:
  // unlock, remove the dot, restore the full results.
  // Turn near-me OFF: clear the selection, drop the you-are-here dot, and return
  // the map to where it was before. The map is never locked, so drag/zoom stay
  // free while selected; a plain click on the map also calls this.
  const deactivateNear = () => {
    const ref = mapRef.current;
    skipFitRef.current = true;
    setNearMe(false);
    setNearListings(null);
    if (youMarkerRef.current) { try { youMarkerRef.current.setMap(null); } catch {} youMarkerRef.current = null; }
    if (ref && prevViewRef.current) { const v = prevViewRef.current; moveCamera(() => { ref.map.setZoom(v.zoom); ref.map.panTo(v.center); }); }
    prevViewRef.current = null;
  };
  nearMeRef.current = nearMe;
  deactivateNearRef.current = deactivateNear;

  const toggleNear = async () => {
    if (nearMe) { deactivateNear(); return; }
    setLocating(true);
    const loc = userLoc || await getUserLocation();
    setLocating(false);
    if (!loc) { showGeoMsg(m.geoDenied); return; }
    const ref = mapRef.current;
    // Remember the current view so deselect can return to it.
    if (ref) { try { prevViewRef.current = { center: ref.map.getCenter().toJSON(), zoom: ref.map.getZoom() }; } catch {} }
    skipFitRef.current = true;
    setUserLoc(loc);
    setNearMe(true);
    setArea(null);           // near me shows its own list
    loadNearListings(loc);   // hydrate the real nearby list + count
    if (ref) {
      moveCamera(() => { ref.map.panTo(loc); ref.map.setZoom(15); });   // no lock — user can pan/zoom freely
      dropYouMarker(loc);
    }
  };

  // The list the user sees: normal rows, or — when "near me" is on and we have
  // coords — only listings within NEAR_RADIUS_KM, nearest first. Combines with
  // every other (server-applied) filter since it operates on the current rows.
  // When near-me is on, the list = the nearby listings hydrated from the near
  // pins (nearest first); otherwise the normal paginated rows.
  const displayRows = (nearMe && nearListings) ? nearListings : rows;

  // Fetch full card data for every listing within NEAR_RADIUS_KM of `loc`
  // (nearest first, capped at 200) so the near-me list + count are accurate.
  const loadNearListings = async (loc) => {
    const near = pins
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ id: p.id, d: distanceKm(loc.lat, loc.lng, p.lat, p.lng) }))
      .filter((x) => x.d <= NEAR_RADIUS_KM)
      .sort((a, b) => a.d - b.d)
      .slice(0, 200);
    const ids = near.map((x) => x.id);
    if (!ids.length) { setNearListings([]); return; }
    try {
      const res = await fetch('/api/mobile/byids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const j = await res.json();
      const byId = new Map((j.listings || []).map((l) => [l.id, l]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
      setNearListings(ordered);
      setImgMap((mp) => { const n = { ...mp }; ordered.forEach((l) => { if (l.image) n[l.id] = l.image; }); return n; });
    } catch { setNearListings([]); }
  };

  // Pins shown on the map: all of them, or — when "near me" is active — only the
  // ones within NEAR_RADIUS_KM of the user, so the map and list stay in sync.
  const displayPins = useMemo(() => {
    if (!nearMe || !userLoc) return pins;
    return pins.filter((p) => p.lat != null && p.lng != null && distanceKm(userLoc.lat, userLoc.lng, p.lat, p.lng) <= NEAR_RADIUS_KM);
  }, [nearMe, userLoc, pins]);

  // "Show all": the whole list again AND the map zoomed out to fit every listing
  // (a camera move of ours, so it doesn't filter the list to the map again).
  const showAllArea = () => {
    setArea(null);
    const ref = mapRef.current;
    if (!ref) return;
    // Lone pins far from all the others (a bad geocode) don't stretch the view.
    const b = searchBounds(displayPins.filter((l) => l.lat != null && l.lng != null && inParaguay(l.lat, l.lng)).map((l) => [l.lat, l.lng]));
    if (b) moveCamera(() => fitBox(ref.google, ref.map, b, { padding: 40, maxZoom: 16 }));
  };

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
      camMoveUntil.current = Date.now() + 2500;   // the map's own first render isn't a visitor move
      const map = new google.maps.Map(mapEl.current, mapOptions(google, { center: COUNTRY.mapCenter, zoom: COUNTRY.mapZoom, gestureHandling: 'greedy' }));
      const info = new google.maps.InfoWindow({ disableAutoPan: true });
      // Cluster bubble → brand-coloured SVG pill (matches `.cluster-pill`).
      const renderer = {
        render: ({ count, position }) => new google.maps.Marker({ position, zIndex: 1000 + count, icon: clusterIcon(google, count, false) }),
      };
      // Bigger radius → fewer, larger clusters so the streets stay readable when
      // there are many listings (was 46). Zoom in to break clusters apart.
      const cluster = new MarkerClusterer({ map, renderer, algorithm: new SuperClusterAlgorithm({ radius: 90, maxZoom: 16 }) });
      mapRef.current = { google, map };
      clusterRef.current = cluster;
      infoRef.current = info;
      // A click on the map (not a pin) exits near-me and returns to the prior view.
      map.addListener('click', () => { if (nearMeRef.current && deactivateNearRef.current) deactivateNearRef.current(); });
      // Listings follow the map: when the visitor drags or zooms, the list switches to
      // the listings inside the visible area once the map settles.
      map.addListener('dragstart', () => { userMovedRef.current = true; });
      map.addListener('zoom_changed', () => { if (Date.now() > camMoveUntil.current) userMovedRef.current = true; });
      map.addListener('idle', () => {
        if (!userMovedRef.current) return;
        userMovedRef.current = false;
        if (nearMeRef.current) return;
        const b = map.getBounds();
        if (!b) return;
        const ne = b.getNorthEast(); const sw = b.getSouthWest();
        setArea(roundArea({ n: ne.lat(), s: sw.lat(), e: ne.lng(), w: sw.lng() }));
      });
      google.maps.event.addListenerOnce(map, 'tilesloaded', () => { if (!cancelled) setMapReady(true); });
      setTimeout(() => { if (!cancelled) setMapReady(true); }, 1500);
      setMapOn((n) => n + 1);   // → the pins effect draws the current pins
    })();
    return () => { cancelled = true; mapRef.current = null; clusterRef.current = null; infoRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { didFit.current = false; drawMarkers(); /* eslint-disable-next-line */ }, [pins, lang, nearMe, userLoc, mapOn]);

  // The seller's approved profile photo (lib/sellerPhotos.js: pins carry it as `sp`) — only
  // where there is one; otherwise the popup is unchanged.
  function sellerPhotoHtml(src) {
    if (!src) return '';
    const u = String(src).replace(/["<>]/g, '');
    return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px"><img src="${u}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;border:1px solid rgba(17,17,17,.25)" onerror="this.parentNode.style.display='none'"/><span style="font:500 11px 'Space Grotesk',sans-serif;color:rgba(17,17,17,.55)">${m.ownerDirect}</span></div>`;
  }

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
        ${sellerPhotoHtml(l.sp || l.seller_photo)}
      </div></a>`;
  }

  function drawMarkers() {
    const ref = mapRef.current;
    const cluster = clusterRef.current;
    if (!ref || !cluster) return;
    const { google, map } = ref;
    cluster.clearMarkers();
    // Promoted pins live directly on the map (not in the clusterer) — remove the
    // previous batch before redrawing.
    promotedMarkersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
    promotedMarkersRef.current = [];
    markersRef.current = {};
    const markers = [];
    const pts = [];
    let n = 0;
    displayPins.forEach((l) => {
      if (!inParaguay(l.lat, l.lng)) return; // never plot mis-geocoded listings outside PY
      const label = shortPill(l);
      const promoted = !!(l.hl || l.verified);
      const marker = new google.maps.Marker({ position: { lat: l.lat, lng: l.lng }, icon: pinIcon(google, label, false, { promoted }), zIndex: promoted ? 10000 : undefined });
      marker.__label = label;
      marker.__promoted = promoted;
      marker.addListener('mouseover', () => setHot(l.id));
      marker.addListener('mouseout', () => setHot(null));
      marker.addListener('click', () => {
        const full = rowsById.get(l.id) || l;
        track('map_pin_clicked', {
          property_id: l.id,
          mode: full.mode || l.mode,
          location_name: full.neighborhood || full.city || full.address || null,
          neighborhood: full.neighborhood || null,
          city: full.city || null,
          address: full.address || null,
          province: full.province || null,
          lat: l.lat, lng: l.lng,
        });
        window.open(`/propiedad/${l.id}`, '_blank', 'noopener');
      });
      markersRef.current[l.id] = marker;
      // A paid listing is never swallowed by a cluster — add it straight to the map so
      // it's always visible; everything else goes through the clusterer as before.
      if (promoted) { marker.setMap(map); promotedMarkersRef.current.push(marker); }
      else markers.push(marker);
      pts.push([l.lat, l.lng]);
      n++;
    });
    cluster.addMarkers(markers);
    // Default view stays zoomed on Asunción; only auto-fit to the results once
    // the user actually filters/searches (Buy/Rent/All keep the default view).
    const isFiltered = typeF !== 'all' || priceF !== 'all' || bedF !== 'all' || heightF !== 'all' || !!query || !!placeId;
    // Don't refit while near-me is locked, nor on the toggle itself (so deselect
    // can restore the previous view instead of snapping to the filtered bounds).
    // A picked place with its outline loaded is fitted to its own box (placeArea effect).
    // Otherwise: the matches, minus lone pins far from all the others (a flat geocoded into
    // the Chaco), never closer than a couple of blocks (lib/areaGeom.js).
    if (n && !didFit.current && isFiltered && !nearMe && !skipFitRef.current && !areaRef.current && !(placeId && placeAreaRef.current)) {
      didFit.current = true;
      const b = searchBounds(pts);
      if (b) moveCamera(() => fitBox(google, map, b, { padding: 40, maxZoom: 16 }));
    }
    skipFitRef.current = false;
  }

  // Highlight the hovered card's pin on the map — the pin itself, or the cluster
  // bubble that contains it at this zoom. The map never moves on hover (moving the
  // map is what filters the list, see the 'idle' listener).
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
      mk.setIcon(pinIcon(google, mk.__label, true, { promoted: mk.__promoted }));
      hoverRevealRef.current = hot;
      const l = rowsById.get(hot) || pinsById.get(hot);
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
        <div className="flex flex-col gap-0.5 leading-none">
          <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">{COUNTRY.tld}</em></Link>
        </div>
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
            {['es', 'en', 'pt'].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`h-full flex items-center px-3 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>
            ))}
          </div>
          <AuthButton />
          <button onClick={openSell} className="inline-flex items-center h-[40px] px-[18px] rounded-pill bg-ink text-paper text-[14px] font-medium border border-ink">{t.cta}</button>
        </div>
      </nav>


      {/* FILTERS */}
      <div className="flex items-center gap-2.5 flex-wrap px-5 md:px-9 py-3 border-b border-ink/12">
        <form role="search" onSubmit={applySearch} className="relative flex items-center gap-2 bg-card border-[1.5px] border-ink rounded-pill pl-4 pr-1 py-1 min-w-[min(300px,100%)]">
          <PlaceAutocomplete
            value={queryInput}
            onChange={(v) => { setQueryInput(v); if (!v.trim() && (query || placeId)) { setSearching(true); setPlaceSel(null); setQuery(''); } }}
            index={places.index} onNeedIndex={places.ensure} lang={lang} onPick={pickPlace} onText={applyText}
            placeholder={m.searchPh} ariaLabel={m.searchPh} dropdownClassName="min-w-[340px]"
            className="flex-1 min-w-0 bg-transparent outline-none font-sans font-medium text-[14px] text-ink placeholder:text-[#757575] placeholder:font-normal"
          />
          <button type="submit" aria-label={searching ? tr(lang, 'Buscando…', 'Searching…', 'Buscando…') : tr(lang, 'Buscar', 'Search', 'Buscar')} disabled={searching} aria-busy={searching} className="w-[34px] h-[34px] flex-none flex items-center justify-center rounded-pill bg-ink text-paper disabled:cursor-wait" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 600, lineHeight: 1 }}>{searching ? <SearchSpinner className="w-[18px] h-[18px]" /> : <span aria-hidden="true">→</span>}</button>
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
        {zoningOn && (
          <select value={heightF} onChange={(e) => setHeightF(e.target.value)} className={selCls} title={tr(lang, 'Zonificación: cuántos pisos permite construir la ciudad (solo Asunción)', 'Zoning: how high the city allows building (Asunción only)', 'Zoneamento: quantos andares a cidade permite construir (só Asunción)')}>
            <option value="all">{tr(lang, 'Zonificación · Asunción', 'Zoning · Asunción', 'Zoneamento · Asunción')}</option>
            {CATEGORIES.filter((c) => c.id !== 'otro').map((c) => <option key={c.id} value={c.id}>{c[lang] || c.es}</option>)}
          </select>
        )}
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
            <span className="font-mono text-[12px] text-ink/50">
              {t.results(headerCount)}
              {area && !nearMe && <> · {m.inArea} · <button type="button" onClick={showAllArea} className="underline font-semibold text-ink" data-testid="area-show-all">{m.showAll}</button></>}
            </span>
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
            {displayRows.length === 0 && !loadingList && <div className="py-10 text-center font-mono text-[12px] text-ink/45">{area && !nearMe ? m.emptyArea : m.empty}</div>}
            {displayRows.map((l) => (
              <Link
                key={l.id} href={`/propiedad/${l.id}`} target="_blank" rel="noopener noreferrer"
                onMouseEnter={() => setHot(l.id)} onMouseLeave={() => setHot(null)}
                className={`relative flex items-stretch shrink-0 min-h-[120px] bg-card border rounded-[18px] overflow-hidden transition-all ${l.verified ? 'border-ink ring-[1.5px] ring-ink shadow-hard-sm' : hot === l.id ? 'border-ink -translate-y-0.5 shadow-hard-sm' : 'border-ink/15'}`}
              >
                {l.verified && <VerifiedTag lang={lang} className="absolute top-2 right-2 z-20 text-[9px] px-2 py-0.5" />}
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
                  {l.seller_photo && (
                    <div className="flex items-center gap-1.5 mt-2" data-testid="card-seller-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.seller_photo} alt="" loading="lazy" width={22} height={22} className="w-[22px] h-[22px] rounded-full object-cover border border-ink/25" onError={(e) => { e.currentTarget.parentNode.style.display = 'none'; }} />
                      <span className="text-[11.5px] font-medium text-ink/55">{m.ownerDirect}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
            {/* Pagination — the list grows a page at a time from the server; the map keeps every pin.
                Hidden while "near me" is active (that view is a filtered/sorted client slice). */}
            {!nearMe && rows.length < count && (
              <div className="flex flex-col items-center gap-2 pt-1 pb-2">
                <button
                  onClick={loadMore}
                  className="px-6 py-2.5 rounded-pill bg-ink text-paper text-[13px] font-semibold shadow-hard-soft hover:-translate-y-0.5 transition-transform"
                >
                  {m.loadMore}
                </button>
                <span className="font-mono text-[11px] text-ink/45">{m.showing(rows.length, count)}</span>
              </div>
            )}
          </div>
        </div>
        {/* relative wrapper gives Leaflet a definite-size, clipped box (fixes the
            mobile overflow where pins spilled outside the map) + hosts the loader. */}
        <div className={`relative min-h-0 md:block md:flex-1 md:border-l border-ink/12 ${mobileView === 'list' ? 'hidden' : 'block flex-1'}`}>
          <div ref={mapEl} className="absolute inset-0 z-0 overflow-hidden" />
          {/* "Near me" toggle — Google-style navigation triangle. Click to lock the
              map on the user + show only nearby listings; click again to reset.
              Selected state = filled ink. */}
          <button
            type="button" onClick={toggleNear} aria-pressed={nearMe} aria-label={m.nearMe} title={m.nearMe}
            className={`absolute bottom-[110px] right-4 z-[6] w-10 h-10 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.3)] flex items-center justify-center active:translate-y-px ${nearMe ? 'bg-white text-ink ring-2 ring-ink' : 'bg-white text-[#3c4043] hover:bg-[#f5f5f5]'}`}
          >
            {locating
              ? <span className="w-4 h-4 rounded-full border-2 border-current/20 border-t-current animate-spin" aria-hidden="true" />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(45deg)' }} aria-hidden="true"><path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" /></svg>}
          </button>
          {zoningOn && <ZoningMapToggle on={showZoning} onToggle={() => setShowZoning((v) => !v)} height={heightF} loading={zoningLoading} lang={lang} className="absolute top-3 right-3 z-[6]" />}
          {geoMsg && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[7] max-w-[90%] px-3.5 py-2 rounded-pill bg-ink text-paper text-[12px] font-medium shadow-hard-sm text-center">{geoMsg}</div>
          )}
          {!mapReady && (
            <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3" style={{ background: 'repeating-linear-gradient(45deg,#EAE6DD,#EAE6DD 10px,#F4F1EA 10px,#F4F1EA 20px)' }}>
              <span className="w-7 h-7 rounded-full border-2 border-ink/20 border-t-ink animate-spin" aria-hidden="true" />
              <span className="font-mono text-[12px] text-ink/55">{tr(lang, 'Cargando mapa…', 'Loading map…', 'Carregando mapa…')}</span>
            </div>
          )}
        </div>
      </div>
      {/* APP BADGES — the last row of the screen (this page never scrolls), components/AppBadges.js */}
      <StickyAppBadges inline placement="listings" />
    </div>
  );
}
