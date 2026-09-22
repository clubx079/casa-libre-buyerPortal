import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY } from '@/lib/country';

export const metadata = {
  title: 'Preguntas frecuentes — Comprar, alquilar y publicar en Casa Libre',
  description: `¿Cómo vendo mi casa? ¿Cuánto vale mi propiedad? ¿Qué documentos necesito? ¿Cómo publico gratis? Respuestas claras sobre comprar, alquilar, vender y publicar propiedades en ${COUNTRY.name}.`,
  alternates: { canonical: '/preguntas-frecuentes' },
};

const FAQ_ES = [
  { q: '¿Qué propiedades voy a encontrar en Casa Libre?', a: `Todas las de ${COUNTRY.name} en un solo lugar: las que publican las inmobiliarias y las que publican los dueños particulares, en venta y en alquiler. Casa Libre no es un sitio solo de dueño a dueño: reunimos el mercado completo para que no tengas que mirar cinco sitios distintos.` },
  { q: '¿Cuánto cuesta publicar una propiedad?', a: 'Publicar en Casa Libre es totalmente gratis, tanto para inmobiliarias como para dueños particulares. No cobramos por publicar ni comisiones por la venta o el alquiler. Solo necesitás crear una cuenta.' },
  { q: '¿Casa Libre cobra comisión por la venta?', a: 'No. Casa Libre no cobra comisión. Conectamos directamente a quien publica con quien busca; la operación es entre las partes.' },
  { q: `¿Cómo vendo mi casa en ${COUNTRY.name}?`, a: `Publicá tu propiedad gratis en Casa Libre: subí fotos reales, marcá la dirección en el mapa y poné un precio de referencia mirando propiedades parecidas en tu zona. Los interesados te escriben directo por WhatsApp y coordinás las visitas vos. Cuando aparece un comprador, la compraventa se firma ante escribano o notario, que verifica el título y las deudas del inmueble.` },
  { q: '¿Cómo sé cuánto vale mi propiedad?', a: 'La referencia más útil es lo que piden propiedades parecidas a la tuya: mismo barrio, metros cuadrados, dormitorios y estado. Filtrá esa búsqueda en el mapa de Casa Libre y vas a ver el rango real de la zona. Para una tasación formal, un profesional o un tasador matriculado te da un valor con respaldo.' },
  { q: '¿Qué documentos y costos tiene una compraventa?', a: 'En general intervienen el título de propiedad, la cédula o identificación de las partes, los certificados y comprobantes de impuestos y servicios al día, y la escritura ante escribano o notario. A eso se suman los honorarios y los impuestos de transferencia que correspondan. Los montos y requisitos cambian según el caso y el país, así que conviene confirmarlos con tu escribano antes de firmar.' },
  { q: '¿Cómo alquilo mi propiedad sin inmobiliaria?', a: 'Publicá el aviso gratis con fotos y ubicación, respondé por WhatsApp y mostrá la propiedad vos mismo. Antes de firmar, pedí referencias y comprobantes de ingresos, y dejá por escrito el plazo, el monto, los ajustes, el depósito y quién paga cada servicio. Un contrato firmado y, si corresponde, una garantía, te evitan la mayoría de los problemas.' },
  { q: '¿Cómo busco propiedades en el mapa?', a: 'Abrí el mapa en el sitio o en la app y movelo hasta la zona que te interesa: la lista se actualiza sola con lo que hay en pantalla. Podés filtrar por venta o alquiler, tipo, precio y dormitorios, y tocar cualquier chincheta para ver la foto y el precio sin abrir el aviso completo.' },
  { q: '¿Necesito una cuenta para publicar?', a: 'Sí. Para publicar necesitás iniciar sesión con tu email o con Google, así cada propiedad queda vinculada a un dueño. Para buscar y ver propiedades no hace falta cuenta.' },
  { q: '¿En qué ciudades hay propiedades?', a: `Casa Libre reúne propiedades de todo ${COUNTRY.name}: ${COUNTRY.capital} y el Gran Asunción (Luque, San Lorenzo, Lambaré, Fernando de la Mora), Ciudad del Este, Encarnación, San Bernardino y más.` },
  { q: '¿Puedo guardar propiedades para ver después?', a: 'Sí. Con una cuenta gratuita podés guardar tus propiedades favoritas y verlas cuando quieras desde tu panel.' },
  { q: '¿Cómo contacto a quien publica una propiedad?', a: 'Cada aviso muestra el contacto de quien publica, sea una inmobiliaria o un dueño particular. Podés escribirle por WhatsApp o llamarlo para coordinar una visita, sin comisiones de por medio.' },
  { q: `¿Los precios están en ${COUNTRY.currencyName} o en dólares?`, a: `Ambos. Cada propiedad muestra su precio en ${COUNTRY.currencyName} (${COUNTRY.currencySymbol}) y en dólares (US$) con la cotización actualizada.` },
];

