// How people reach Casa Libre: our WhatsApp (the Relay number — replies land in the admin
// Inbox) and the country's support email. Used by /contacto and the footer.
import { COUNTRY } from './country.js';

const MSG = { es: 'Hola Casa Libre, tengo una consulta:', en: 'Hi Casa Libre, I have a question:' };

// '13323333839' → '+1 (332) 333-3839'; other countries' numbers → '+595 981 123 456' style.
export function displayPhone(digits = COUNTRY.businessWhatsApp) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`.trim();
}

export const supportWhatsAppUrl = (lang = 'es') => {
  const d = String(COUNTRY.businessWhatsApp || '').replace(/\D/g, '');
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(MSG[lang] || MSG.es)}` : null;
};

export const supportEmail = () => COUNTRY.supportEmail || null;
