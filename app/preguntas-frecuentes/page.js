import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';

export const metadata = {
  title: 'Preguntas frecuentes — Comprar, alquilar y publicar en Casa Libre',
  description: '¿Cómo publico gratis? ¿Casa Libre cobra comisión? ¿Cómo contacto al dueño? Respuestas a las preguntas más comunes sobre Casa Libre en Paraguay.',
  alternates: { canonical: '/preguntas-frecuentes' },
};

const FAQ_ES = [
  { q: '¿Cuánto cuesta publicar una propiedad?', a: 'Publicar en Casa Libre es totalmente gratis. No cobramos por publicar ni comisiones por la venta o el alquiler. Solo necesitás crear una cuenta.' },
  { q: '¿Casa Libre cobra comisión por la venta?', a: 'No. Casa Libre no cobra comisión. Conectamos directamente a quien publica con quien busca; la operación es entre las partes.' },
  { q: '¿Necesito una cuenta para publicar?', a: 'Sí. Para publicar necesitás iniciar sesión con tu email o con Google, así cada propiedad queda vinculada a un dueño. Para buscar y ver propiedades no hace falta cuenta.' },
  { q: '¿En qué ciudades hay propiedades?', a: 'Casa Libre reúne propiedades de todo Paraguay: Asunción y el Gran Asunción (Luque, San Lorenzo, Lambaré, Fernando de la Mora), Ciudad del Este, Encarnación, San Bernardino y más.' },
  { q: '¿Puedo guardar propiedades para ver después?', a: 'Sí. Con una cuenta gratuita podés guardar tus propiedades favoritas y verlas cuando quieras desde tu panel.' },
  { q: '¿Cómo contacto al dueño de una propiedad?', a: 'Cada aviso muestra el contacto del publicador. Podés escribirle por WhatsApp o teléfono para coordinar una visita, sin intermediarios.' },
  { q: '¿Los precios están en guaraníes o en dólares?', a: 'Ambos. Cada propiedad muestra su precio en guaraníes (₲) y en dólares (US$) con la cotización actualizada.' },
];

const FAQ_EN = [
  { q: 'How much does it cost to list a property?', a: 'Listing on Casa Libre is completely free. We charge nothing to list and take no commission on the sale or rental. You only need to create an account.' },
  { q: 'Does Casa Libre charge a commission on sales?', a: 'No. Casa Libre charges no commission. We connect listers directly with searchers; the deal is between the parties.' },
  { q: 'Do I need an account to list?', a: 'Yes. To list you need to sign in with your email or Google, so every property is tied to an owner. You don’t need an account to search and view properties.' },
  { q: 'Which cities have properties?', a: 'Casa Libre gathers properties from all over Paraguay: Asunción and Greater Asunción (Luque, San Lorenzo, Lambaré, Fernando de la Mora), Ciudad del Este, Encarnación, San Bernardino and more.' },
  { q: 'Can I save properties to view later?', a: 'Yes. With a free account you can save your favorite properties and view them anytime from your dashboard.' },
  { q: 'How do I contact the owner of a property?', a: 'Each listing shows the lister’s contact. You can reach them by WhatsApp or phone to arrange a visit, with no middlemen.' },
  { q: 'Are prices in guaraníes or dollars?', a: 'Both. Each property shows its price in guaraníes (₲) and dollars (US$) with an up-to-date exchange rate.' },
];

const content = {
  es: {
    hero: { eyebrow: 'Ayuda', title: 'Preguntas', titleSerif: 'frecuentes.', sub: 'Todo lo que necesitás saber sobre comprar, alquilar y publicar en Casa Libre.' },
    blocks: [
      { type: 'faq', items: FAQ_ES },
      { type: 'cta', title: '¿Listo para empezar?', sub: 'Buscá tu próxima propiedad o publicá la tuya gratis.', primary: ['Ver propiedades', '/propiedades'], secondary: ['Publicar gratis', '/publicar'] },
    ],
  },
  en: {
    hero: { eyebrow: 'Help', title: 'Frequently asked', titleSerif: 'questions.', sub: 'Everything you need to know about buying, renting and listing on Casa Libre.' },
    blocks: [
      { type: 'faq', items: FAQ_EN },
      { type: 'cta', title: 'Ready to start?', sub: 'Find your next property or list yours for free.', primary: ['Browse listings', '/propiedades'], secondary: ['List for free', '/publicar'] },
    ],
  },
};

export default function Page() {
  // JSON-LD stays Spanish (the SEO target market) and server-rendered.
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ES.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Article content={content} />
    </MarketingShell>
  );
}
