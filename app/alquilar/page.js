import MarketingShell from '@/components/MarketingShell';
import Article from '@/components/marketing/Article';
import { COUNTRY } from '@/lib/country';
import { SITE } from '@/lib/site';
import { breadcrumbLd } from '@/lib/schema';

export const metadata = {
  title: `Alquilar propiedades en ${COUNTRY.name} — Casas y departamentos en alquiler`,
  description: `Alquilá casas y departamentos en ${COUNTRY.name}. Encontrá propiedades en alquiler en ${COUNTRY.capital} y todo el país, en el mapa, con precio mensual en ${COUNTRY.currencyName} y dólares.`,
  alternates: { canonical: '/alquilar' },
};

const content = {
  es: {
    hero: { eyebrow: 'Alquilar', title: 'Propiedades en alquiler', titleSerif: `en ${COUNTRY.name}.`, sub: 'Casas y departamentos en alquiler en todo el país, con precio mensual claro y ubicación en el mapa.' },
    blocks: [
      { type: 'ctaButton', label: 'Ver propiedades en alquiler →', href: '/propiedades?op=alquiler' },
      { type: 'prose', nodes: [
        ['p', `¿Buscás algo para alquilar? En <strong>Casa Libre</strong> encontrás departamentos amoblados, casas familiares y monoambientes en alquiler en ${COUNTRY.capital} y el interior. Compará el alquiler mensual en ${COUNTRY.currencyName} y dólares y coordiná la visita directamente con el dueño.`],
        ['h2', 'Alquilar por ciudad'],
      ] },
      { type: 'cities', prefix: 'Alquilar en' },
      { type: 'cta', title: 'Encontrá tu próximo hogar', sub: 'Explorá las propiedades en alquiler o publicá la tuya gratis.', primary: ['Ver en alquiler', '/propiedades?op=alquiler'], secondary: ['Publicar gratis', '/publicar'] },
    ],
  },
  en: {
    hero: { eyebrow: 'Rent', title: 'Properties for rent', titleSerif: `in ${COUNTRY.name}.`, sub: 'Houses and apartments for rent across the country, with a clear monthly price and location on the map.' },
    blocks: [
      { type: 'ctaButton', label: 'View properties for rent →', href: '/propiedades?op=alquiler' },
      { type: 'prose', nodes: [
        ['p', `Looking to rent? On <strong>Casa Libre</strong> you’ll find furnished apartments, family houses and studios for rent in ${COUNTRY.capital} and the interior. Compare the monthly rent in ${COUNTRY.currencyName} and dollars and arrange a visit directly with the owner.`],
        ['h2', 'Rent by city'],
      ] },
      { type: 'cities', prefix: 'Rent in' },
      { type: 'cta', title: 'Find your next home', sub: 'Browse properties for rent or list yours for free.', primary: ['View for rent', '/propiedades?op=alquiler'], secondary: ['List for free', '/publicar'] },
    ],
  },
};

export default function Page() {
  const ld = breadcrumbLd([
    { name: 'Casa Libre', url: SITE },
    { name: 'Alquilar', url: `${SITE}/alquilar` },
  ]);
  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Article content={content} />
    </MarketingShell>
  );
}
