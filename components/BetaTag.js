// Small "BETA" marker for features still being validated (e.g. zoning).
//   tone 'ink'   — dark tag on light surfaces (default)
//   tone 'paper' — light tag on a dark (ink) surface
export default function BetaTag({ tone = 'ink', className = '' }) {
  const cls = tone === 'paper' ? 'bg-paper text-ink' : 'bg-ink text-paper';
  return (
    <span className={`inline-flex items-center px-[5px] py-[1px] rounded-pill font-mono text-[9px] leading-[1.3] font-semibold tracking-[0.8px] uppercase ${cls} ${className}`}>
      Beta
    </span>
  );
}
