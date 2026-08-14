'use client';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useRouter } from 'next/navigation';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd, fmtPyg } from '@/lib/ui';

const DICT = {
  es: {
    navBuy: 'Comprar', navRent: 'Alquilar', navSell: 'Vender', navCta: 'Empezar →',
    heroLine1: 'Encontrá tu lugar,', heroLine2: 'libremente.',
    heroSub: 'La forma más amigable de comprar, alquilar y vender casas en Asunción.',
    searchPlaceholder: '¿Dónde querés vivir? — “Carmelitas”, “Recoleta”…', searchBtn: 'Buscar',
    mascotCaption: '“¡Vamos que se puede!” — Casi, tu guía',
    listingsTitle: 'Recién publicadas', listingsTitleSerif: 'lo más nuevo del mercado', listingsAll: 'Ver todas →',
    forSale: 'En venta', forRent: 'En alquiler', perMonth: '/mes', beds: 'dorm', baths: 'baños',
    stepsTitle: 'Tres pasos y listo',
    steps: [
      { n: '1', t: 'Contanos qué buscás', d: 'Barrio, presupuesto, cantidad de dormitorios. Casi te muestra solo lo que vale la pena.' },
      { n: '2', t: 'Visitá sin vueltas', d: 'Agendá online, visitá acompañado. Sin llamadas raras ni fotos viejas.' },
      { n: '3', t: 'Firmá y celebrá', d: 'Contrato digital con respaldo legal. Las llaves son tuyas.' },
    ],
    stats: (c) => [
      { v: `${c.toLocaleString('es-PY')}+`, l: 'propiedades activas' }, { v: '0%', l: 'comisión al publicar' },
      { v: '48 hs', l: 'verificación promedio' }, { v: '4.9★', l: 'rating de usuarios' },
    ],
    ctaTitle: 'Tu casa te está buscando', ctaTitleSerif: 'a vos.',
    ctaSub: 'Gratis para buscar, gratis para publicar. Empezá hoy.',
    ctaBtn1: 'Explorar propiedades', ctaBtn2: 'Publicar gratis',
    footerLine: `© ${new Date().getFullYear()} Casa Libre · casa-libre.py · Asunción PY · Términos · Privacidad`,
    chips: ['Asunción', 'Villa Morra', 'Central', 'Luque', 'San Lorenzo'],
  },
  en: {
    navBuy: 'Buy', navRent: 'Rent', navSell: 'Sell', navCta: 'Get started →',
    heroLine1: 'Find your place,', heroLine2: 'freely.',
    heroSub: 'The friendliest way to buy, rent and sell homes in Paraguay.',
    searchPlaceholder: 'Where do you want to live? — “Carmelitas”, “Recoleta”…', searchBtn: 'Search',
    mascotCaption: '“Let’s go!” — Casi, your guide',
    listingsTitle: 'Just listed', listingsTitleSerif: 'fresh on the market', listingsAll: 'View all →',
    forSale: 'For sale', forRent: 'For rent', perMonth: '/mo', beds: 'bd', baths: 'ba',
    stepsTitle: 'Three steps and you’re in',
    steps: [
      { n: '1', t: 'Tell us what you’re after', d: 'Neighborhood, budget, bedrooms. Casi only shows you what’s worth your time.' },
      { n: '2', t: 'Visit, no hassle', d: 'Book online, tour with a guide. No weird calls, no outdated photos.' },
      { n: '3', t: 'Sign and celebrate', d: 'Digital contract with legal backing. The keys are yours.' },
    ],
    stats: (c) => [
      { v: `${c.toLocaleString('en-US')}+`, l: 'active listings' }, { v: '0%', l: 'listing commission' },
      { v: '48 hrs', l: 'avg. verification' }, { v: '4.9★', l: 'user rating' },
    ],
    ctaTitle: 'Your home is out there looking', ctaTitleSerif: 'for you.',
    ctaSub: 'Free to browse, free to list. Start today.',
    ctaBtn1: 'Explore homes', ctaBtn2: 'List for free',
    footerLine: `© ${new Date().getFullYear()} Casa Libre · casa-libre.py · Asunción PY · Terms · Privacy`,
    chips: ['Asunción', 'Villa Morra', 'Central', 'Luque', 'San Lorenzo'],
  },
};

