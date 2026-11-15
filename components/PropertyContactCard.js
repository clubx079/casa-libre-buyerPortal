'use client';
// Property detail WhatsApp contact card (V2 brand) — compact production
// layout: seller header (avatar + name) -> green WhatsApp CTA -> call/copy
// row. Bilingual (ES/EN via useLang) — but the outgoing WhatsApp message is
// ALWAYS Spanish, since it reaches a local (Paraguayan) seller regardless of
// the buyer's UI language. Fires the three PostHog contact events
// (WhatsApp/call/copy) with the listing's CL ref.
import { useState } from 'react';
import { useLang } from '@/lib/useLang';
import { track } from '@/lib/analytics';
import { genToken, shortUrl, trackContact } from '@/lib/contactTrack';
import SellerInfoButton from '@/components/SellerInfoButton';

const T = {
  es: {
    owner: 'El propietario', listedBy: 'Publicado por', website: 'Sitio web de',
    wa: 'Hablar por WhatsApp', call: 'Llamar', copy: 'Copiar número', copied: 'Número copiado',
    noContact: 'Sin contacto disponible',
    // ALWAYS Spanish, both languages. Locked format.
    msg: (name, url) => `Hola! Que tal? Está disponible la propiedad?\n\n${url}`,
  },
  en: {
    owner: 'The owner', listedBy: 'Listed by', website: 'Website of',
    wa: 'Chat on WhatsApp', call: 'Call', copy: 'Copy number', copied: 'Number copied',
    noContact: 'No contact available',
    // The outgoing message is ALWAYS Spanish regardless of UI language.
    msg: (name, url) => `Hola! Que tal? Está disponible la propiedad?\n\n${url}`,
  },
  pt: {
    owner: 'O proprietário',
    wa: 'Chat no WhatsApp', call: 'Ligar', copy: 'Copiar número', copied: 'Número copiado',
    noContact: 'Sem contato disponível',
    // The outgoing message is ALWAYS Spanish regardless of UI language.
    msg: (name, url) => `Hola! Que tal? Está disponible la propiedad?\n\n${url}`,
  },
};

const WaGlyph = ({ size = 21 }) => (
  <svg viewBox="0 0 32 32" fill="currentColor" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M16.04 3C9.02 3 3.32 8.7 3.32 15.72c0 2.24.59 4.43 1.71 6.36L3.2 28.8l6.89-1.8a12.66 12.66 0 0 0 5.95 1.51h.01c7.01 0 12.72-5.7 12.72-12.72 0-3.4-1.32-6.6-3.72-9A12.65 12.65 0 0 0 16.04 3Zm0 23.36h-.01c-1.9 0-3.76-.51-5.38-1.47l-.39-.23-4.09 1.07 1.09-3.98-.25-.41a10.55 10.55 0 0 1-1.62-5.62c0-5.83 4.75-10.57 10.58-10.57 2.83 0 5.48 1.1 7.48 3.1a10.5 10.5 0 0 1 3.1 7.48c0 5.83-4.75 10.57-10.57 10.57Zm5.8-7.92c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.72.16-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.5-2.56-1.58-.95-.85-1.58-1.9-1.77-2.21-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.25 3.44 5.46 4.83.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.61-.09 1.88-.77 2.15-1.51.26-.74.26-1.38.19-1.51-.08-.13-.29-.21-.61-.37Z" />
  </svg>
);

