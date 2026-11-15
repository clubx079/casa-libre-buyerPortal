// Small spinner shown inside a search submit button while the search is being
// applied (navigation or results fetch in flight). Inherits the button's text colour.
export default function SearchSpinner({ className = 'w-[18px] h-[18px]' }) {
  return <span className={`inline-block rounded-full border-2 border-current/25 border-t-current animate-spin ${className}`} aria-hidden="true" />;
}
