'use client';
import { useState } from 'react';
import { useLang } from '@/lib/useLang';

const T = { es: { share: 'Compartir', copied: 'Enlace copiado' }, en: { share: 'Share', copied: 'Link copied' } };

// Circular share button (matches SaveButton). Uses the native Web Share sheet
// where available (mobile), falling back to copy-to-clipboard on desktop.
export default function ShareButton({ url, title, className = '' }) {
  const [lang] = useLang();
  const [copied, setCopied] = useState(false);
  const t = T[lang] || T.es;

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: title || 'Casa Libre', url: shareUrl }); } catch { /* cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  return (
    <button
      onClick={onClick}
      aria-label={t.share}
      title={copied ? t.copied : t.share}
      className={`w-9 h-9 rounded-pill bg-paper/90 backdrop-blur flex items-center justify-center border transition-colors ${copied ? 'border-ink' : 'border-ink/15 hover:border-ink'} ${className}`}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
    </button>
  );
}
