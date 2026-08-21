'use client';
// Property detail page — a faithful build of Casa Libre "Detalle" mockup:
// nav · breadcrumb · grid gallery (+ lightbox) · kicker/title/price-line ·
// bordered specs rail · description · features · publish-meta · WhatsApp contact
// card · mobile sticky bar. Bilingual labels (ES default) via useLang; property
// content comes from the DB.
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { typeLabel } from '@/lib/propertyType';
import { track } from '@/lib/analytics';
import { fmtUsd, fmtPyg, normalizePy, clRef } from '@/lib/ui';
import PropertyContactCard from '@/components/PropertyContactCard';
import NoResponseReport from '@/components/NoResponseReport';
import SaveButton from '@/components/SaveButton';

const T = {
  es: {
    tabs: [['Comprar', '/propiedades?op=venta'], ['Alquilar', '/propiedades?op=alquiler'], ['Vender', '/publicar']],
    cta: 'Publicar gratis', crumbHome: 'Inicio', crumbList: 'Propiedades',
    forSale: 'Venta', forRent: 'Alquiler', perMonth: '/mes', bedShort: 'dorm',
    specBeds: 'Dormitorios', specBaths: 'Baños', specBuilt: 'm² construidos', specLot: 'm² terreno', specPark: 'Cocheras',
    descH: 'Descripción', featH: 'Características', locH: 'Ubicación', published: 'Publicado', ref: 'Ref', photoSoon: 'Foto próximamente',
  },
  en: {
    tabs: [['Buy', '/propiedades?op=venta'], ['Rent', '/propiedades?op=alquiler'], ['Sell', '/publicar']],
    cta: 'List for free', crumbHome: 'Home', crumbList: 'Listings',
    forSale: 'For sale', forRent: 'For rent', perMonth: '/mo', bedShort: 'bd',
    specBeds: 'Bedrooms', specBaths: 'Bathrooms', specBuilt: 'm² built', specLot: 'm² lot', specPark: 'Parking',
    descH: 'Description', featH: 'Features', locH: 'Location', published: 'Listed', ref: 'Ref', photoSoon: 'Photo coming soon',
  },
};

const stripe = 'repeating-linear-gradient(45deg,#eae6dd,#eae6dd 10px,#f4f1ea 10px,#f4f1ea 20px)';

const WaGlyph = ({ size = 19 }) => (
  <svg viewBox="0 0 32 32" fill="currentColor" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M16.04 3C9.02 3 3.32 8.7 3.32 15.72c0 2.24.59 4.43 1.71 6.36L3.2 28.8l6.89-1.8a12.66 12.66 0 0 0 5.95 1.51h.01c7.01 0 12.72-5.7 12.72-12.72 0-3.4-1.32-6.6-3.72-9A12.65 12.65 0 0 0 16.04 3Zm0 23.36h-.01c-1.9 0-3.76-.51-5.38-1.47l-.39-.23-4.09 1.07 1.09-3.98-.25-.41a10.55 10.55 0 0 1-1.62-5.62c0-5.83 4.75-10.57 10.58-10.57 2.83 0 5.48 1.1 7.48 3.1a10.5 10.5 0 0 1 3.1 7.48c0 5.83-4.75 10.57-10.57 10.57Zm5.8-7.92c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.72.16-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.5-2.56-1.58-.95-.85-1.58-1.9-1.77-2.21-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.25 3.44 5.46 4.83.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.61-.09 1.88-.77 2.15-1.51.26-.74.26-1.38.19-1.51-.08-.13-.29-.21-.61-.37Z" />
  </svg>
);

