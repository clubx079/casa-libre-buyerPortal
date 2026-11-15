'use client';
import Link from 'next/link';
import { fmtUsd, fmtPyg, isUnverified, contactSellerFor } from '@/lib/ui';
import { typeLabel } from '@/lib/propertyType';
import { useLang } from '@/lib/useLang';
import { tr, localeFor } from '@/lib/i18n';
import VerifiedTag from '@/components/VerifiedTag';

// Compact listing card used across the account pages (saved / my listings).
export default function ListingCard({ l, action }) {
  const [lang] = useLang();
  // Standardized: USD main, local ₲ sub (rent adds /mes|/mo).
  const per = l.mode === 'alquiler' ? tr(lang, '/mes', '/mo', '/mês') : '';
  const noPrice = isUnverified(l, 'price');   // lib/unverified.js
  const price = noPrice ? contactSellerFor('price', lang) : (fmtUsd(l.usd, lang) || '—') + per;
  const priceSub = !noPrice && fmtPyg(l.pyg, lang) ? fmtPyg(l.pyg, lang) + per : '';
  const title = `${typeLabel(l.type, lang) || tr(lang, 'Propiedad', 'Property', 'Imóvel')}${l.beds ? ` · ${l.beds} ${tr(lang, 'dorm', 'bd', 'qto')}` : ''}`;
  const place = [l.neighborhood, l.city].filter(Boolean).join(', ');
  const meta = [l.area && `${l.area} m²`, l.baths && `${l.baths} ${tr(lang, 'baños', 'ba', 'banh.')}`].filter(Boolean).join(' · ');
  // AI photo check (lib/listingScan.js): not on the site yet (or rejected) → no link to
  // the public page (it would 404), and a chip saying where it stands.
  const scan = l.scan;   // 'scanning' | 'rejected' | null
  const pay = l.payState;   // 'payment_pending' | 'expired' | null (paid listings) — not on the site either
  const review = l.review;   // 'duplicate' — held: same details + photos as another of their listings
  const Box = scan || pay || review ? 'div' : Link;
  const boxProps = scan || pay || review ? {} : { href: `/propiedad/${l.id}` };

  return (
    <div className={`bg-card rounded-[18px] overflow-hidden flex flex-col ${l.verified ? 'border border-ink ring-[1.5px] ring-ink shadow-hard-sm' : 'border border-ink/15'}`}>
      <Box {...boxProps} className="relative block h-[150px] cl-hatch">
        {l.image
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          : <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-ink/45">{tr(lang, 'Foto próximamente', 'Photo coming soon', 'Foto em breve')}</span>}
        <span className="absolute top-2 left-2 text-[10px] font-semibold bg-ink text-paper px-2.5 py-1 rounded-pill">{l.mode === 'alquiler' ? tr(lang, 'Alquiler', 'Rent', 'Aluguel') : tr(lang, 'Venta', 'Sale', 'Venda')}</span>
        {scan === 'scanning' && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 text-[10px] font-semibold bg-paper text-ink border border-ink/20 px-2.5 py-1 rounded-pill" data-testid="scan-chip">
            <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-ink/25 border-t-ink animate-spin" aria-hidden="true" />{tr(lang, 'Revisando fotos…', 'Checking photos…', 'Verificando fotos…')}
          </span>
        )}
        {scan === 'rejected' && <span className="absolute top-2 right-2 text-[10px] font-bold bg-red-600 text-white px-2.5 py-1 rounded-pill" data-testid="scan-chip">{tr(lang, 'Fotos no aceptadas', 'Photos not accepted', 'Fotos não aceitas')}</span>}
        {pay === 'payment_pending' && <span className="absolute top-2 right-2 text-[10px] font-bold bg-amber-400 text-ink px-2.5 py-1 rounded-pill" data-testid="pay-chip">{tr(lang, 'Pago pendiente', 'Payment pending', 'Pagamento pendente')}</span>}
        {pay === 'expired' && <span className="absolute top-2 right-2 text-[10px] font-bold bg-ink text-paper px-2.5 py-1 rounded-pill" data-testid="pay-chip">{tr(lang, 'Vencida', 'Ended', 'Expirado')}</span>}
        {review && <span className="absolute top-2 right-2 text-[10px] font-bold bg-amber-400 text-ink px-2.5 py-1 rounded-pill" data-testid="review-chip">{tr(lang, 'En revisión', 'Under review', 'Em análise')}</span>}
        {!scan && !pay && !review && l.admin_status && l.admin_status !== 'active' && <span className="absolute top-2 right-2 text-[10px] font-semibold bg-paper text-ink border border-ink/20 px-2.5 py-1 rounded-pill capitalize">{l.admin_status}</span>}
      </Box>
      <div className="relative p-3.5 flex-1 flex flex-col">
        {l.verified && <VerifiedTag lang={lang} className="absolute top-3 right-3 z-10 text-[9px] px-2 py-0.5" />}
        <Box {...boxProps} className="block">
          <div className="text-[17px] font-bold tracking-head whitespace-nowrap pr-16">{price}</div>
          {priceSub && <div className="text-[11px] font-medium text-ink/50 whitespace-nowrap">{priceSub}</div>}
          <div className="text-[13px] font-medium mt-0.5 line-clamp-1">{title}</div>
          <div className="text-[12px] text-ink/55 line-clamp-1">{place}</div>
          {meta && <div className="font-mono text-[11px] text-ink/45 mt-1">{meta}</div>}
        </Box>
        {/* What buyers did with it (app/api/account/listings): saves incl. visitors without an account, and views */}
        {(l.saves != null || l.views != null) && !scan && (
          <div className="flex items-center gap-3 mt-2 text-[12px] font-medium text-ink/70" data-testid="listing-stats">
            {l.saves != null && <span>♥ {l.saves.toLocaleString(localeFor(lang, 'es-PY'))} {tr(lang, l.saves === 1 ? 'persona la guardó' : 'personas la guardaron', l.saves === 1 ? 'person saved it' : 'people saved it', l.saves === 1 ? 'pessoa salvou' : 'pessoas salvaram')}</span>}
            {l.views != null && <span>👁 {l.views.toLocaleString(localeFor(lang, 'es-PY'))} {tr(lang, 'visitas', 'views', 'visualizações')}</span>}
          </div>
        )}
        {action && <div className="mt-3 pt-3 border-t border-ink/10">{action}</div>}
      </div>
    </div>
  );
}