// sellerPhoto: the seller's APPROVED profile photo or logo (lib/profilePhoto.js);
// sellerProfile: their "Perfil profesional" { name, title, company, website, website_label }
// (lib/sellerProfile.js publicProfile). Shown together at the top of the card; with neither,
// the card looks exactly as before.
// listing: the whole listing, for the "Sobre el vendedor" (i) popover (components/SellerInfoButton.js).
export default function PropertyContactCard({ sellerName, sellerPhoto, sellerProfile, listing = null, waDigits, url, listingRef, trackProps, shortCode }) {
  const [lang] = useLang();
  const [copied, setCopied] = useState(false);
  // One tracking token per card render — embedded in the WhatsApp link so we can
  // tell when the seller opens it (see /api/contact-track).
  const [token] = useState(genToken);
  const t = T[lang] || T.es;

  const pro = sellerProfile || null;
  const displayName = pro?.name || sellerName || t.owner;
  const proLine = pro ? [pro.title, pro.company].filter(Boolean).join(' · ') : '';
  const showSeller = !!(sellerPhoto || proLine || pro?.website);
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';
  // The message reaches a local (Paraguayan) seller, so it is always in
  // Spanish regardless of the buyer's UI language. The link back to the listing
  // carries UTM + the tracking token.
  const message = T.es.msg('', shortUrl(url, token, shortCode));
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}` : null;

  // Record the contact attempt (who/seller/property) as the buyer taps WhatsApp.
  const recordContact = (channel) =>
    trackContact({ token, channel, property_id: trackProps?.property_id || null, listing_ref: listingRef || null, seller_name: sellerName || null, seller_phone: waDigits || null });

  const copyNumber = async () => {
    try { await navigator.clipboard.writeText(`+${waDigits}`); } catch { /* ignore */ }
    track('contact_copy_click', { ref: listingRef, ...(trackProps || {}), contact_token: token });
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside className="min-[921px]:sticky min-[921px]:top-5">
      <div className="bg-card border-[1.5px] border-ink rounded-[18px] shadow-[5px_4px_0_#111] max-[920px]:border-0 max-[920px]:rounded-none max-[920px]:shadow-none max-[920px]:bg-transparent">
        <div className="px-[18px] pt-[18px] pb-[18px] max-[920px]:p-0">
          {showSeller && (
            <div className="flex items-start gap-3 mb-4 max-[920px]:mb-3" data-testid="seller-photo">
              {sellerPhoto ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={sellerPhoto} alt={displayName} width={48} height={48} className="w-12 h-12 rounded-full object-cover bg-white border-[1.5px] border-ink shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-12 h-12 rounded-full bg-paper border-[1.5px] border-ink shrink-0 flex items-center justify-center text-[18px] font-bold" aria-hidden="true">{initial}</div>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="text-[11px] font-semibold uppercase tracking-label text-ink/45">{t.listedBy}</div>
                <div className="text-[15px] font-bold leading-tight truncate">{displayName}</div>
                {proLine && <div className="text-[12.5px] text-ink/65 leading-snug mt-0.5 line-clamp-2 break-words" data-testid="seller-title">{proLine}</div>}
                {pro?.website && (
                  <a
                    href={pro.website}
                    target="_blank"
                    rel="nofollow noopener"
                    aria-label={`${t.website} ${pro.company || displayName}`}
                    onClick={() => track('seller_website_click', { ref: listingRef, ...(trackProps || {}) })}
                    className="mt-1 inline-flex items-center gap-1 max-w-full text-[12.5px] font-semibold underline underline-offset-2 decoration-ink/30 hover:decoration-ink"
                    data-testid="seller-website"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>
                    <span className="truncate">{pro.website_label || pro.website}</span>
                  </a>
                )}
              </div>
            </div>
          )}
          {waUrl ? (
            <>
              {/* WhatsApp lives in the card on desktop; on mobile the sticky bottom
                  bar carries it, so hide this one to avoid two WhatsApp buttons. */}
              <div className="flex items-center gap-2.5 max-[920px]:hidden">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { track('contact_whatsapp_click', { ref: listingRef, ...(trackProps || {}), contact_token: token }); recordContact('whatsapp'); }}
                  className="flex-1 min-w-0 flex items-center justify-center gap-2.5 px-[18px] py-[13px] rounded-pill text-[15px] font-semibold text-white transition-transform active:translate-x-[2px] active:translate-y-[2px]"
                  style={{ background: '#25D366', border: '1.5px solid #111', boxShadow: '4px 4px 0 #111' }}
                >
                  <WaGlyph /> {t.wa}
                </a>
                {listing && <SellerInfoButton l={listing} sellerName={sellerName} photo={sellerPhoto} size="lg" />}
              </div>

              <div className="flex gap-2.5 mt-3.5 max-[920px]:mt-0">
                <a href={`tel:+${waDigits}`} onClick={() => track('contact_call_click', { ref: listingRef, ...(trackProps || {}), contact_token: token })} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 max-[920px]:py-2 rounded-pill border border-ink bg-card text-[13.5px] max-[920px]:text-[12.5px] font-medium hover:bg-paper transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z" /></svg>
                  {t.call}
                </a>
                <button type="button" onClick={copyNumber} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 max-[920px]:py-2 rounded-pill border border-ink bg-card text-[13.5px] max-[920px]:text-[12.5px] font-medium hover:bg-paper transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                  {copied ? t.copied : t.copy}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <button disabled aria-disabled="true" className="flex-1 min-w-0 px-4 py-3 rounded-pill bg-paper text-ink/40 font-semibold border border-ink/20 cursor-not-allowed">
                {t.noContact}
              </button>
              {listing && <SellerInfoButton l={listing} sellerName={sellerName} photo={sellerPhoto} size="lg" className="max-[920px]:hidden" />}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
