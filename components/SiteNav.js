'use client';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import AuthButton from '@/components/AuthButton';

const NAV = {
  es: { buy: 'Comprar', rent: 'Alquilar', sell: 'Vender', browse: 'Ver propiedades' },
  en: { buy: 'Buy', rent: 'Rent', sell: 'Sell', browse: 'Browse listings' },
};

export default function SiteNav() {
  const [lang, setLang] = useLang();
  const t = NAV[lang];
  return (
    <nav className="flex items-center justify-between flex-wrap gap-3 px-5 md:px-11 py-4 border-b border-ink/12">
      <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif not-italic italic font-normal">.py</em></Link>
      <div className="hidden sm:flex gap-2 text-[14px] font-medium">
        <Link href="/propiedades?op=venta" className="px-[18px] py-2.5 border border-ink rounded-pill">{t.buy}</Link>
        <Link href="/propiedades?op=alquiler" className="px-[18px] py-2.5 border border-ink rounded-pill">{t.rent}</Link>
        <Link href="/publicar" className="px-[18px] py-2.5 border border-ink rounded-pill">{t.sell}</Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
          {['es', 'en'].map((l) => <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>)}
        </div>
        <AuthButton />
        <Link href="/propiedades" className="text-[14px] font-semibold px-[18px] py-2.5 bg-ink text-paper rounded-pill">{t.browse}</Link>
      </div>
    </nav>
  );
}
