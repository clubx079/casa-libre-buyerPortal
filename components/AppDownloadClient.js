'use client';
// "App coming soon" landing — where the App Store / Google Play badges point to
// (from the home page and every marketplace page). Branded ink/paper, ES default
// + EN toggle. Informational: the app isn't published yet, so it explains what's
// coming and points people to the web version meanwhile.
import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { COUNTRY } from '@/lib/country';

const T = {
  es: {
    tabs: [['Comprar', '/propiedades?op=venta'], ['Alquilar', '/propiedades?op=alquiler'], ['Vender', '/publicar']],
    cta: 'Publicar gratis',
    kicker: 'App móvil',
    h1: <>La app está <em>en camino.</em></>,
    lede: `Estamos terminando la app de Casa Libre para iOS y Android. Muy pronto vas a poder buscar, guardar favoritos y hablar directo por WhatsApp desde tu teléfono. Mientras tanto, todo funciona igual desde la web.`,
    browse: 'Explorar propiedades en la web',
    home: 'Volver al inicio',
    featTitle: 'Lo que vas a tener en la app',
    feats: [
      ['Todo el mercado en tu bolsillo', `Las propiedades de todo ${COUNTRY.name}, en un solo lugar.`],
      ['Favoritos y alertas', 'Guardá propiedades y recibí avisos cuando aparezca algo nuevo.'],
      ['Mapa y cerca de mí', 'Buscá por zona y encontrá lo que está cerca tuyo.'],
      ['WhatsApp directo', 'Contactá a quien publica sin intermediarios.'],
    ],
  },
  en: {
    tabs: [['Buy', '/propiedades?op=venta'], ['Rent', '/propiedades?op=alquiler'], ['Sell', '/publicar']],
    cta: 'List for free',
    kicker: 'Mobile app',
    h1: <>The app is <em>on its way.</em></>,
    lede: `We're finishing the Casa Libre app for iOS and Android. Very soon you'll be able to search, save favorites and chat directly on WhatsApp from your phone. In the meantime, everything works the same on the web.`,
    browse: 'Browse properties on the web',
    home: 'Back to home',
    featTitle: "What you'll get in the app",
    feats: [
      ['The whole market in your pocket', `Every property across ${COUNTRY.name}, in one place.`],
      ['Favorites and alerts', 'Save properties and get notified when something new appears.'],
      ['Map and near me', 'Search by area and find what’s close to you.'],
      ['Direct WhatsApp', 'Contact whoever posted, no middlemen.'],
    ],
  },
};

export default function AppDownloadClient({ tickerData = [] }) {
  const [lang, setLang] = useLang();
  const t = T[lang] || T.es;
  const ticker = tickerData.length ? tickerData : [`CASA LIBRE — PROPIEDADES EN ${(COUNTRY.name || 'Sudamérica').toUpperCase()}`];
  return (
    <div className="bg-paper text-ink min-h-screen">
      {/* RUNNING STRIP — same marquee as the home page */}
      <div className="bg-ink text-paper overflow-hidden whitespace-nowrap font-mono text-[12px] py-2">
        <div className="cl-marquee">
          {[0, 1].map((rep) => <span key={rep} className="pr-10">{ticker.map((x, i) => <span key={i} className="px-6 border-r border-paper/30">{x}</span>)}</span>)}
        </div>
      </div>

      {/* NAV — wordmark + controls on one line */}
      <nav className="flex items-center justify-between flex-nowrap md:flex-wrap gap-2 md:gap-3 px-5 md:px-9 py-4 border-b border-ink/12">
        <Link href="/" className="text-[22px] font-bold tracking-head shrink-0">casa-libre<em className="font-serif italic font-normal">{COUNTRY.tld}</em></Link>
        <div className="hidden md:flex gap-2">
          {t.tabs.map(([label, href]) => (
            <Link key={label} href={href} className="inline-flex items-center h-[40px] px-[18px] rounded-pill text-[14px] font-medium border border-ink">{label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-2 md:gap-3.5 shrink-0">
          <div className="flex items-center h-9 md:h-[40px] border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((x) => (
              <button key={x} onClick={() => setLang(x)} className={`h-full flex items-center px-2.5 md:px-3 rounded-pill ${lang === x ? 'bg-ink text-paper' : 'text-ink/55'}`}>{x.toUpperCase()}</button>
            ))}
          </div>
          <Link href="/publicar" className="inline-flex items-center h-9 md:h-[40px] px-3.5 md:px-[22px] rounded-pill text-[13px] md:text-[14px] font-medium bg-ink text-paper whitespace-nowrap">{t.cta}</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-[820px] mx-auto px-5 md:px-9 pt-14 md:pt-20 pb-10 text-center">
        <p className="font-mono text-[12px] tracking-[.12em] uppercase text-ink/55 mb-3.5">{t.kicker}</p>
        <h1 className="text-[clamp(38px,6vw,68px)] leading-[1.02] tracking-head font-bold mb-4 [&_em]:font-serif [&_em]:italic [&_em]:font-normal">{t.h1}</h1>
        <p className="text-[clamp(16px,1.8vw,19px)] leading-[1.6] text-ink/70 max-w-[58ch] mx-auto mb-8">{t.lede}</p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/propiedades" className="inline-flex items-center justify-center px-6 py-3.5 rounded-pill font-semibold text-[15px] bg-ink text-paper border-[1.5px] border-ink shadow-[4px_4px_0_rgba(17,17,17,.85)] active:translate-x-[2px] active:translate-y-[2px]">{t.browse}</Link>
          <Link href="/" className="inline-flex items-center justify-center px-6 py-3.5 rounded-pill font-semibold text-[15px] bg-white text-ink border-[1.5px] border-ink shadow-[4px_4px_0_rgba(17,17,17,.18)] active:translate-x-[2px] active:translate-y-[2px]">{t.home}</Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-[980px] mx-auto px-5 md:px-9 pb-16 md:pb-24">
        <h2 className="text-[clamp(22px,3vw,30px)] tracking-head font-bold mb-5 text-center">{t.featTitle}</h2>
        <div className="grid gap-4 [grid-template-columns:1fr] sm:grid-cols-2">
          {t.feats.map(([h, p]) => (
            <div key={h} className="bg-white border-[1.5px] border-ink rounded-[18px] shadow-[4px_4px_0_rgba(17,17,17,.85)] p-[22px]">
              <h3 className="text-[18px] tracking-head font-bold mb-1.5">{h}</h3>
              <p className="text-[14.5px] leading-[1.55] text-ink/70">{p}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
