'use client';
// Mobile-only home — mirrors the Casa Libre mobile-app landing (ticker, hero,
// Buy/Rent/Sell segmented, search, chips, mascot, dark "just listed" + steps +
// stats, CTA). Rendered only below `md`; the desktop LandingClient is untouched.
// The site Footer is rendered by the page, not here.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useSellFlow } from '@/components/SellFlow';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';

const H = {
  es: {
    cta: 'Publicá gratis', buy: 'Comprar', rent: 'Alquilar', sell: 'Vender',
    heroL1: 'Encontrá tu lugar,', heroL2: 'libremente.',
    heroSub: ['La forma más amigable de comprar,', 'alquilar y vender casas en', 'Asunción.'],
    searchPh: '¿Dónde querés vivir?', mascotCaption: '“¡Vamos que se puede!” — Cuate, tu guía',
    justListed: 'Recién publicadas', justListedSerif: 'lo más nuevo del mercado', viewAll: 'Ver todas →',
    forSale: 'En venta', forRent: 'En alquiler', perMonth: '/mes', bd: 'dorm',
    stepsTitle: 'Tres pasos y listo',
    steps: [
      { n: '1', t: 'Contanos qué buscás', d: 'Barrio, presupuesto, dormitorios. Cuate te muestra solo lo que vale la pena.' },
      { n: '2', t: 'Contactá al publicador', d: 'Escribile por WhatsApp o llamá directo desde el aviso. Sin intermediarios ni vueltas.' },
      { n: '3', t: 'Cerrá el trato a tu manera', d: 'Coordinás la visita y la operación directamente con quien publica. Vos manejás los tiempos.' },
    ],
    statActive: 'propiedades activas', statComm: 'comisión al publicar', statInstant: 'Al instante', statInstantL: 'publicás tu aviso',
    ctaTitle: 'Tu casa te está buscando', ctaSerif: 'a vos.', ctaSub: 'Gratis para buscar, gratis para publicar. Empezá hoy.',
    explore: 'Explorar propiedades', chips: ['Villa Morra', 'Carmelitas', 'Recoleta', 'Las Mercedes', 'Barrio Jara'],
  },
  en: {
    cta: 'List for free', buy: 'Buy', rent: 'Rent', sell: 'Sell',
    heroL1: 'Find your place,', heroL2: 'freely.',
    heroSub: ['The friendliest way to buy,', 'rent and sell homes in', 'Asunción.'],
    searchPh: 'Where do you want to live?', mascotCaption: '“Let’s go!” — Cuate, your guide',
    justListed: 'Just listed', justListedSerif: 'fresh on the market', viewAll: 'View all →',
    forSale: 'For sale', forRent: 'For rent', perMonth: '/mo', bd: 'bd',
    stepsTitle: 'Three steps and you’re in',
    steps: [
      { n: '1', t: 'Tell us what you’re after', d: 'Neighborhood, budget, bedrooms. Cuate only shows you what’s worth your time.' },
      { n: '2', t: 'Contact the publisher', d: 'Message them on WhatsApp or call straight from the listing. No middlemen, no runaround.' },
      { n: '3', t: 'Close the deal your way', d: 'Arrange the visit and the deal directly with whoever posted it. You set the pace.' },
    ],
    statActive: 'active listings', statComm: 'listing commission', statInstant: 'Instant', statInstantL: 'your listing goes live',
    ctaTitle: 'Your home is out there looking', ctaSerif: 'for you.', ctaSub: 'Free to browse, free to list. Start today.',
    explore: 'Explore homes', chips: ['Villa Morra', 'Carmelitas', 'Recoleta', 'Las Mercedes', 'Barrio Jara'],
  },
};

