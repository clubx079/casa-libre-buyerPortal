// Casa Libre "Verificada" (verified) tag — shown on every paid promotion (both the
// US$5 verified plan and the US$20 landing plan). Brand-mono: ink pill with a paper
// verified-seal icon + text (ink/paper only, no color, no emoji). The check inside the
// seal is knocked out (evenodd) so the pill shows through as the checkmark. Size via
// `className` (font-size drives the seal at 1.15em). Default label ES; pass lang="en".

// The bare verified-seal glyph (fill = currentColor). Reused as the tag icon AND
// standalone (e.g. beside the plan-box headings in the sell flows).
export function VerifiedIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" aria-hidden="true" className={className}>
      <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5 12 21.04l3.4 1.46 1.89-3.2 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z" />
    </svg>
  );
}

export default function VerifiedTag({ lang = 'es', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 bg-ink text-paper rounded-pill font-bold uppercase tracking-label leading-none ${className}`}>
      <VerifiedIcon className="w-[1.15em] h-[1.15em] -ml-0.5" />
      {lang === 'es' ? 'Verificada' : 'Verified'}
    </span>
  );
}
