import { notFound } from 'next/navigation';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import MarketingShell from '@/components/MarketingShell';
import ListingGrid from '@/components/marketing/ListingGrid';
import { isOp, tipoBySlug, OPS, TIPOS, comboCount, indexableCombos, comboContent, barriosForCity, MIN_LISTINGS } from '@/lib/matrix';
import { searchListings } from '@/lib/marketplace';
import { CITIES, cityBySlug, SITE, INDEXABLE } from '@/lib/site';
import { collectionListingLd, breadcrumbLd } from '@/lib/schema';

// Runtime-rendered so robots/indexability read live env + live inventory. Combos
// are validated against known ops/types/cities; anything else is a 404. This is a
// strict 3-segment route, so it never shadows an existing static route.
export const dynamic = 'force-dynamic';

const getComboListings = unstable_cache(
  async (op, type, cityName) => searchListings({ op, type, q: cityName, page: 1, pageSize: 24, sort: 'relevancia' }),
  ['cl-matrix-listings-v1'],
  { revalidate: 300, tags: ['listings'] },
);

function resolve(params) {
  const tipo = tipoBySlug(params.tipo);
  const city = cityBySlug(params.ciudad);
  if (!isOp(params.operacion) || !tipo || !city) return null;
  return { op: params.operacion, tipo, city };
}

export async function generateMetadata({ params }) {
  const v = resolve(params);
  if (!v) return {};
  const count = await comboCount({ op: v.op, tipo: params.tipo, ciudad: params.ciudad });
  const c = comboContent({ op: v.op, tipo: params.tipo, ciudad: params.ciudad, count });
  const url = `/${v.op}/${params.tipo}/${params.ciudad}`;
  const indexed = INDEXABLE && count >= MIN_LISTINGS;
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: url },
    // Below the min-listing gate → crawlable but not indexed (avoids thin pages
    // in the index). Above → follow the site's normal indexability.
    robots: indexed ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function Page({ params }) {
  const v = resolve(params);
  if (!v) notFound();
  const count = await comboCount({ op: v.op, tipo: params.tipo, ciudad: params.ciudad });
  if (count === 0) notFound(); // no inventory → no page at all

  const c = comboContent({ op: v.op, tipo: params.tipo, ciudad: params.ciudad, count });
  const { listings } = await getComboListings(v.op, v.tipo.type, v.city.name);

  // Internal links → only to combos that clear the gate (never to thin/404 pages).
  const idx = await indexableCombos();
  const otherTypes = idx.filter((x) => x.op === v.op && x.ciudad === params.ciudad && x.tipo !== params.tipo).slice(0, 6);
  const otherCities = idx.filter((x) => x.op === v.op && x.tipo === params.tipo && x.ciudad !== params.ciudad).slice(0, 8);
  // Level-4 internal links → neighborhoods within THIS city that clear the gate.
  const barrios = (await barriosForCity(v.op, params.tipo, params.ciudad)).slice(0, 12);

  const base = `${SITE}/${v.op}/${params.tipo}/${params.ciudad}`;
  const ldCollection = collectionListingLd({ name: c.h1, description: c.description, url: base, listings, site: SITE });
  const ldCrumb = breadcrumbLd([
    { name: 'Casa Libre', url: SITE },
    { name: OPS[v.op].short, url: `${SITE}/${v.op === 'venta' ? 'comprar' : 'alquilar'}` },
    { name: c.h1, url: base },
  ]);
  const cityName = (s) => (CITIES.find((cc) => cc.slug === s) || {}).name || s;

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldCollection) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldCrumb) }} />
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <nav className="mb-3 text-[13px] text-ink/50">
          <Link href="/propiedades" className="hover:underline">Propiedades</Link> · {c.h1}
        </nav>
        <h1 className="text-[28px] font-bold tracking-tight text-ink md:text-[36px]">{c.h1}</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink/70">{c.intro}</p>

        <div className="mt-6">
          <ListingGrid listings={listings} />
        </div>

        <div className="mt-6">
          <Link
            href={`/propiedades?op=${v.op}&type=${v.tipo.type}&q=${encodeURIComponent(v.city.name)}`}
            className="inline-flex items-center gap-2 rounded-pill bg-ink px-5 py-3 text-[14px] font-semibold text-paper"
          >
            Ver las {count} propiedades en el mapa →
          </Link>
        </div>

        {barrios.length ? (
          <section className="mt-12 border-t-[1.5px] border-ink/10 pt-8">
            <h2 className="text-[18px] font-bold text-ink">{OPS[v.op].short} de {v.tipo.plural} por barrio en {c.cityName}</h2>
            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {barrios.map((x) => (
                <li key={x.barrio}>
                  <Link href={`/${x.op}/${x.tipo}/${x.ciudad}/${x.barrio}`} className="text-[14px] text-ink hover:underline">
                    {OPS[x.op].short} de {TIPOS[x.tipo].plural} en {x.barrioName}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {(otherTypes.length || otherCities.length) ? (
          <section className="mt-12 border-t-[1.5px] border-ink/10 pt-8">
            <h2 className="text-[18px] font-bold text-ink">Búsquedas relacionadas</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {otherTypes.length ? (
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wide text-ink/50">Otros tipos en {c.cityName}</div>
                  <ul className="mt-2 space-y-1.5">
                    {otherTypes.map((x) => (
                      <li key={x.tipo}>
                        <Link href={`/${x.op}/${x.tipo}/${x.ciudad}`} className="text-[14px] text-ink hover:underline">
                          {OPS[x.op].short} de {TIPOS[x.tipo].plural} en {c.cityName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {otherCities.length ? (
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wide text-ink/50">{TIPOS[params.tipo].plural} en otras ciudades</div>
                  <ul className="mt-2 space-y-1.5">
                    {otherCities.map((x) => (
                      <li key={x.ciudad}>
                        <Link href={`/${x.op}/${x.tipo}/${x.ciudad}`} className="text-[14px] text-ink hover:underline">
                          {OPS[x.op].short} de {TIPOS[x.tipo].plural} en {cityName(x.ciudad)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </MarketingShell>
  );
}