export default function MobileHome({ featured = [], count = 0, tickerData = [] }) {
  const [lang, setLang] = useLang();
  const { openSell } = useSellFlow();
  const router = useRouter();
  const t = H[lang];
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null); // Buy/Rent/Sell — the tapped one stays black (one at a time)
  const go = () => { const query = q.trim(); router.push(query ? `/propiedades?q=${encodeURIComponent(query)}` : '/propiedades'); };
  const ticker = tickerData.length ? tickerData : ['CASA LIBRE — PROPIEDADES EN PARAGUAY'];
  const price = (l) => (fmtUsd(l.usd, lang) || '—') + (l.mode === 'alquiler' ? t.perMonth : '');
  const fTitle = (l) => `${typeLabel(l.type, lang) || (lang === 'es' ? 'Propiedad' : 'Property')}${l.beds ? ` · ${l.beds} ${t.bd}` : ''}`;
  const fMeta = (l) => [[l.neighborhood, l.city].filter(Boolean).join(', '), l.area && `${l.area} m²`].filter(Boolean).join(' · ');

  // The tapped segment stays black (selected) through the route change, instead
  // of only flashing black on :active. One selected at a time.
  const segCls = (k) => `flex-1 text-center py-[13px] rounded-pill text-[15px] font-bold transition-colors ${sel === k ? 'bg-ink text-paper' : 'text-ink'}`;

  return (
    <div className="bg-paper">
      {/* TICKER */}
      <div className="bg-ink text-paper overflow-hidden whitespace-nowrap font-mono text-[12px] py-2">
        <div className="cl-marquee">
          {[0, 1].map((rep) => <span key={rep} className="pr-10">{ticker.map((x, i) => <span key={i} className="px-6 border-r border-paper/30">{x}</span>)}</span>)}
        </div>
      </div>

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <span className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></span>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center border-[1.5px] border-ink rounded-pill overflow-hidden text-[12px] font-semibold">
            {['es', 'en'].map((l) => <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 ${lang === l ? 'bg-ink text-paper' : 'text-ink'}`}>{l.toUpperCase()}</button>)}
          </div>
          <button onClick={openSell} className="bg-ink text-paper rounded-pill px-4 py-[9px] text-[13px] font-bold">{t.cta}</button>
        </div>
      </div>

      {/* HERO */}
      <div className="px-5 pt-6 text-center">
        <h1 className="text-[46px] leading-[1.02] tracking-[-1.5px] font-bold">{t.heroL1}<br /><span className="font-serif italic font-normal">{t.heroL2}</span></h1>
        <p className="text-[17px] leading-[1.5] text-ink/60 mt-5">{t.heroSub.map((line, i) => <span key={i} className="block">{line}</span>)}</p>
      </div>

      {/* BUY / RENT / SELL */}
      <div className="px-4 mt-7">
        <div className="flex bg-card border-[1.5px] border-ink rounded-pill p-1">
          <Link href="/propiedades?op=venta" onClick={() => setSel('venta')} className={segCls('venta')}>{t.buy}</Link>
          <Link href="/propiedades?op=alquiler" onClick={() => setSel('alquiler')} className={segCls('alquiler')}>{t.rent}</Link>
          <button onClick={() => { setSel('sell'); openSell(); }} className={segCls('sell')}>{t.sell}</button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="px-4 mt-3">
        <form onSubmit={(e) => { e.preventDefault(); go(); }} className="flex items-center bg-card border-2 border-ink rounded-pill h-[60px] pl-5 pr-[5px] shadow-hard">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPh} className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-ink placeholder:text-ink/45" />
          <button type="submit" aria-label="search" className="w-12 h-12 rounded-pill bg-ink text-paper flex items-center justify-center text-[22px]">→</button>
        </form>
      </div>

      {/* CHIPS */}
      <div className="flex flex-wrap gap-2.5 px-4 mt-[18px] justify-center">
        {t.chips.map((c) => <Link key={c} href={`/propiedades?q=${encodeURIComponent(c)}`} className="text-[13.5px] font-bold px-4 py-[9px] border-[1.5px] border-ink/25 rounded-pill bg-card">{c}</Link>)}
      </div>

      {/* MASCOT + CAPTION */}
      <div className="flex items-center gap-4 px-5 mt-7 mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot.png" alt="Cuate" className="w-[128px] object-contain" />
        <div className="flex-1 border border-dashed border-ink/30 rounded-[18px] px-4 py-3.5 font-mono text-[12px] leading-[1.5] text-ink/45">{t.mascotCaption}</div>
      </div>

      {/* DARK BLOCK */}
      <div className="bg-ink text-paper rounded-t-[28px] px-5 pt-10 pb-11">
        <h2 className="text-[28px] font-bold tracking-[-0.02em]">{t.justListed} <span className="font-serif italic font-normal text-paper/60">{t.justListedSerif}</span></h2>
        <Link href="/propiedades" className="inline-block mt-[18px] mb-[22px] border-[1.5px] border-paper/40 rounded-pill px-[22px] py-[11px] text-[14px] font-bold">{t.viewAll}</Link>
        <div className="flex flex-col gap-4">
          {featured.map((l) => (
            <Link key={l.id} href={`/propiedad/${l.id}`} className="bg-paper text-ink rounded-card overflow-hidden block">
              <div className="h-[190px] cl-hatch relative">
                {l.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" className="w-full h-full object-cover" />}
                <span className="absolute top-3 left-3 text-[12px] font-semibold bg-ink text-paper px-3 py-1.5 rounded-pill">{l.mode === 'alquiler' ? t.forRent : t.forSale}</span>
              </div>
              <div className="p-4">
                <div className="text-[22px] font-bold tracking-[-0.02em]">{price(l)}</div>
                <div className="text-[15px] font-bold mt-1.5 line-clamp-1">{fTitle(l)}</div>
                <div className="text-[13px] text-ink/60 mt-0.5 line-clamp-1">{fMeta(l)}</div>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="text-[28px] font-bold tracking-[-0.02em] mt-8 mb-5">{t.stepsTitle}</h2>
        <div className="flex flex-col gap-4">
          {t.steps.map((s) => (
            <div key={s.n} className="border border-paper/25 rounded-card p-6">
              <div className="text-[44px] font-serif italic mb-2.5">{s.n}</div>
              <div className="text-[18px] font-bold mb-2">{s.t}</div>
              <div className="text-[14px] leading-[1.5] text-paper/60">{s.d}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-paper/20 mt-[18px] pt-6 flex flex-col gap-4">
          {[[`${count.toLocaleString(lang === 'en' ? 'en-US' : 'es-PY')}+`, t.statActive], ['0%', t.statComm], [t.statInstant, t.statInstantL]].map(([v, l], i) => (
            <div key={i} className="flex items-baseline"><span className="text-[30px] font-bold tracking-[-0.02em]">{v}</span><span className="font-mono text-[12px] text-paper/50 ml-3">{l}</span></div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-paper px-6 py-12 text-center flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot.png" alt="" className="w-24 object-contain" />
        <h2 className="text-[34px] leading-[1.05] tracking-[-1px] font-bold mt-3.5">{t.ctaTitle} <span className="font-serif italic font-normal">{t.ctaSerif}</span></h2>
        <p className="text-[16px] text-ink/60 mt-3 mb-6">{t.ctaSub}</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/propiedades" className="bg-ink text-paper rounded-pill px-7 py-[15px] text-[15px] font-bold shadow-hard-soft">{t.explore}</Link>
          <button onClick={openSell} className="border-2 border-ink rounded-pill px-7 py-[15px] text-[15px] font-bold">{t.cta}</button>
        </div>
      </div>
    </div>
  );
}
