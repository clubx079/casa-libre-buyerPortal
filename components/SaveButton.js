'use client';
import { useFavorites } from './FavoritesProvider';
import { useLang } from '@/lib/useLang';

const T = {
  es: { save: 'Guardar', saved: 'Guardada', remove: 'Quitar de guardadas' },
  en: { save: 'Save', saved: 'Saved', remove: 'Remove from saved' },
};

// Heart toggle for saving a property.
//   variant 'card'   — small floating circle over an image
//   variant 'detail' — labeled pill (Guardar / Guardada)
// Saved state stays readable: a filled ink heart on a light surface (never an
// all-black button, which hides the heart).
export default function SaveButton({ id, variant = 'card', className = '' }) {
  const { isSaved, toggle } = useFavorites();
  const [lang] = useLang();
  const t = T[lang];
  const saved = isSaved(id);
  const onClick = (e) => { e.preventDefault(); e.stopPropagation(); toggle(id); };

  const heart = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={saved ? '#111111' : 'none'} stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.5 1.1-1a5.5 5.5 0 0 0 0-7.9z" />
    </svg>
  );

  if (variant === 'detail') {
    return (
      <button
        onClick={onClick}
        aria-pressed={saved}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-pill border-[1.5px] text-[14px] font-semibold text-ink transition-colors ${saved ? 'border-ink bg-hatch2' : 'border-ink/30 bg-card hover:border-ink'} ${className}`}
      >
        {heart}{saved ? t.saved : t.save}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? t.remove : t.save}
      className={`w-9 h-9 rounded-pill bg-paper/90 backdrop-blur flex items-center justify-center border transition-colors ${saved ? 'border-ink' : 'border-ink/15 hover:border-ink'} ${className}`}
    >
      {heart}
    </button>
  );
}
