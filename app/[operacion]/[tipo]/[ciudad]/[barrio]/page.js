import { notFound } from 'next/navigation';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import MarketingShell from '@/components/MarketingShell';
import ListingGrid from '@/components/marketing/ListingGrid';
import Bi from '@/components/marketing/Bi';
import { isOp, tipoBySlug, OPS, TIPOS, resolveBarrio, barriosForCity, comboContentBarrio, comboContentBarrioEn, comboContentBarrioPt, capPt, MIN_LISTINGS } from '@/lib/matrix';
import { searchListings } from '@/lib/marketplace';
import { cityBySlug, SITE, INDEXABLE } from '@/lib/site';
import { collectionListingLd, breadcrumbLd } from '@/lib/schema';
import VariantPage, { variantMetadata } from '@/components/seo/VariantPage';
import SeoSections from '@/components/seo/SeoSections';
import { isVariantSlug, fillCount } from '@/lib/seoVariants';
import { getOverride, pageStats, moneyFormatter } from '@/lib/seo';
import { statsLine, faqFor } from '@/lib/seoContent';

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
  // 4th segment = an SEO page variant (…/baratos, …/2-dormitorios), not a neighbourhood
  if (isVariantSlug(params.barrio)) return variantMetadata(params);
  const v = resolveBase(params);
  if (!v) return {};
  const combo = await resolveBarrio({ op: v.op, tipo: params.tipo, ciudad: params.ciudad, barrio: params.barrio });
  if (!combo) return {};
  const c = comboContentBarrio({ op: v.op, tipo: params.tipo, barrioName: combo.barrioName, cityName: v.city.name, count: combo.count });
  const url = `/${v.op}/${params.tipo}/${params.ciudad}/${params.barrio}`;
  const indexed = INDEXABLE && combo.count >= MIN_LISTINGS;
  const ov = await getOverride(url);
  return {
    title: fillCount(ov?.title, combo.count) || c.title,
    description: fillCount(ov?.description, combo.count) || c.description,
    alternates: { canonical: url },
    robots: indexed ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function Page({ params }) {
  if (isVariantSlug(params.barrio)) return VariantPage({ params });
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

  // English twin of the visible copy (same URL — the toggle swaps it client-side).
  const ce = comboContentBarrioEn({ op: v.op, tipo: params.tipo, barrioName: combo.barrioName, cityName: v.city.name, count: combo.count });
  const cp = comboContentBarrioPt({ op: v.op, tipo: params.tipo, barrioName: combo.barrioName, cityName: v.city.name, count: combo.count });
  const op = OPS[v.op], tp = v.tipo;
  // SEO pipeline: override, live stats, data FAQ, extra links
  const seoPath = `/${v.op}/${params.tipo}/${params.ciudad}/${params.barrio}`;
  const [ov, stats, money] = await Promise.all([getOverride(seoPath), pageStats(seoPath), moneyFormatter()]);
  const h1Es = fillCount(ov?.h1, combo.count) || c.h1;
  const seoCtx = { op: v.op, sing: tp.sing, plural: tp.plural, opLabel: op.label, place: `${combo.barrioName}, ${v.city.name}`, stats, money };
  const liveLine = statsLine(seoCtx);
  const faq = faqFor(seoCtx);
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
          <Link href="/propiedades" className="hover:underline"><Bi es="Propiedades" en="Properties" pt="Imóveis" /></Link>
          {' · '}
          <Link href={cityUrl} className="hover:underline"><Bi es={`${op.short} de ${tp.plural} en ${v.city.name}`} en={`${tp.pluralEn} ${op.labelEn} in ${v.city.name}`} pt={`${capPt(tp.pluralPt)} ${op.labelPt} em ${v.city.name}`} /></Link>
          {' · '}{combo.barrioName}
        </nav>
        <h1 className="text-[28px] font-bold tracking-tight text-ink md:text-[36px]"><Bi es={h1Es} en={ce.h1} pt={cp.h1} /></h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink/70"><Bi es={c.intro} en={ce.intro} pt={cp.intro} /></p>
        {liveLine ? <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink/60" data-seo="stats">{liveLine}</p> : null}

        <div className="mt-6">
          <ListingGrid listings={listings} />
        </div>

        <div className="mt-6">
          <Link
            href={`/propiedades?op=${v.op}&type=${v.tipo.type}&q=${encodeURIComponent(combo.barrioName)}`}
            className="inline-flex items-center gap-2 rounded-pill bg-ink px-5 py-3 text-[14px] font-semibold text-paper"
          >
            <Bi es={`Ver las ${combo.count} propiedades en el mapa →`} en={`See the ${combo.count} properties on the map →`} pt={`Ver os ${combo.count} imóveis no mapa →`} />
          </Link>
        </div>

        {siblings.length ? (
          <section className="mt-12 border-t-[1.5px] border-ink/10 pt-8">
            <h2 className="text-[18px] font-bold text-ink"><Bi es={`Otros barrios en ${v.city.name}`} en={`Other neighbourhoods in ${v.city.name}`} pt={`Outros bairros em ${v.city.name}`} /></h2>
            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {siblings.map((x) => (
                <li key={x.barrio}>
                  <Link href={`/${x.op}/${x.tipo}/${x.ciudad}/${x.barrio}`} className="text-[14px] text-ink hover:underline">
                    <Bi es={`${OPS[x.op].short} de ${TIPOS[x.tipo].plural} en ${x.barrioName}`} en={`${TIPOS[x.tipo].pluralEn} ${OPS[x.op].labelEn} in ${x.barrioName}`} pt={`${capPt(TIPOS[x.tipo].pluralPt)} ${OPS[x.op].labelPt} em ${x.barrioName}`} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <SeoSections faq={faq} links={Array.isArray(ov?.extra_links) ? ov.extra_links : []} />
      </div>
    </MarketingShell>
  );
}
