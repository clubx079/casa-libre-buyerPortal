'use client';
import Link from 'next/link';
import { fmtUsd, fmtPyg } from '@/lib/ui';
import { typeLabel } from '@/lib/propertyType';
import { useLang } from '@/lib/useLang';

// Compact listing card used across the account pages (saved / my listings).
export default function ListingCard({ l, action }) {
  const [lang] = useLang();
  const price = l.mode === 'alquiler' ? (fmtPyg(l.pyg, lang) || fmtUsd(l.usd, lang) || '—') : (fmtUsd(l.usd, lang) || '—');
  const title = `${typeLabel(l.type, lang) || (lang === 'es' ? 'Propiedad' : 'Property')}${l.beds ? ` · ${l.beds} ${lang === 'es' ? 'dorm' : 'bd'}` : ''}`;
  const place = [l.neighborhood, l.city].filter(Boolean).join(', ');
  const meta = [l.area && `${l.area} m²`, l.baths && `${l.baths} ${lang === 'es' ? 'baños' : 'ba'}`].filter(Boolean).join(' · ');

  return (
    <div className="bg-card border border-ink/15 rounded-[18px] overflow-hidden flex flex-col">
      <Link href={`/propiedad/${l.id}`} className="relative block h-[150px] cl-hatch">
        {l.image
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          : <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-ink/45">{lang === 'es' ? 'Foto próximamente' : 'Photo coming soon'}</span>}
        <span className="absolute top-2 left-2 text-[10px] font-semibold bg-ink text-paper px-2.5 py-1 rounded-pill">{l.mode === 'alquiler' ? (lang === 'es' ? 'Alquiler' : 'Rent') : (lang === 'es' ? 'Venta' : 'Sale')}</span>
        {l.admin_status && l.admin_status !== 'active' && <span className="absolute top-2 right-2 text-[10px] font-semibold bg-paper text-ink border border-ink/20 px-2.5 py-1 rounded-pill capitalize">{l.admin_status}</span>}
      </Link>
      <div className="p-3.5 flex-1 flex flex-col">
        <Link href={`/propiedad/${l.id}`} className="block">
          <div className="text-[17px] font-bold tracking-head whitespace-nowrap">{price}</div>
          <div className="text-[13px] font-medium mt-0.5 line-clamp-1">{title}</div>
          <div className="text-[12px] text-ink/55 line-clamp-1">{place}</div>
          {meta && <div className="font-mono text-[11px] text-ink/45 mt-1">{meta}</div>}
        </Link>
        {action && <div className="mt-3 pt-3 border-t border-ink/10">{action}</div>}
      </div>
    </div>
  );
}
