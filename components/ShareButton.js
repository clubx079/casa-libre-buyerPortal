'use client';
import { useState } from 'react';
import { useLang } from '@/lib/useLang';
import ShareSheet from '@/components/ShareSheet';

const T = { es: { share: 'Compartir', copied: 'Enlace copiado' }, en: { share: 'Share', copied: 'Link copied' }, pt: { share: 'Compartilhar', copied: 'Link copiado' } };

// Share button. With a listingId it opens the listing's share kit (components/ShareSheet.js:
// image, captions, one tracked link per network). Without one: the native share sheet,
// or copy-to-clipboard on desktop.
//   variant 'circle' (default, matches SaveButton) | 'pill' (a labeled "Compartir" button)
export default function ShareButton({ url, title, listingId, source = 'listing', variant = 'circle', className = '' }) {
  const [lang] = useLang();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const t = T[lang] || T.es;

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (listingId) { setOpen(true); return; }
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: title || 'Casa-Libre', url: shareUrl }); } catch { /* cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  const icon = (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );

  return (
    <>
      {variant === 'pill' ? (
        <button onClick={onClick} data-testid="share-open" className={`inline-flex items-center justify-center gap-1.5 rounded-pill border-[1.5px] border-ink font-bold text-[13px] hover:bg-ink hover:text-paper transition-colors ${className || 'px-4 py-2'}`}>
          {icon}{t.share}
        </button>
      ) : (
        <button
          onClick={onClick}
          aria-label={t.share}
          title={copied ? t.copied : t.share}
          data-testid="share-open"
          className={`w-9 h-9 rounded-pill bg-paper/90 backdrop-blur flex items-center justify-center border text-ink transition-colors ${copied ? 'border-ink' : 'border-ink/15 hover:border-ink'} ${className}`}
        >
          {icon}
        </button>
      )}
      {open && <ShareSheet listingId={listingId} title={title} open onClose={() => setOpen(false)} source={source} />}
    </>
  );
}