const fmtDate = (v, lang) => {
  if (!v) return null;
  try {
    return new Date(v).toLocaleDateString(lang === 'es' ? 'es-PY' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  } catch { return null; }
};

export default function PropertyDetailView({ l, url }) {
  const [lang, setLang] = useLang();
  const [box, setBox] = useState(-1); // lightbox image index; -1 closed
  const t = T[lang] || T.es;
  const mapEl = useRef(null);
  const mapRef = useRef(null);

  // ── derived ──
  // Shared CL ref (tracking + display) — numeric ids render "CL-0002"-style.
  const listingRef = clRef(l.id ?? l.slug);
  const zone = [l.neighborhood, l.city].filter(Boolean).join(', ') || l.address || '';
  const tp = typeLabel(l.type, lang) || (lang === 'es' ? 'Propiedad' : 'Property');
  const title = `${tp}${l.beds ? ` ${l.beds} ${t.bedShort}` : ''}${l.neighborhood ? ` · ${l.neighborhood}` : l.city ? ` · ${l.city}` : ''}`;
  const modeLabel = l.mode === 'alquiler' ? t.forRent : t.forSale;
  const sfx = l.mode === 'alquiler' ? t.perMonth : '';
  // Nav toggle: only the operation matching THIS listing is selected (not both).
  const navActive = l.mode === 'alquiler' ? 1 : 0;
  const hasGeo = l.lat != null && l.lng != null;

  // Location map — a single pin at the property's coordinates (client-only Leaflet).
  useEffect(() => {
    if (!hasGeo) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: false }).setView([l.lat, l.lng], 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      L.marker([l.lat, l.lng], { icon: L.divIcon({ className: '', html: '<div class="marker-pill">•</div>', iconSize: null }) }).addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.lat, l.lng]);

  // Standardized: USD is always the main price; local ₲ is the "≈ …" sub.
  const bigPrice = (fmtUsd(l.usd, lang) || '—');
  const altVal = fmtPyg(l.pyg, lang);
  const altPrice = altVal ? `≈ ${altVal}${sfx}` : '';

  const specs = [
    l.beds != null && [l.beds, t.specBeds],
    l.baths != null && [l.baths, t.specBaths],
    l.covered != null && [`${l.covered}`, t.specBuilt],
    l.lot != null && [`${l.lot}`, t.specLot],
    l.parking != null && [l.parking, t.specPark],
  ].filter(Boolean);

  const paras = (l.description || '').split(/\n{2,}|\r?\n/).map((s) => s.trim()).filter(Boolean);
  const pubDate = fmtDate(l.created_at, lang);

  const imgs = (l.images || []).filter(Boolean);
  const tiles = imgs.slice(0, 4);

  const trackProps = {
    property_id: l.id, slug: l.id, address: l.address || null, city: l.city || null,
    neighborhood: l.neighborhood || null, state: l.province || null, price: l.usd ?? null,
    currency: 'USD', mode: l.mode, type: l.type || null, lat: l.lat ?? null, lng: l.lng ?? null,
  };

  // wa digits — shared normalization (lib/ui.js) so the card and the mobile
  // bar always agree on the same phone format.
  const waDigits = normalizePy(l.contact_phone);
  // Always Spanish — the message reaches a local seller. Same locked format
  // as the contact card (no buyer name here — the mobile bar has no name field).
  const mbarMsg = `¡Hola! ¿Sigue disponible esta propiedad?\n${url}`;
  const mbarWa = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(mbarMsg)}` : null;

  const Tile = ({ src, i, main }) => (
    <div
      onClick={src ? () => setBox(i) : undefined}
      className={`relative overflow-hidden border border-ink/15 rounded-[18px] flex items-center justify-center ${main ? '[grid-row:span_2] max-[720px]:[grid-column:span_2] max-[720px]:[grid-row:auto]' : ''} ${src ? 'cursor-zoom-in' : ''}`}
      style={src ? undefined : { background: stripe }}
    >
      {src
        ? <img src={src} alt="" className="w-full h-full object-cover" />
        : <span className="font-mono text-[11px] text-ink/45 text-center px-2">{t.photoSoon}</span>}
      {main && (
        <span className="absolute top-2.5 left-2.5 text-[10px] font-semibold bg-ink text-paper px-2.5 py-1 rounded-pill">{modeLabel}</span>
      )}
      {main && (
        <SaveButton id={l.id} className="absolute top-2.5 right-2.5 z-10" />
      )}
      {main && imgs.length > 0 && (
        <span className="absolute bottom-2.5 right-2.5 text-[10px] bg-card border border-ink text-ink px-2.5 py-1 rounded-pill">1 / {imgs.length}</span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ── NAV ── */}
      <nav className="flex items-center justify-between flex-wrap gap-3 px-5 md:px-9 py-4 border-b border-ink/12">
        <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
        <div className="hidden md:flex gap-2">
          {t.tabs.map(([label, href], i) => (
            <Link key={label} href={href} className={`inline-flex items-center h-[40px] px-[18px] rounded-pill text-[14px] font-medium border border-ink ${i === navActive ? 'bg-ink text-paper' : ''}`}>{label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center h-[40px] border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((x) => (
              <button key={x} onClick={() => setLang(x)} className={`h-full flex items-center px-3 rounded-pill ${lang === x ? 'bg-ink text-paper' : 'text-ink/55'}`}>{x.toUpperCase()}</button>
            ))}
          </div>
          <Link href="/publicar" className="inline-flex items-center h-[40px] px-[22px] rounded-pill text-[14px] font-medium bg-ink text-paper">{t.cta}</Link>
        </div>
      </nav>

      {/* ── BREADCRUMB ── Home / Listings / City / Neighborhood / Sale|Rent / Type
          / Title. Each filter crumb opens the marketplace pre-filtered in a new tab. */}
      <div className="px-5 md:px-9 pt-4 font-mono text-[12px] text-ink/50 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <Link href="/" className="hover:underline">{t.crumbHome}</Link>
        <span className="text-ink/25">/</span>
        <Link href="/propiedades" className="hover:underline">{t.crumbList}</Link>
        {l.city && (
          <>
            <span className="text-ink/25">/</span>
            <a href={`/propiedades?q=${encodeURIComponent(l.city)}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{l.city}</a>
          </>
        )}
        {l.neighborhood && (
          <>
            <span className="text-ink/25">/</span>
            <a href={`/propiedades?q=${encodeURIComponent(l.neighborhood)}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{l.neighborhood}</a>
          </>
        )}
        <span className="text-ink/25">/</span>
        <a href={`/propiedades?op=${l.mode === 'alquiler' ? 'alquiler' : 'venta'}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{modeLabel}</a>
        <span className="text-ink/25">/</span>
        <a href={`/propiedades?q=${encodeURIComponent(tp)}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{tp}</a>
        <span className="text-ink/25">/</span>
        <span className="text-ink/70">{title}</span>
      </div>

      {/* ── GALLERY ── */}
      <section className="grid gap-3 px-5 md:px-9 pt-4 max-w-[1180px] mx-auto [grid-template-columns:2fr_1fr] [grid-template-rows:180px_180px] max-[720px]:[grid-template-columns:1fr_1fr] max-[720px]:[grid-template-rows:200px_100px]">
        {[0, 1, 2].map((i) => (
          <Tile key={i} src={tiles[i] || null} i={i} main={i === 0} />
        ))}
      </section>

      {/* ── LAYOUT ── */}
      <div className="grid gap-9 items-start px-5 md:px-9 pt-7 pb-28 max-w-[1180px] mx-auto [grid-template-columns:minmax(0,1fr)_360px] max-[920px]:grid-cols-1">
        {/* MAIN */}
        <main>
          <div className="font-mono text-[11px] tracking-[.1em] uppercase text-ink/50">{modeLabel} · {t.ref} {listingRef}</div>
          <h1 className="text-[clamp(24px,3.4vw,34px)] font-bold tracking-head leading-[1.15] mt-1.5 mb-1">{title}</h1>
          <div className="text-[14px] text-ink/55 mb-4">{zone}</div>
          <div className="flex items-baseline gap-3.5 flex-wrap mb-1.5">
            <span className="text-[clamp(22px,3vw,28px)] font-bold tracking-head">{bigPrice}{sfx}</span>
            {altPrice && <span className="font-mono text-[13px] text-ink/50">{altPrice}</span>}
          </div>

          {specs.length > 0 && (
            <div className="flex flex-wrap border-y border-ink/12 mt-[18px] mb-6">
              {specs.map(([v, k], i) => (
                <div key={i} className="py-3.5 pr-6 mr-6 border-r border-ink/12 last:border-r-0 last:mr-0">
                  <b className="block text-[17px] font-bold">{v}</b>
                  <span className="font-mono text-[10px] tracking-[.08em] uppercase text-ink/50">{k}</span>
                </div>
              ))}
            </div>
          )}

          {paras.length > 0 && (
            <>
              <h2 className="text-[18px] font-bold tracking-head mt-6 mb-2.5">{t.descH}</h2>
              <div>{paras.map((p, i) => <p key={i} className="text-[14.5px] leading-[1.6] text-ink/80 mb-3 max-w-[62ch]">{p}</p>)}</div>
            </>
          )}

          {l.features && l.features.length > 0 && (
            <>
              <h2 className="text-[18px] font-bold tracking-head mt-6 mb-2.5">{t.featH}</h2>
              <ul className="list-none p-0 m-0 flex flex-wrap gap-2">
                {l.features.map((f, i) => (
                  <li key={i} className="text-[13px] font-medium bg-card border border-ink/30 rounded-pill px-3.5 py-[7px]">{f}</li>
                ))}
              </ul>
            </>
          )}

          {hasGeo && (
            <>
              <h2 className="text-[18px] font-bold tracking-head mt-6 mb-2.5">{t.locH}</h2>
              {/* relative z-0 = own stacking context so Leaflet's z-1000 zoom
                  control can't poke through the fixed mobile WhatsApp bar. */}
              <div ref={mapEl} className="relative z-0 w-full h-[320px] rounded-[16px] overflow-hidden border border-ink/15" />
            </>
          )}

          <div className="mt-7 pt-3.5 border-t border-ink/12 font-mono text-[11px] text-ink/45 flex gap-[18px] flex-wrap">
            {pubDate && <span>{t.published} {pubDate}</span>}
            <span>{t.ref} {listingRef}</span>
          </div>
        </main>

        {/* CONTACT CARD */}
        <div>
          <PropertyContactCard sellerName={l.user_published ? l.contact_name : null} waDigits={waDigits || null} url={url} listingRef={listingRef} trackProps={trackProps} />
          <div className="flex justify-center text-center">
            <NoResponseReport propertyId={l.id} listingRef={listingRef} sellerName={l.contact_name} sellerPhone={l.contact_phone} />
          </div>
        </div>
      </div>

      {/* ── MOBILE STICKY BAR ── */}
      <div className="hidden max-[920px]:flex fixed left-0 right-0 bottom-0 z-[400] bg-card border-t-[1.5px] border-ink px-3.5 py-2.5 items-center gap-3" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
        <div className="min-w-0">
          <span className="block font-bold text-[15px] leading-tight">{bigPrice}{sfx}</span>
          <small className="block font-mono text-[10px] text-ink/50 truncate">{zone} · {t.ref} {listingRef}</small>
        </div>
        {mbarWa && (
          <a href={mbarWa} target="_blank" rel="noopener noreferrer" onClick={() => track('contact_whatsapp_click', { ref: listingRef, ...(trackProps || {}) })} className="flex-1 flex items-center justify-center gap-2 px-3.5 py-3 rounded-pill text-[14px] font-semibold text-white" style={{ background: '#25D366', border: '1.5px solid #111' }}>
            <WaGlyph /> WhatsApp
          </a>
        )}
      </div>

      {/* ── LIGHTBOX ── */}
      {box >= 0 && imgs[box] && (
        <div className="fixed inset-0 z-[600] bg-ink/90 flex items-center justify-center p-4" onClick={() => setBox(-1)}>
          <button aria-label="Cerrar" onClick={() => setBox(-1)} className="absolute top-4 right-5 w-10 h-10 rounded-pill bg-paper text-ink text-[20px] font-bold flex items-center justify-center">×</button>
          {imgs.length > 1 && (
            <button aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setBox((box - 1 + imgs.length) % imgs.length); }} className="absolute left-4 w-11 h-11 rounded-pill bg-paper/90 text-ink text-[22px] flex items-center justify-center">‹</button>
          )}
          <img src={imgs[box]} alt="" className="max-w-full max-h-[86vh] object-contain rounded-[12px]" onClick={(e) => e.stopPropagation()} />
          {imgs.length > 1 && (
            <button aria-label="Siguiente" onClick={(e) => { e.stopPropagation(); setBox((box + 1) % imgs.length); }} className="absolute right-4 w-11 h-11 rounded-pill bg-paper/90 text-ink text-[22px] flex items-center justify-center">›</button>
          )}
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[12px] text-paper/80">{box + 1} / {imgs.length}</span>
        </div>
      )}
    </div>
  );
}
