// /newsletter — the LATEST edition of the Casa-Libre newsletter (lib/newsletter/editions.js):
// its articles filled with THIS country's numbers of the last 30 days, its success stories, and
// links to the previous editions (/newsletter/<date>). Re-measured every 6 hours.
import NewsletterEditionPage from '@/components/NewsletterEditionPage';
import { COUNTRY } from '@/lib/country';
import { latestEdition } from '@/lib/newsletter/editions';

export const revalidate = 21600;

export const metadata = {
  title: `Newsletter de Casa-Libre — qué buscan los compradores en ${COUNTRY.name}`,
  description: `Datos reales de Casa-Libre sobre lo que buscan los compradores e inquilinos en ${COUNTRY.name}: precios, zonas y tipos de propiedad más vistos, consejos para publicar e historias de éxito.`,
  alternates: { canonical: '/newsletter' },
};

export default function NewsletterPage() {
  return <NewsletterEditionPage edition={latestEdition()} />;
}
