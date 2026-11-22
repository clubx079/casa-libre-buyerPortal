// /newsletter/<date> — a previous edition of the newsletter (lib/newsletter/editions.js), with the
// numbers measured for ITS date. The latest edition lives at /newsletter.
import { notFound, redirect } from 'next/navigation';
import NewsletterEditionPage from '@/components/NewsletterEditionPage';
import { COUNTRY } from '@/lib/country';
import { EDITIONS, editionByDate } from '@/lib/newsletter/editions';

export const revalidate = 86400;
export const dynamicParams = false;
export function generateStaticParams() { return EDITIONS.map((e) => ({ date: e.date })); }

const longDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function generateMetadata({ params }) {
  const e = editionByDate(params.date);
  if (!e) return {};
  return {
    title: `Newsletter de Casa-Libre — edición del ${longDate(e.date)}`,
    description: `Lo que buscaban los compradores en ${COUNTRY.name} hasta el ${longDate(e.date)}: precios, zonas, consejos para publicar e historias de éxito.`,
    alternates: { canonical: `/newsletter/${e.date}` },
  };
}

export default function NewsletterEdition({ params }) {
  const e = editionByDate(params.date);
  if (!e) notFound();
  if (e === EDITIONS[0]) redirect('/newsletter');
  return <NewsletterEditionPage edition={e} />;
}
