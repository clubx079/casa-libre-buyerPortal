'use client';
// The property page's WhatsApp contact CTA. Client component so the click can
// be tracked (contact_seller_clicked) before opening WhatsApp. Falls back to a
// disabled state when the listing has no phone.
import { track } from '@/lib/analytics';

export default function PropertyContactButton({ waUrl, property }) {
  if (!waUrl) {
    return (
      <button disabled aria-disabled="true" className="w-full px-6 py-3.5 bg-paper/40 text-ink/40 font-semibold rounded-pill cursor-not-allowed">
        Sin contacto
      </button>
    );
  }
  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('contact_seller_clicked', { ...property, channel: 'whatsapp' })}
      className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-paper text-ink font-semibold rounded-pill"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.6.1-.6.8-.7.9-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A2.8 2.8 0 0 0 6.4 9c0 1.7 1.2 3.3 1.4 3.5s2.4 3.7 5.8 5c2 .9 2.4.7 2.9.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2z" /></svg>
      Contactar
    </a>
  );
}
