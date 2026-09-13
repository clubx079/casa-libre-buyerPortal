import { notFound } from 'next/navigation';
import MarketingShell from '@/components/MarketingShell';
import CompareContent from '@/components/marketing/CompareContent';
import { COMPETITORS, competitorBySlug } from '@/lib/site';
import { COUNTRY } from '@/lib/country';

export const dynamic = 'force-static';
export function generateStaticParams() { return COMPETITORS.map((c) => ({ competidor: c.slug })); }

export function generateMetadata({ params }) {
  const c = competitorBySlug(params.competidor);
  if (!c) return {};
  return {
    title: `Casa Libre vs ${c.name} — ¿Dónde publicar y buscar propiedades en ${COUNTRY.name}?`,
    description: `Comparación entre Casa Libre y ${c.name} para comprar, alquilar y publicar propiedades en ${COUNTRY.name}. Publicar en Casa Libre es gratis y sin comisiones.`,
    alternates: { canonical: `/comparar/${c.slug}` },
    keywords: [`alternativa a ${c.name}`, `${c.name} ${COUNTRY.name}`, `publicar propiedad gratis ${COUNTRY.name}`, 'Casa Libre'],
  };
}

export default function Page({ params }) {
  const c = competitorBySlug(params.competidor);
  if (!c) notFound();
  const others = COMPETITORS.filter((x) => x.slug !== c.slug);
  return (
    <MarketingShell>
      <CompareContent name={c.name} blurb={c.blurb} blurbEn={c.blurbEn} others={others} />
    </MarketingShell>
  );
}
