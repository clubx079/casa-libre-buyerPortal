import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';

export const metadata = {
  title: 'Contacto — Casa Libre',
  description: 'Contactate con el equipo de Casa Libre. Estamos para ayudarte a comprar, alquilar o publicar propiedades en Paraguay.',
  alternates: { canonical: '/contacto' },
};

const content = {
  es: {
    hero: { eyebrow: 'Contacto', title: 'Hablemos.', sub: '¿Tenés una consulta o necesitás ayuda? Escribinos y te respondemos.' },
    blocks: [
      { type: 'contact', items: [
        { label: 'Publicá tu propiedad', value: 'Publicar gratis →', href: '/publicar' },
        { label: 'Preguntas frecuentes', value: 'Ver respuestas →', href: '/preguntas-frecuentes' },
      ] },
    ],
  },
  en: {
    hero: { eyebrow: 'Contact', title: 'Let’s talk.', sub: 'Have a question or need help? Write to us and we’ll get back to you.' },
    blocks: [
      { type: 'contact', items: [
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
