// One selectable promotion-plan box for the sell flows (Verified / Landing). Radio
// behaviour (mutually exclusive) is owned by the parent via `on`/`onClick`. Brand-mono:
// ink selection ring + a paper check in the radio when picked. The title carries the
// plan's message; `price` sits on the right; `badge` (e.g. "Recommended") shows below
// the title; `benefits` is an optional list of lines (may be empty).
export default function PlanBox({ on, onClick, title, price, benefits = [], badge = null, icon = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative w-full flex items-start gap-3 text-left rounded-[14px] border-[1.5px] p-3.5 transition-colors ${on ? 'border-ink bg-ink/[0.04] shadow-hard-sm' : 'border-ink/25 hover:border-ink/50'}`}
    >
      <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center ${on ? 'bg-ink border-ink text-paper' : 'border-ink/40'}`}>
        {on && <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
      </span>
      <span className="flex-1 min-w-0">
        {badge && <span className="inline-flex mb-1.5">{badge}</span>}
        <span className="flex items-start justify-between gap-2">
          <span className="flex items-start gap-1.5 min-w-0">
            {icon && <span className="shrink-0 mt-[1px] text-ink">{icon}</span>}
            <span className="text-[14px] font-bold tracking-head leading-snug">{title}</span>
          </span>
          <span className="shrink-0 mt-0.5 text-[12px] font-bold text-ink/70 whitespace-nowrap">{price}</span>
        </span>
        {benefits.length > 0 && (
          <ul className="space-y-1 mt-1.5">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-ink/65 leading-snug">
                <svg viewBox="0 0 24 24" className="w-3 h-3 mt-[3px] shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </span>
    </button>
  );
}
