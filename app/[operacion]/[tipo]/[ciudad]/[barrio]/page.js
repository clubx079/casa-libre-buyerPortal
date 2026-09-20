import { notFound } from 'next/navigation';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import MarketingShell from '@/components/MarketingShell';
import ListingGrid from '@/components/marketing/ListingGrid';
import { isOp, tipoBySlug, OPS, TIPOS, resolveBarrio, barriosForCity, comboContentBarrio, MIN_LISTINGS } from '@/lib/matrix';
import { searchListings } from '@/lib/marketplace';
import { cityBySlug, SITE, INDEXABLE } from '@/lib/site';
import { collectionListingLd, breadcrumbLd } from '@/lib/schema';

// Level-4 SEO page: operation × type × city × NEIGHBORHOOD (e.g.
// /venta/casas/asuncion/herrera). Runtime-rendered so robots/indexability read live
// env + live inventory. Strict 4-segment route: any invalid/thin combo → 404, so it
// never shadows an existing route and never publishes an empty page.
export const dynamic = 'force-dynamic';

const getBarrioListings = unstable_cache(
  async (op, type, cityName, barrioName) =>
    searchListings({ op, type, q: cityName, barrio: barrioName, page: 1, pageSize: 24, sort: 'relevancia' }),
  ['cl-matrix-barrio-listings-v1'],
  { revalidate: 300, tags: ['listings'] },
);

function resolveBase(params) {
  const tipo = tipoBySlug(params.tipo);
  const city = cityBySlug(params.ciudad);
  if (!isOp(params.operacion) || !tipo || !city) return null;
  return { op: params.operacion, tipo, city };
}

export async function generateMetadata({ params }) {
  const v = resolveBase(params);
  if (!v) return {};
  const combo = await resolveBarrio({ op: v.op, tipo: params.tipo, ciudad: params.ciudad, barrio: params.barrio });
  if (!combo) return {};
  const c = comboContentBarrio({ op: v.op, tipo: params.tipo, barrioName: combo.barrioName, cityName: v.city.name, count: combo.count });
  const url = `/${v.op}/${params.tipo}/${params.ciudad}/${params.barrio}`;
  const indexed = INDEXABLE && combo.count >= MIN_LISTINGS;
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: url },
    robots: indexed ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function Page({ params }) {
  const v = resolveBase(params);
  if (!v) notFound();
  const combo = await resolveBarrio({ op: v.op, tipo: params.tipo, ciudad: params.ciudad, barrio: params.barrio });
  // Only publish neighborhood pages with real depth — never thin/empty pages.
  if (!combo || combo.count < MIN_LISTINGS) notFound();

  const c = comboContentBarrio({ op: v.op, tipo: params.tipo, barrioName: combo.barrioName, cityName: v.city.name, count: combo.count });
  const { listings } = await getBarrioListings(v.op, v.tipo.type, v.city.name, combo.barrioName);

  // Internal links → sibling barrios in the same city (same op/type), never to a
  // barrio that doesn't clear the gate.
  const siblings = (await barriosForCity(v.op, params.tipo, params.ciudad))
    .filter((x) => x.barrio !== params.barrio)
    .slice(0, 12);

  const cityUrl = `/${v.op}/${params.tipo}/${params.ciudad}`;
  const base = `${SITE}${cityUrl}/${params.barrio}`;
  const ldCollection = collectionListingLd({ name: c.h1, description: c.description, url: base, listings, site: SITE });
  const ldCrumb = breadcrumbLd([
    { name: 'Casa Libre', url: SITE },
    { name: OPS[v.op].short, url: `${SITE}/${v.op === 'venta' ? 'comprar' : 'alquilar'}` },
    { name: `${OPS[v.op].short} de ${v.tipo.plural} en ${v.city.name}`, url: `${SITE}${cityUrl}` },
    { name: c.h1, url: base },
  ]);

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldCollection) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldCrumb) }} />
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <nav className="mb-3 text-[13px] text-ink/50">
          <Link href="/propiedades" className="hover:underline">Propiedades</Link>
          {' · '}
          <Link href={cityUrl} className="hover:underline">{OPS[v.op].short} de {v.tipo.plural} en {v.city.name}</Link>
          {' · '}{combo.barrioName}
        </nav>
        <h1 className="text-[28px] font-bold tracking-tight text-ink md:text-[36px]">{c.h1}</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink/70">{c.intro}</p>

        <div className="mt-6">
          <ListingGrid listings={listings} />
        </div>

        <div className="mt-6">
          <Link
            href={`/propiedades?op=${v.op}&type=${v.tipo.type}&q=${encodeURIComponent(combo.barrioName)}`}
            className="inline-flex items-center gap-2 rounded-pill bg-ink px-5 py-3 text-[14px] font-semibold text-paper"
          >
            Ver las {combo.count} propiedades en el mapa →
          </Link>
        </div>

        {siblings.length ? (
          <section className="mt-12 border-t-[1.5px] border-ink/10 pt-8">
            <h2 className="text-[18px] font-bold text-ink">Otros barrios en {v.city.name}</h2>
            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {siblings.map((x) => (
                <li key={x.barrio}>
                  <Link href={`/${x.op}/${x.tipo}/${x.ciudad}/${x.barrio}`} className="text-[14px] text-ink hover:underline">
                    {OPS[x.op].short} de {TIPOS[x.tipo].plural} en {x.barrioName}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </MarketingShell>
  );
}
