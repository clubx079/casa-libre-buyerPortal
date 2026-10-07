'use client';
// /publicar — the address every "List for free" / "Sell" link points at (emails,
// crawlers, open-in-new-tab). A plain click on one of those links already opens the
// sell wizard over the current page (SellFlow); landing here directly opens the same
// wizard, signed in or not. This page is only what shows behind it, with a button to
// bring it back if it's closed. (It used to hold a separate publish form for
// signed-in users; everyone now uses the one wizard.)
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import AuthButton from '@/components/AuthButton';
import { useSellFlow } from '@/components/SellFlow';
import { COUNTRY } from '@/lib/country';

const DICT = {
  es: {
    navBuy: 'Comprar', navRent: 'Alquilar', navSell: 'Vender', navCta: 'Publicar gratis',
    title: 'Publicá tu propiedad', titleSerif: 'en minutos.',
    sub: 'Contanos sobre tu propiedad. Se publica al instante en el marketplace.',
    btn: 'Publicar propiedad',
  },
  en: {
    navBuy: 'Buy', navRent: 'Rent', navSell: 'Sell', navCta: 'List for free',
    title: 'List your property', titleSerif: 'in minutes.',
    sub: 'Tell us about your property. It goes live in the marketplace instantly.',
    btn: 'List a property',
  },
};

export default function PublicarClient() {
  const [lang, setLang] = useLang();
  const { loading } = useAuth();
  const { openSell } = useSellFlow();
  const autoOpened = useRef(false);
  const t = DICT[lang];

  // Open the wizard once per visit. Guarded so it never re-fires if they close it,
  // and skipped on ?sell=… / ?publicar=1 (back from Google etc.), which SellFlow
  // reopens by itself at the right step.
  useEffect(() => {
    if (loading || autoOpened.current) return;
    autoOpened.current = true;
    const q = new URLSearchParams(window.location.search);
    if (q.get('sell') || q.get('publicar')) return;
    openSell();
  }, [loading, openSell]);

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-center md:justify-between flex-wrap gap-3 px-5 md:px-9 py-4 border-b border-ink/12">
        <div className="flex flex-col gap-0.5 leading-none">
          <Link href="/" className="font-bold text-[22px] tracking-head">casa-libre<em className="font-serif italic font-normal">{COUNTRY.tld}</em></Link>
        </div>
        <div className="flex gap-2 flex-wrap text-[14px] font-medium">
          <Link href="/propiedades?op=venta" className="inline-flex items-center h-[40px] px-[18px] border border-ink rounded-pill">{t.navBuy}</Link>
          <Link href="/propiedades?op=alquiler" className="inline-flex items-center h-[40px] px-[18px] border border-ink rounded-pill">{t.navRent}</Link>
          {/* We're on the sell page — show the Sell tab as selected, matching how
              Buy/Rent look filled when active on the marketplace. */}
          <Link href="/publicar" aria-current="page" className="inline-flex items-center h-[40px] px-[18px] border border-ink rounded-pill bg-ink text-paper">{t.navSell}</Link>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center h-[40px] border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`h-full flex items-center px-3 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>
            ))}
          </div>
          <AuthButton />
          <Link href="/publicar" className="inline-flex items-center h-[40px] px-[22px] bg-ink text-paper rounded-pill text-[14px] font-semibold whitespace-nowrap">{t.navCta}</Link>
        </div>
      </nav>

      <div className="max-w-[520px] mx-auto px-5 py-24 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot.png" alt="" className="w-[130px] object-contain mx-auto mb-4" />
        <h1 className="text-[clamp(30px,4.5vw,42px)] font-bold tracking-display leading-tight mb-2">{t.title} <span className="font-serif italic font-normal">{t.titleSerif}</span></h1>
        <p className="text-[16px] text-ink/55 mb-7">{t.sub}</p>
        <button onClick={() => openSell()} className="px-8 py-4 bg-ink text-paper font-semibold text-[15px] rounded-pill shadow-hard-soft">{t.btn}</button>
      </div>
    </div>
  );
}