const FAQ_EN = [
  { q: 'What kind of properties will I find on Casa Libre?', a: `Every property in ${COUNTRY.name} in one place: listings from real-estate agencies and from private owners, for sale and for rent. Casa Libre is not an owner-to-owner-only site — we gather the whole market so you don't have to check five different sites.` },
  { q: 'How much does it cost to list a property?', a: 'Listing on Casa Libre is completely free, for agencies and private owners alike. We charge nothing to list and take no commission on the sale or rental. You only need to create an account.' },
  { q: 'Does Casa Libre charge a commission on sales?', a: 'No. Casa Libre charges no commission. We connect listers directly with searchers; the deal is between the parties.' },
  { q: `How do I sell my house in ${COUNTRY.name}?`, a: 'List it free on Casa Libre: add real photos, drop the address on the map, and price it by looking at similar homes in your area. Buyers message you directly on WhatsApp and you arrange the visits yourself. Once you have a buyer, the sale is signed before a notary, who checks the title and any debts on the property.' },
  { q: 'How do I know what my property is worth?', a: 'The most useful reference is what comparable properties are asking: same neighbourhood, size, bedrooms and condition. Filter that search on the Casa Libre map and you will see the real range for the area. For a formal valuation, a licensed appraiser can give you a documented figure.' },
  { q: 'What documents and costs does a property sale involve?', a: 'Typically the title deed, ID for both parties, certificates showing taxes and utilities are up to date, and the deed signed before a notary — plus notary fees and any transfer taxes. Amounts and requirements vary by case and by country, so confirm them with your notary before signing.' },
  { q: 'How do I rent out my property without an agency?', a: 'Publish the listing free with photos and location, reply on WhatsApp, and show the property yourself. Before signing, ask for references and proof of income, and put the term, rent, increases, deposit and who pays each utility in writing. A signed contract, and a guarantee where it applies, prevents most problems.' },
  { q: 'How do I search on the map?', a: 'Open the map on the site or in the app and move it to the area you care about: the list updates to whatever is on screen. You can filter by sale or rent, type, price and bedrooms, and tap any pin to see the photo and price without opening the full listing.' },
  { q: 'Do I need an account to list?', a: 'Yes. To list you need to sign in with your email or Google, so every property is tied to an owner. You don’t need an account to search and view properties.' },
  { q: 'Which cities have properties?', a: `Casa Libre gathers properties from all over ${COUNTRY.name}: ${COUNTRY.capital} and Greater Asunción (Luque, San Lorenzo, Lambaré, Fernando de la Mora), Ciudad del Este, Encarnación, San Bernardino and more.` },
  { q: 'Can I save properties to view later?', a: 'Yes. With a free account you can save your favorite properties and view them anytime from your dashboard.' },
  { q: 'How do I contact whoever listed a property?', a: 'Each listing shows the lister’s contact, whether that is an agency or a private owner. You can reach them by WhatsApp or phone to arrange a visit, with no commission in between.' },
  { q: `Are prices in ${COUNTRY.currencyName} or dollars?`, a: `Both. Each property shows its price in ${COUNTRY.currencyName} (${COUNTRY.currencySymbol}) and dollars (US$) with an up-to-date exchange rate.` },
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
