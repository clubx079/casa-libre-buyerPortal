'use client';
// "Get the app" pop-up on every device (rules: lib/appPromo.js). Mounted once in
// app/layout.js. One big centered card (almost full screen, page dimmed behind it): the
// mascot, "Funciona mejor en la app", the App Store and Google Play buttons, and ×.
// It shows on the home page and on the visitor's second page, each once per visit.
// Tracked: 'app_promo_shown' / 'app_promo_closed' { moment: 'home' | 'second', page }, and
// taps on either store button as 'app_badge_clicked' { store, placement:
// 'promo_home' | 'promo_second' } — the same event as every other app button (admin funnel
// "Clicked an app button"). The Play link carries an install referrer (utm_medium=popup).
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { PLAY_STORE_URL } from '@/lib/appLinks';
import { track } from '@/lib/analytics';
import { promoFor, fromOurMessage, SNOOZE_DAYS } from '@/lib/appPromo';
import { Badge } from '@/components/AppBadges';

const VISIT = 'cl_app_promo_visit';   // sessionStorage: { views, last, home, second, fromMessage }
const SNOOZE = 'cl_app_promo_until';  // localStorage: ms timestamp

const TXT = {
  es: { line: 'Funciona mejor en la app', sub: 'Descargá gratis la app de Casa Libre', close: 'Cerrar' },
  en: { line: 'It works better on the app', sub: 'Get the Casa Libre app for free', close: 'Close' },
};

const read = (store, key, fallback) => { try { const v = store.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (store, key, v) => { try { store.setItem(key, JSON.stringify(v)); } catch { /* private mode: fine */ } };
const playHref = (moment) => `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`utm_source=casalibre_web&utm_medium=popup&utm_campaign=app_promo_${moment}`)}`;
const pageOf = (path) => (path === '/' ? 'home' : path.split('/')[1]);

export default function AppPromo() {
  const path = usePathname() || '/';
  const [lang] = useLang();
  const t = TXT[lang] || TXT.es;
  const [moment, setMoment] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const visit = read(sessionStorage, VISIT, { views: 0, home: false, second: false, fromMessage: fromOurMessage(window.location.search) });
    // count each page once (React runs this twice in development; a reload isn't a new page)
    if (visit.last !== path) { visit.views += 1; visit.last = path; }
    const m = promoFor({
      ua: navigator.userAgent, path, visit,
      snoozedUntil: read(localStorage, SNOOZE, 0),
      standalone: window.matchMedia?.('(display-mode: standalone)').matches,
      fromMessage: visit.fromMessage,
    });
    write(sessionStorage, VISIT, visit);
    setMoment(null);
    if (!m) return undefined;
    // a moment after the page shows, so it never covers the page while it loads
    const timer = setTimeout(() => {
      write(sessionStorage, VISIT, { ...visit, [m]: true });
      setMoment(m);
      track('app_promo_shown', { moment: m, page: pageOf(path) });
    }, 1500);
    return () => clearTimeout(timer);
  }, [path]);

  useEffect(() => {
    if (!moment) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moment]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (!moment) return;
    track('app_promo_closed', { moment, page: pageOf(path) });
    setMoment(null);
  };
  // Download tapped: the Badge tracks the click; we stop showing it for a few days.
  const downloaded = () => {
    write(localStorage, SNOOZE, Date.now() + SNOOZE_DAYS * 86400000);
    setTimeout(() => setMoment(null), 300);
  };

  if (!moment) return null;
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={t.line} data-testid="app-promo">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-[680px] min-h-[min(84vh,720px)] max-h-[94vh] overflow-y-auto bg-paper border-[1.5px] border-ink rounded-[28px] shadow-hard px-6 sm:px-12 py-12 flex flex-col items-center justify-center text-center motion-safe:animate-[clPromoIn_.25s_ease-out]">
        <button ref={closeRef} type="button" onClick={close} aria-label={t.close} className="absolute top-4 right-4 sm:top-5 sm:right-5 w-11 h-11 rounded-pill border-[1.5px] border-ink/25 flex items-center justify-center text-[22px] leading-none text-ink/60 hover:border-ink hover:text-ink">×</button>
        <img src="/mascot.png" alt="" width={260} height={260} className="w-[200px] h-[200px] sm:w-[260px] sm:h-[260px] object-contain" />
        <p className="text-[30px] sm:text-[40px] font-bold tracking-head leading-[1.08] mt-6 max-w-[14ch]">{t.line}</p>
        <p className="text-[16px] sm:text-[18px] text-ink/60 mt-3">{t.sub}</p>
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3" onClick={downloaded}>
          <Badge store="apple" xl placement={`promo_${moment}`} />
          <Badge store="play" xl placement={`promo_${moment}`} href={playHref(moment)} />
        </div>
      </div>
      <style>{'@keyframes clPromoIn{from{transform:translateY(16px) scale(.97);opacity:0}to{transform:none;opacity:1}}'}</style>
    </div>
  );
}
