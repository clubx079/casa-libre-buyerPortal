import { SITE, CITIES, COMPETITORS } from '@/lib/site';
import { getListings } from '@/lib/listings';

export const revalidate = 3600;

export default async function sitemap() {
  const now = new Date();
  const entries = [];
  const staticPaths = [
    ['', 1.0, 'daily'], ['/propiedades', 0.9, 'daily'], ['/comprar', 0.8, 'daily'], ['/alquilar', 0.8, 'daily'],
    ['/vender', 0.8, 'monthly'], ['/publicar', 0.7, 'monthly'], ['/nuestra-historia', 0.6, 'monthly'],
    ['/como-funciona', 0.6, 'monthly'], ['/preguntas-frecuentes', 0.6, 'monthly'], ['/contacto', 0.5, 'monthly'],
    ['/terminos', 0.3, 'yearly'], ['/privacidad', 0.3, 'yearly'],
  ];
  staticPaths.forEach(([p, priority, changeFrequency]) => entries.push({ url: `${SITE}${p}`, lastModified: now, changeFrequency, priority }));
  CITIES.forEach((c) => entries.push({ url: `${SITE}/propiedades-en/${c.slug}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 }));
  COMPETITORS.forEach((c) => entries.push({ url: `${SITE}/comparar/${c.slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 }));
  try {
    const { listings } = await getListings({ limit: 5000 });
    listings.forEach((l) => entries.push({ url: `${SITE}/propiedad/${l.slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 }));
  } catch { /* DB blip — ship the static + programmatic entries anyway */ }
  return entries;
}
