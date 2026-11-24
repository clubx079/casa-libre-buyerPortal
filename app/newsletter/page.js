// /newsletter — the LATEST edition of the Casa-Libre newsletter (lib/newsletter/editionStore.js:
// the weekly generated ones + the hand-made ones): its articles filled with THIS country's numbers
// of the last 30 days, its success stories, and links to the previous editions (/newsletter/<date>).
// Re-rendered every 30 minutes, so a new weekly edition shows well before its email goes out.
import NewsletterEditionPage from '@/components/NewsletterEditionPage';
import { COUNTRY } from '@/lib/country';
import { allEditions } from '@/lib/newsletter/editionStore';

export const revalidate = 1800;

export const metadata = {
  title: `Newsletter de Casa-Libre — qué buscan los compradores en ${COUNTRY.name}`,
  description: `Datos reales de Casa-Libre sobre lo que buscan los compradores e inquilinos en ${COUNTRY.name}: precios, zonas y tipos de propiedad más vistos, consejos para publicar e historias de éxito.`,
  alternates: { canonical: '/newsletter' },
};

export default async function NewsletterPage() {
  const editions = await allEditions();
  return <NewsletterEditionPage edition={editions[0]} editions={editions} />;
}
