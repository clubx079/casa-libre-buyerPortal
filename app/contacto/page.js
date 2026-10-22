import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY } from '@/lib/country';
import { displayPhone, supportWhatsAppUrl, supportEmail } from '@/lib/support';

export const metadata = {
  title: 'Contacto — Casa Libre',
  description: `Contactate con el equipo de Casa Libre. Estamos para ayudarte a comprar, alquilar o publicar propiedades en ${COUNTRY.name}.`,
  alternates: { canonical: '/contacto' },
};

// WhatsApp (our Relay number — replies land in the admin Inbox) and the support email
// come first; then publishing and the FAQ. lib/support.js.
const reach = (lang) => [
  ...(supportWhatsAppUrl(lang) ? [{ label: 'WhatsApp', value: `${displayPhone()} →`, href: supportWhatsAppUrl(lang) }] : []),
  ...(supportEmail() ? [{ label: 'Email', value: supportEmail(), href: `mailto:${supportEmail()}` }] : []),
];

const content = {
  es: {
    hero: { eyebrow: 'Contacto', title: 'Hablemos.', sub: '¿Tenés una consulta o necesitás ayuda? Escribinos por WhatsApp o por email y te respondemos.' },
    blocks: [
      { type: 'contact', items: [
        ...reach('es'),
        { label: 'Publicá tu propiedad', value: 'Publicar gratis →', href: '/publicar' },
        { label: 'Preguntas frecuentes', value: 'Ver respuestas →', href: '/preguntas-frecuentes' },
      ] },
    ],
  },
  en: {
    hero: { eyebrow: 'Contact', title: 'Let’s talk.', sub: 'Have a question or need help? Message us on WhatsApp or by email and we’ll get back to you.' },
    blocks: [
      { type: 'contact', items: [
        ...reach('en'),
        { label: 'List your property', value: 'List for free →', href: '/publicar' },
        { label: 'Frequently asked questions', value: 'See answers →', href: '/preguntas-frecuentes' },
      ] },
    ],
  },
};

export default function Page() {
  return (
    <MarketingShell>
      <Article content={content} />
    </MarketingShell>
  );
}
