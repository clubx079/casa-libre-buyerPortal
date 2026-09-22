import { SITE, CITIES, COMPETITORS } from '@/lib/site';
import { guideSlugs } from '@/lib/guias';
import { getListings } from '@/lib/listings';
import { indexableCombos, indexableBarrioCombos } from '@/lib/matrix';

export const revalidate = 3600;

export default async function sitemap() {
  const now = new Date();
  const entries = [];
  const staticPaths = [
    ['', 1.0, 'daily'], ['/propiedades', 0.9, 'daily'], ['/comprar', 0.8, 'daily'], ['/alquilar', 0.8, 'daily'],
    ['/vender', 0.8, 'monthly'], ['/publicar', 0.7, 'monthly'], ['/nuestra-historia', 0.6, 'monthly'],
    ['/como-funciona', 0.6, 'monthly'], ['/preguntas-frecuentes', 0.6, 'monthly'], ['/guias', 0.7, 'weekly'], ['/contacto', 0.5, 'monthly'],
    ['/terminos', 0.3, 'yearly'], ['/privacidad', 0.3, 'yearly'],
  ];
  staticPaths.forEach(([p, priority, changeFrequency]) => entries.push({ url: `${SITE}${p}`, lastModified: now, changeFrequency, priority }));
  CITIES.forEach((c) => entries.push({ url: `${SITE}/propiedades-en/${c.slug}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 }));
  COMPETITORS.forEach((c) => entries.push({ url: `${SITE}/comparar/${c.slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 }));
  guideSlugs().forEach((slug) => entries.push({ url: `${SITE}/guias/${slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 }));
  try {
    const { listings } = await getListings({ limit: 5000 });
    listings.forEach((l) => entries.push({ url: `${SITE}/propiedad/${l.id}`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 }));
  } catch { /* DB blip — ship the static + programmatic entries anyway */ }
  // Operation × type × city matrix — only combos that clear the min-listing gate.
  try {
    const combos = await indexableCombos();
    combos.forEach((x) => entries.push({ url: `${SITE}/${x.op}/${x.tipo}/${x.ciudad}`, lastModified: now, changeFrequency: 'daily', priority: 0.7 }));
  } catch { /* inventory blip — ship the rest */ }
  // Operation × type × city × NEIGHBORHOOD matrix (Level 4) — gated combos only.
  try {
    const barrioCombos = await indexableBarrioCombos();
    barrioCombos.forEach((x) => entries.push({ url: `${SITE}/${x.op}/${x.tipo}/${x.ciudad}/${x.barrio}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 }));
  } catch { /* inventory blip — ship the rest */ }
  return entries;
}
