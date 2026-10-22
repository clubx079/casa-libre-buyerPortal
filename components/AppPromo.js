'use client';
// "Get the app" pop-up on Android phones (rules: lib/appPromo.js). Mounted once in
// app/layout.js. Two sizes:
//   · banner — a small card at the top: "Funciona mejor en la app" + Google Play + ×
//              (the page they land on, and the home page);
//   · full   — a full-screen panel from their second page on, once per visit.
// Tracked: 'app_promo_shown' / 'app_promo_closed' { variant, page }, and taps on the
// Play button as 'app_badge_clicked' { store: 'google_play', placement: 'promo_banner' |
// 'promo_full' } — the same event as every other app button (admin funnel "Clicked an
// app button"). The Play link carries an install referrer (utm_medium=popup).
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { PLAY_STORE_URL } from '@/lib/appLinks';
import { track } from '@/lib/analytics';
import { promoFor, fromOurMessage, SNOOZE_DAYS } from '@/lib/appPromo';
import { Badge } from '@/components/AppBadges';

const VISIT = 'cl_app_promo_visit';   // sessionStorage: { views, banner, full }
const SNOOZE = 'cl_app_promo_until';  // localStorage: ms timestamp

const TXT = {
  es: {
    line: 'Funciona mejor en la app', sub: 'Descargala gratis',
    title: 'La app de Casa Libre ya está disponible',
    lead: 'Todo Casa Libre en tu celular, más rápido.',
    points: ['Buscá en el mapa, cerca tuyo', 'Guardá propiedades y contactá al dueño en un toque', 'Avisos de propiedades nuevas'],
    stay: 'Seguir en la web', close: 'Cerrar',
  },
  en: {
    line: 'It works better on the app', sub: 'Get it free',
    title: 'The Casa Libre app is here',
    lead: 'All of Casa Libre on your phone, faster.',
    points: ['Search on the map, near you', 'Save homes and contact the owner in one tap', 'Alerts for new properties'],
    stay: 'Continue on the website', close: 'Close',
  },
};

const read = (store, key, fallback) => { try { const v = store.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (store, key, v) => { try { store.setItem(key, JSON.stringify(v)); } catch { /* private mode: fine */ } };
const playHref = (variant) => `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`utm_source=casalibre_web&utm_medium=popup&utm_campaign=app_promo_${variant}`)}`;

export default function AppPromo() {
  const path = usePathname() || '/';
  const [lang] = useLang();
  const t = TXT[lang] || TXT.es;
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const visit = read(sessionStorage, VISIT, { views: 0, banner: false, full: false, fromMessage: fromOurMessage(window.location.search) });
    // count each page once (React runs this twice in development; a reload isn't a new page)
    if (visit.last !== path) { visit.views += 1; visit.last = path; }
    const v = promoFor({
      ua: navigator.userAgent, path, visit,
      snoozedUntil: read(localStorage, SNOOZE, 0),
      standalone: window.matchMedia?.('(display-mode: standalone)').matches,
      fromMessage: visit.fromMessage,
    });
    write(sessionStorage, VISIT, visit);
    setVariant(null);
    if (!v) return undefined;
    // a moment after the page shows, so it never covers the page while it loads
    const timer = setTimeout(() => {
      write(sessionStorage, VISIT, { ...visit, [v]: true });
      setVariant(v);
      track('app_promo_shown', { variant: v, page: path === '/' ? 'home' : path.split('/')[1] });
    }, v === 'full' ? 1500 : 2000);
    return () => clearTimeout(timer);
  }, [path]);

  // the full panel owns the screen while open
  useEffect(() => {
    if (variant !== 'full') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [variant]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (!variant) return;
    track('app_promo_closed', { variant, page: path === '/' ? 'home' : path.split('/')[1] });
    setVariant(null);
  };
  // Download tapped: the Badge tracks the click; we stop showing it for a few days.
  const downloaded = () => {
    write(localStorage, SNOOZE, Date.now() + SNOOZE_DAYS * 86400000);
    setTimeout(() => setVariant(null), 300);
  };

  if (variant === 'banner') {
    return (
      <div role="dialog" aria-label={t.line} className="fixed top-3 inset-x-3 z-[400] mx-auto max-w-[460px] rounded-[18px] bg-paper border-[1.5px] border-ink shadow-hard p-3 pr-2 flex items-center gap-3 motion-safe:animate-[clPromoDown_.35s_ease-out]" data-testid="app-promo-banner">
        <img src="/mascot.png" alt="" width={44} height={44} className="w-11 h-11 object-contain shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-tight">{t.line}</p>
          <p className="text-[12px] text-ink/55 mt-0.5">{t.sub}</p>
        </div>
        <span onClick={downloaded} className="shrink-0"><Badge store="play" placement="promo_banner" href={playHref('banner')} /></span>
        <button type="button" onClick={close} aria-label={t.close} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ink/50 hover:text-ink hover:bg-ink/5 text-[18px] leading-none">×</button>
        <style>{'@keyframes clPromoDown{from{transform:translateY(-120%);opacity:0}to{transform:none;opacity:1}}'}</style>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div role="dialog" aria-modal="true" aria-label={t.title} className="fixed inset-0 z-[450] bg-paper flex flex-col motion-safe:animate-[clPromoUp_.35s_ease-out]" data-testid="app-promo-full">
        <div className="flex justify-end p-4">
          <button type="button" onClick={close} aria-label={t.close} className="w-10 h-10 rounded-full border border-ink/25 flex items-center justify-center text-ink/60 hover:text-ink hover:border-ink text-[20px] leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-7 pb-10 flex flex-col items-center text-center">
          <img src="/mascot.png" alt="" width={168} height={168} className="w-[168px] h-[168px] object-contain mt-2" />
          <h2 className="text-[28px] font-bold tracking-head leading-[1.1] mt-5 max-w-[16ch]">{t.title}</h2>
          <p className="text-[15px] text-ink/60 mt-3">{t.lead}</p>
          <ul className="mt-6 flex flex-col gap-3 text-left w-full max-w-[320px]">
            {t.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] font-medium">
                <span className="mt-[3px] w-5 h-5 shrink-0 rounded-full bg-ink text-paper flex items-center justify-center text-[11px]">✓</span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8" onClick={downloaded}><Badge store="play" xl placement="promo_full" href={playHref('full')} /></div>
          <button type="button" onClick={close} className="mt-5 text-[14px] font-semibold text-ink/55 underline underline-offset-4">{t.stay}</button>
        </div>
        <style>{'@keyframes clPromoUp{from{transform:translateY(100%)}to{transform:none}}'}</style>
      </div>
    );
  }
  return null;
}
