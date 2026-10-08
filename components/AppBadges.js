'use client';
// App-store promo — hand-built badges (no image files, no outer white box): a
// single dark pill per store with the store glyph + label. Apple mark is white;
// the Google Play mark is the colorful triangle. Localized caption via useLang.
//  - variant="default" (marketplace): mobile = caption on top + badges row;
//    desktop = badge · caption · badge on one line, slightly larger.
//  - variant="row" (home, below the search bar): just the two badges side by side.
// Google Play opens the app's store page; App Store opens /descargar (no iPhone app yet).
//  - StickyAppBadges: the badges in place, plus a slim bar pinned to the bottom of the
//    screen once that spot scrolls away — so the app stays one tap away while people
//    scroll (home + phone listings; the desktop listings page never scrolls).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { PLAY_STORE_URL } from '@/lib/appLinks';

const T = { es: 'Funciona mejor en la app', en: 'It works better on the app', pt: 'Funciona melhor no app' };

const Apple = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

// Colorful Google Play triangle (4 segments).
const Play = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 512 512" aria-hidden="true">
    <path fill="#00d2ff" d="M25.6 21.3C22.4 24.6 20.5 29.9 20.5 36.7v438.6c0 6.8 1.9 12.1 5.1 15.4l1.5 1.4 245.7-245.7v-5.8L27.1 19.9z" />
    <path fill="#00e676" d="M354.6 336.8 272.8 255v-5.8l81.8-81.8 1.9 1.1 96.9 55c27.7 15.7 27.7 41.5 0 57.3l-96.9 55z" />
    <path fill="#ff3d00" d="M356.5 335.7 272.8 252 25.6 490.7c9.1 9.7 24.2 10.9 41.2 1.3l289.7-156.3z" />
    <path fill="#ffc400" d="M356.5 168.3 66.8 12C49.8 2.4 34.7 3.6 25.6 13.3L272.8 252z" />
  </svg>
);

function Badge({ store, big }) {
  const isApple = store === 'apple';
  const top = isApple ? 'Download on the' : 'GET IT ON';
  const name = isApple ? 'App Store' : 'Google Play';
  const cls = `inline-flex items-center rounded-[9px] bg-ink text-paper transition-transform active:translate-y-px ${big ? 'gap-2.5 px-4 py-2' : 'gap-2 px-3 py-[7px]'}`;
  const inner = (
    <>
      {isApple ? <Apple s={big ? 22 : 18} /> : <Play s={big ? 18 : 15} />}
      <span className="flex flex-col leading-none text-left gap-[3px]">
        <span className={`uppercase tracking-[.06em] text-paper/75 ${big ? 'text-[9px]' : 'text-[8px]'}`}>{top}</span>
        <span className={`font-semibold ${big ? 'text-[15px]' : 'text-[12.5px]'}`}>{name}</span>
      </span>
    </>
  );
  if (!isApple) {
    return <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={name} className={cls}>{inner}</a>;
  }
  return <Link href="/descargar" aria-label={name} className={cls}>{inner}</Link>;
}

export default function AppBadges({ className = '', variant = 'default' }) {
  const [lang] = useLang();
  const label = T[lang] || T.es;

  if (variant === 'row') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Badge store="apple" big />
        <Badge store="play" big />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* mobile: caption on top, badges below */}
      <div className="md:hidden flex flex-col items-center gap-1.5 text-center">
        <span className="text-[10.5px] font-medium text-ink/55">{label}</span>
        <div className="flex items-center gap-2.5">
          <Badge store="apple" />
          <Badge store="play" />
        </div>
      </div>
      {/* desktop: badge · caption · badge on one line */}
      <div className="hidden md:flex items-center justify-center gap-4">
        <Badge store="apple" big />
        <span className="text-[13.5px] font-medium text-ink/60 whitespace-nowrap">{label}</span>
        <Badge store="play" big />
      </div>
    </div>
  );
}

// The badges where they are, and — once that spot has scrolled above the top of the
// screen — the same badges in a bar pinned to the bottom. (CSS sticky can't do this
// on the home page: the badges sit inside the hero, so they'd only stick within it.)
// While the bar shows, the page gets the same space at its end, so the footer's last
// line is never hidden under it.
// z-[300]: above the page, below the sort/filter sheets (500) and every modal (999+).
export function StickyAppBadges({ variant = 'default', className = '' }) {
  const ref = useRef(null);
  const barRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!pinned || !barRef.current) return undefined;
    document.body.style.paddingBottom = `${barRef.current.offsetHeight}px`;
    return () => { document.body.style.paddingBottom = ''; };
  }, [pinned]);
  return (
    <>
      <div ref={ref} className={className}><AppBadges variant={variant} /></div>
      {pinned && (
        <div ref={barRef} data-testid="sticky-app-badges" className="fixed bottom-0 inset-x-0 z-[300] bg-paper/95 backdrop-blur-sm border-t border-ink/12 shadow-[0_-2px_10px_rgba(17,17,17,0.08)] px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          <AppBadges />
        </div>
      )}
    </>
  );
}
