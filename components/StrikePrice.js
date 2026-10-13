// A crossed-out list price: a bold diagonal line through the whole amount (not just a
// thin strikethrough), brand ink. Used by the paid-listing price (US$29 → US$5.80).
export default function StrikePrice({ children, className = '', ...rest }) {
  return (
    <span className={`relative inline-block font-semibold text-ink/45 ${className}`} {...rest}>
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute left-[-3px] right-[-3px] top-1/2 h-[2px] bg-ink rounded-full -rotate-[14deg]" />
    </span>
  );
}
