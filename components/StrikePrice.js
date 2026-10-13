// A crossed-out list price: two lines through the amount forming an X (not a thin
// strikethrough), brand ink. Used by the paid-listing price (US$29 → US$5.80).
export default function StrikePrice({ children, className = '', ...rest }) {
  const line = 'pointer-events-none absolute left-[-2px] right-[-2px] top-1/2 h-[2px] bg-ink/80 rounded-full';
  return (
    <span className={`relative inline-block px-0.5 font-bold text-ink/60 ${className}`} {...rest}>
      {children}
      <span aria-hidden="true" className={`${line} rotate-[16deg]`} />
      <span aria-hidden="true" className={`${line} -rotate-[16deg]`} />
    </span>
  );
}
