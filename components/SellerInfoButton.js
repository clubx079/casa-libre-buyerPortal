'use client';
// "Sobre el vendedor" — the small (i) button next to the WhatsApp contact (PropertyContactCard
// and the mobile sticky bar). Opens a popover on desktop and a bottom sheet on mobile (≤920px)
// with everything we know about the seller: photo / logo (or an initial), name, title ·
// company, website (rel="nofollow noopener"), "WhatsApp confirmado ✓", member since, active
// listings on Casa-Libre and the Verified badge. Empty fields are hidden; the phone number is
// never shown (the WhatsApp button stays the way to reach the seller).
// Scraped / agency listings carry no seller account: a neutral name and the date the listing
// joined Casa-Libre — never the source or agency (lib/listings.js user_published).
// Closes with ×, Esc or a click outside. Opens are tracked: seller_info_opened { listing_id }.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/useLang';
import { localeFor } from '@/lib/i18n';
import { track } from '@/lib/analytics';
import { COUNTRY } from '@/lib/country';
import VerifiedTag from '@/components/VerifiedTag';

const T = {
  es: {
    aria: 'Sobre el vendedor', title: 'Sobre el vendedor', close: 'Cerrar',
    owner: 'El propietario', advertiser: 'Anunciante',
    waOk: 'WhatsApp confirmado ✓', since: (d) => `Miembro desde ${d}`, listedSince: (d) => `En Casa-Libre desde ${d}`,
    active: (n) => (n === 1 ? '1 propiedad activa en Casa-Libre' : `${n} propiedades activas en Casa-Libre`),
    website: 'Sitio web', contact: 'Para contactar al vendedor, usá el botón de WhatsApp.',
  },
  en: {
    aria: 'About the seller', title: 'About the seller', close: 'Close',
    owner: 'The owner', advertiser: 'Advertiser',
    waOk: 'WhatsApp confirmed ✓', since: (d) => `Member since ${d}`, listedSince: (d) => `On Casa-Libre since ${d}`,
    active: (n) => (n === 1 ? '1 active listing on Casa-Libre' : `${n} active listings on Casa-Libre`),
    website: 'Website', contact: 'To reach the seller, use the WhatsApp button.',
  },
  pt: {
    aria: 'Sobre o vendedor', title: 'Sobre o vendedor', close: 'Fechar',
    owner: 'O proprietário', advertiser: 'Anunciante',
    waOk: 'WhatsApp confirmado ✓', since: (d) => `Membro desde ${d}`, listedSince: (d) => `No Casa-Libre desde ${d}`,
    active: (n) => (n === 1 ? '1 anúncio ativo no Casa-Libre' : `${n} anúncios ativos no Casa-Libre`),
    website: 'Site', contact: 'Para falar com o vendedor, use o botão do WhatsApp.',
  },
};

const MOBILE = '(max-width: 920px)';

const monthYear = (v, lang) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  try { return d.toLocaleDateString(localeFor(lang, COUNTRY.locale || 'es'), { month: 'long', year: 'numeric' }); } catch { return null; }
};

