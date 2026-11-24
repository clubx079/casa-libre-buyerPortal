// /newsletter/<date> — one edition of the newsletter (lib/newsletter/editionStore.js), with the
// numbers measured for ITS date. The weekly email links here (/newsletter/<date>?utm_…), so the
// newest edition is shown here too (canonical /newsletter) instead of a redirect that would drop
// the email's UTM tags. New weekly editions are rendered on demand (dynamicParams).
import { notFound } from 'next/navigation';
import NewsletterEditionPage from '@/components/NewsletterEditionPage';
import { COUNTRY } from '@/lib/country';
import { EDITIONS, editionByDate } from '@/lib/newsletter/editions';
import { allEditions } from '@/lib/newsletter/editionStore';

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return EDITIONS.map((e) => ({ date: e.date })); }

const longDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export async function generateMetadata({ params }) {
  const editions = await allEditions();
  const e = editionByDate(params.date, editions);
  if (!e) return {};
  return {
    title: `Newsletter de Casa-Libre — edición del ${longDate(e.date)}`,
    description: `Lo que buscaban los compradores en ${COUNTRY.name} hasta el ${longDate(e.date)}: precios, zonas, consejos para publicar e historias de éxito.`,
    alternates: { canonical: e.date === editions[0]?.date ? '/newsletter' : `/newsletter/${e.date}` },
  };
}

export default async function NewsletterEdition({ params }) {
  const editions = await allEditions();
  const e = editionByDate(params.date, editions);
  if (!e) notFound();
  return <NewsletterEditionPage edition={e} editions={editions} />;
}
