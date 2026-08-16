import { notFound } from 'next/navigation';
import MarketingShell from '@/components/MarketingShell';
import CityContent from '@/components/marketing/CityContent';
import { CITIES, cityBySlug, SITE } from '@/lib/site';

export const dynamic = 'force-static';
export function generateStaticParams() { return CITIES.map((c) => ({ ciudad: c.slug })); }

export function generateMetadata({ params }) {
  const c = cityBySlug(params.ciudad);
  if (!c) return {};
  return {
    title: `Propiedades en ${c.name} — Casas y departamentos en venta y alquiler`,
    description: `Encontrá casas, departamentos y locales en venta y alquiler en ${c.name}, Paraguay. Explorá las propiedades de ${c.name} en el mapa con Casa Libre. Buscar es gratis.`,
    alternates: { canonical: `/propiedades-en/${c.slug}` },
  };
}

export default function Page({ params }) {
  const c = cityBySlug(params.ciudad);
  if (!c) notFound();
  const others = CITIES.filter((x) => x.slug !== c.slug);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Casa Libre', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Propiedades', item: `${SITE}/propiedades` },
      { '@type': 'ListItem', position: 3, name: c.name, item: `${SITE}/propiedades-en/${c.slug}` },
    ],
  };
  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <CityContent name={c.name} others={others} />
    </MarketingShell>
  );
}