// l = the listing (PropertyDetailView); sellerName = the name the contact card shows (null for
// scraped listings); photo = the approved profile photo / logo (user listings only).
// size: 'md' (36px) or 'lg' (48px, next to the big WhatsApp button).
export default function SellerInfoButton({ l, sellerName = null, photo = null, size = 'md', className = '' }) {
  const [lang] = useLang();
  const t = T[lang] || T.es;
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const id = useId();
  const titleId = `${id}-title`;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    // desktop: any press outside closes (mobile: the sheet's backdrop does, on click, so the
    // tap can't fall through to the page underneath)
    const onDown = (e) => {
      if (mobile || panelRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    const f = setTimeout(() => closeRef.current?.focus(), 0);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); clearTimeout(f); };
  }, [open, close, mobile]);

  // the bottom sheet locks the page scroll while open
  useEffect(() => {
    if (!open || !mobile) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, mobile]);

  const toggle = () => {
    if (!open) track('seller_info_opened', { listing_id: l?.id ?? null });
    setOpen(!open);
  };

  // ── what we know ──
  const user = !!l?.user_published;
  const info = (user && l?.seller_info) || {};
  const pro = (user && l?.seller_profile) || {};
  const name = info.name || pro.name || (user ? sellerName : null) || (user ? t.owner : t.advertiser);
  const line = [info.title || pro.title, info.company || pro.company].filter(Boolean).join(' · ');
  const website = info.website || pro.website || null;
  const websiteLabel = info.website_label || pro.website_label || website;
  const sinceDate = monthYear(user ? info.member_since || l?.created_at : l?.first_scraped_at || l?.created_at, lang);
  const sinceText = sinceDate ? (user ? t.since(sinceDate) : t.listedSince(sinceDate)) : null;
  const active = user && info.active_listings > 0 ? t.active(info.active_listings) : null;
  const pic = user ? photo || l?.seller_photo || null : null;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  const body = (
    <>
      <div className="flex items-start gap-3 pr-8">
        {pic
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={pic} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover bg-white border-[1.5px] border-ink shrink-0" />
          : <div className="w-14 h-14 rounded-full bg-paper border-[1.5px] border-ink shrink-0 flex items-center justify-center text-[22px] font-bold" aria-hidden="true">{initial}</div>}
        <div className="min-w-0 flex-1 pt-0.5">
          <div id={titleId} className="text-[11px] font-semibold uppercase tracking-label text-ink/45">{t.title}</div>
          <div className="text-[16px] font-bold leading-tight break-words">{name}</div>
          {line && <div className="text-[13px] text-ink/65 leading-snug mt-0.5 break-words">{line}</div>}
          {l?.verified && <VerifiedTag lang={lang} className="mt-1.5 text-[10px] px-2 py-[3px]" />}
        </div>
      </div>
      <ul className="mt-3.5 flex flex-col gap-2 text-[13.5px]">
        {website && (
          <li className="flex items-center gap-2 min-w-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-ink/55"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>
            <a href={website} target="_blank" rel="nofollow noopener" className="font-semibold underline underline-offset-2 decoration-ink/30 hover:decoration-ink truncate" aria-label={`${t.website}: ${websiteLabel}`}>{websiteLabel}</a>
          </li>
        )}
        {user && info.wa_verified && (
          <li className="flex items-center gap-2">
            <span className="w-[15px] h-[15px] shrink-0 rounded-full flex items-center justify-center" style={{ background: '#25D366' }} aria-hidden="true">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <span className="font-medium">{t.waOk}</span>
          </li>
        )}
        {sinceText && (
          <li className="flex items-center gap-2 text-ink/75">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-ink/55"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
            <span>{sinceText}</span>
          </li>
        )}
        {active && (
          <li className="flex items-center gap-2 text-ink/75">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-ink/55"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
            <span>{active}</span>
          </li>
        )}
      </ul>
      <p className="mt-3.5 pt-3 border-t border-ink/10 text-[12px] text-ink/50">{t.contact}</p>
      <button
        ref={closeRef}
        type="button"
        onClick={() => close()}
        aria-label={t.close}
        className="absolute top-3 right-3 w-8 h-8 rounded-full border border-ink/20 text-[18px] leading-none font-bold flex items-center justify-center hover:bg-paper"
      >×</button>
    </>
  );

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={t.aria}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        className={`${size === 'lg' ? 'w-12 h-12' : 'w-9 h-9'} shrink-0 rounded-full border-[1.5px] border-ink bg-card flex items-center justify-center hover:bg-paper transition-colors`}
        data-testid="seller-info-btn"
      >
        <svg width={size === 'lg' ? 19 : 16} height={size === 'lg' ? 19 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r="0.6" fill="currentColor" /></svg>
      </button>
      {open && !mobile && (
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="absolute right-0 top-full mt-2 z-[500] w-[320px] max-w-[calc(100vw-32px)] bg-card border-[1.5px] border-ink rounded-[16px] shadow-[5px_4px_0_#111] p-4 text-left"
          data-testid="seller-info"
        >
          {body}
        </div>
      )}
      {open && mobile && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[1500] flex items-end" data-testid="seller-info-sheet">
          <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={() => close(false)} />
          <div
            ref={panelRef}
            id={`${id}-panel`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full bg-card border-t-[1.5px] border-ink rounded-t-[22px] px-5 pt-5 text-left"
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
            data-testid="seller-info"
          >
            <div className="mx-auto -mt-2 mb-3 w-10 h-1 rounded-full bg-ink/15" aria-hidden="true" />
            {body}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
