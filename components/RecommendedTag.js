// Casa Libre "Recomendado" (recommended) tag — the attention badge on the US$20
// "Feature on landing page" box in the sell flows (replaces the old "Featured" tag on
// that box). Brand-mono: ink pill + paper star + text (ink/paper only, no emoji). Size
// via `className` (font-size drives the star at 1.1em). Default label ES; lang="en".
export default function RecommendedTag({ lang = 'es', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 bg-ink text-paper rounded-pill font-bold uppercase tracking-label leading-none ${className}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-[1.1em] h-[1.1em] -ml-0.5">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
      {lang === 'es' ? 'Recomendado' : 'Recommended'}
    </span>
  );
}
