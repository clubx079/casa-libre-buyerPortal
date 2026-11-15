// Spinner shown inside a search button while the search is being applied (navigation or
// results fetch in flight). Brand colours: the search buttons are ink (#111111) with paper
// (#F9F4EE) text, so the ring is a faint paper track with a solid paper arc that spins —
// clearly visible on the dark button. Explicit colours (Tailwind's border-current/25 does
// not work with currentColor, which made the old ring nearly invisible).
export default function SearchSpinner({ className = 'w-5 h-5' }) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={`inline-block flex-none rounded-full animate-spin ${className}`}
      style={{ border: '2.5px solid rgba(249, 244, 238, 0.28)', borderTopColor: '#F9F4EE', animationDuration: '0.7s' }}
    />
  );
}
