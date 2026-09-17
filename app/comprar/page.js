import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY } from '@/lib/country';
import { SITE } from '@/lib/site';
import { breadcrumbLd } from '@/lib/schema';

export const metadata = {
  title: `Comprar propiedades en ${COUNTRY.name} — Casas y departamentos en venta | Casa Libre`,
  description: `Comprá casas, departamentos, dúplex y terrenos en venta en ${COUNTRY.name}. Explorá miles de propiedades en el mapa, con precio en ${COUNTRY.currencyName} y dólares. Buscar es gratis.`,
  alternates: { canonical: '/comprar' },
};

const content = {
  es: {
    hero: { eyebrow: 'Comprar', title: 'Propiedades en venta', titleSerif: `en ${COUNTRY.name}.`, sub: 'Casas, departamentos, dúplex y locales en venta en todo el país, en un mapa fácil de usar.' },
    blocks: [
      { type: 'ctaButton', label: 'Ver propiedades en venta →', href: '/propiedades?op=venta' },
      { type: 'prose', nodes: [
        ['p', `En <strong>Casa Libre</strong> encontrás miles de propiedades en venta en ${COUNTRY.name}: casas en barrios cerrados, departamentos en ${COUNTRY.capital}, dúplex a estrenar y locales comerciales. Filtrá por ciudad, barrio, precio y dormitorios, y compará todo en el mapa con fotos reales.`],
        ['h2', 'Comprar por ciudad'],
      ] },
      { type: 'cities', prefix: 'Comprar en' },
      { type: 'cta', title: 'Encontrá tu próxima casa', sub: 'Explorá las propiedades en venta o publicá la tuya gratis.', primary: ['Ver en venta', '/propiedades?op=venta'], secondary: ['Publicar gratis', '/publicar'] },
    ],
  },
  en: {
    hero: { eyebrow: 'Buy', title: 'Properties for sale', titleSerif: `in ${COUNTRY.name}.`, sub: 'Houses, apartments, duplexes and commercial spaces for sale across the country, on an easy-to-use map.' },
    blocks: [
      { type: 'ctaButton', label: 'View properties for sale →', href: '/propiedades?op=venta' },
      { type: 'prose', nodes: [
        ['p', `On <strong>Casa Libre</strong> you’ll find thousands of properties for sale in ${COUNTRY.name}: houses in gated communities, apartments in ${COUNTRY.capital}, brand-new duplexes and commercial spaces. Filter by city, neighborhood, price and bedrooms, and compare everything on the map with real photos.`],
        ['h2', 'Buy by city'],
      ] },
      { type: 'cities', prefix: 'Buy in' },
      { type: 'cta', title: 'Find your next home', sub: 'Browse properties for sale or list yours for free.', primary: ['View for sale', '/propiedades?op=venta'], secondary: ['List for free', '/publicar'] },
    ],
  },
};

export default function Page() {
  const ld = breadcrumbLd([
    { name: 'Casa Libre', url: SITE },
    { name: 'Comprar', url: `${SITE}/comprar` },
  ]);
  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Article content={content} />
    </MarketingShell>
  );
}