export default function LandingClient({ featured = [], count = 0, tickerData = [] }) {
  const [lang, setLang] = useLang();
  const router = useRouter();
  const t = DICT[lang];

  const price = (l) => (fmtUsd(l.usd, lang) || '—') + (l.mode === 'alquiler' ? t.perMonth : '');
  const title = (l) => `${typeLabel(l.type, lang) || (lang === 'es' ? 'Propiedad' : 'Property')}${l.beds ? ` · ${l.beds} ${t.beds}` : ''}`;
  const place = (l) => [l.neighborhood, l.city].filter(Boolean).join(', ');
  const meta = (l) => [l.area && `${l.area} m²`, l.baths && `${l.baths} ${t.baths}`].filter(Boolean).join(' · ');
  const ticker = tickerData.length ? tickerData : ['CASA LIBRE — PROPIEDADES EN PARAGUAY'];

  return (
    <div className="max-w-[1440px] mx-auto">
      {/* TICKER */}
      <div className="bg-ink text-paper overflow-hidden whitespace-nowrap font-mono text-[12px] py-2">
        <div className="cl-marquee">
          {[0, 1].map((rep) => (
            <span key={rep} className="pr-10">
              {ticker.map((x, i) => <span key={i} className="px-6 border-r border-paper/30">{x}</span>)}
            </span>
          ))}
        </div>
      </div>

      {/* NAV */}
      <nav className="flex items-center justify-between flex-wrap gap-3 px-5 md:px-11 py-5">
        <span className="font-bold text-[22px] tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></span>
        <div className="hidden sm:flex gap-2 text-[14px] font-medium">
          <Link href="/propiedades" className="px-[18px] py-2.5 border border-ink rounded-pill">{t.navBuy}</Link>
          <Link href="/propiedades?op=alquiler" className="px-[18px] py-2.5 border border-ink rounded-pill">{t.navRent}</Link>
          <Link href="/publicar" className="px-[18px] py-2.5 border border-ink rounded-pill">{t.navSell}</Link>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((l) => <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>)}
          </div>
          <Link href="/propiedades" className="text-[14px] font-semibold px-[22px] py-2.5 bg-ink text-paper rounded-pill">{t.navCta}</Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="grid md:grid-cols-2 gap-6 items-center px-5 md:px-11 pt-10 pb-16">
        <div>
          <h1 className="text-[clamp(46px,7.5vw,92px)] leading-[0.92] tracking-display font-bold m-0 mb-5">
            {t.heroLine1}<br /><span className="font-serif italic font-normal">{t.heroLine2}</span>
          </h1>
          <p className="text-[19px] leading-relaxed text-ink/60 max-w-[460px] mb-9">{t.heroSub}</p>
          <form onSubmit={(e) => { e.preventDefault(); router.push('/propiedades'); }} className="flex items-center bg-card border-2 border-ink rounded-pill pl-6 pr-1.5 py-1.5 max-w-[560px] shadow-hard">
            <input placeholder={t.searchPlaceholder} className="flex-1 bg-transparent outline-none text-[15px] py-2 placeholder:text-ink/40" />
            <button type="submit" className="px-7 py-3.5 bg-ink text-paper rounded-pill text-[15px] font-semibold whitespace-nowrap">{t.searchBtn}</button>
          </form>
          <div className="flex gap-2.5 mt-[18px] flex-wrap">
            {t.chips.map((c) => (
              <Link key={c} href="/propiedades" className="text-[13px] font-medium px-3.5 py-1.5 border border-ink/25 rounded-pill bg-card">{c}</Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.png" alt="Casa Libre" className="w-[clamp(220px,28vw,420px)] max-w-[70vw] object-contain" />
          <div className="font-mono text-[12px] text-ink/45 border border-dashed border-ink/30 rounded-pill px-4 py-1.5">{t.mascotCaption}</div>
        </div>
      </div>

      {/* LISTINGS (dark) */}
      <div className="px-5 md:px-11 py-14 bg-ink text-paper rounded-t-section">
        <div className="flex justify-between items-baseline flex-wrap gap-3.5 mb-8">
          <h2 className="text-[clamp(26px,4vw,34px)] tracking-head font-bold m-0">{t.listingsTitle} <span className="font-serif italic font-normal text-paper/60">{t.listingsTitleSerif}</span></h2>
          <Link href="/propiedades" className="text-paper text-[14px] font-semibold px-5 py-2.5 border border-paper/40 rounded-pill">{t.listingsAll}</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((l) => (
            <Link key={l.id} href={`/propiedad/${l.slug}`} className="bg-paper text-ink rounded-card overflow-hidden hover:-translate-y-1 transition-transform block">
              <div className="h-[180px] cl-hatch relative">
                {l.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" className="w-full h-full object-cover" />}
                <span className="absolute top-3 left-3 text-[11px] font-semibold bg-ink text-paper px-2.5 py-1 rounded-pill">{l.mode === 'alquiler' ? t.forRent : t.forSale}</span>
              </div>
              <div className="p-[18px] pt-4 pb-5">
                <div className="text-[21px] font-bold tracking-head mb-1">{price(l)}</div>
                <div className="text-[15px] font-medium mb-0.5 line-clamp-1">{title(l)}</div>
                <div className="text-[13px] text-ink/55 line-clamp-1">{place(l)}{meta(l) ? ` · ${meta(l)}` : ''}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS (dark) */}
      <div className="px-5 md:px-11 py-16 bg-ink text-paper">
        <h2 className="text-[clamp(26px,4vw,34px)] tracking-head font-bold m-0 mb-9">{t.stepsTitle}</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.steps.map((s) => (
            <div key={s.n} className="border border-paper/25 rounded-card p-[26px] pb-[30px]">
              <div className="text-[44px] font-serif italic mb-3">{s.n}</div>
              <div className="text-[18px] font-semibold mb-2">{s.t}</div>
              <div className="text-[14px] leading-relaxed text-paper/60">{s.d}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-x-10 gap-y-6 flex-wrap mt-11 pt-8 border-t border-paper/20">
          {t.stats(count).map((st, i) => (
            <div key={i}><span className="text-[30px] font-bold tracking-head">{st.v}</span><span className="font-mono text-[12px] text-paper/50 ml-2.5">{st.l}</span></div>
          ))}
        </div>
      </div>

      {/* CTA FOOTER */}
      <div className="px-5 md:px-11 py-[70px] bg-paper text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot.png" alt="" className="w-24 object-contain mx-auto mb-3.5" />
        <h2 className="text-[clamp(32px,5.5vw,52px)] tracking-display font-bold m-0 mb-3">{t.ctaTitle} <span className="font-serif italic font-normal">{t.ctaTitleSerif}</span></h2>
        <p className="text-[17px] text-ink/55 m-0 mb-[30px]">{t.ctaSub}</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/propiedades" className="px-8 py-4 bg-ink text-paper font-semibold text-[16px] rounded-pill shadow-hard-soft">{t.ctaBtn1}</Link>
          <Link href="/publicar" className="px-8 py-4 border-2 border-ink font-semibold text-[16px] rounded-pill">{t.ctaBtn2}</Link>
        </div>
        <div className="mt-12 font-mono text-[11px] text-ink/40">{t.footerLine}</div>
      </div>
    </div>
  );
}
