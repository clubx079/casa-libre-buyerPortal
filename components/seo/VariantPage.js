// SEO page variant: /{op}/{tipo}/{ciudad}/{variant} — a REAL filter on a city page ("baratos" = under
// the area's typical price, "2-dormitorios" = exactly 2 bedrooms; lib/seoVariants.js). Served from the
// barrio route (the 4th segment is a variant slug, never a neighbourhood). It exists only when the
// admin's SEO pipeline switched it on for the city page, is indexed + in the sitemap only with ≥5
// listings, and answers noindex once the weekly loop retired it. Canonical = itself (its own listing
// set, its own title — not a duplicate of the city page).
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import MarketingShell from '@/components/MarketingShell';
import ListingGrid from '@/components/marketing/ListingGrid';
import Bi from '@/components/marketing/Bi';
import SeoSections from '@/components/seo/SeoSections';
import { isOp, tipoBySlug, OPS, MIN_LISTINGS, capPt } from '@/lib/matrix';
import { searchListings } from '@/lib/marketplace';
import { cityBySlug, SITE, INDEXABLE } from '@/lib/site';
import { collectionListingLd, breadcrumbLd } from '@/lib/schema';
import { getOverride, pageStats, moneyFormatter } from '@/lib/seo';
import { VARIANTS, variantState, variantFilter, fillCount } from '@/lib/seoVariants';
import { statsLine, faqFor } from '@/lib/seoContent';

// '<' inside JSON-LD becomes the 6 characters backslash-u003c: stored text can never close the <script> tag
const LT_ESC = String.fromCharCode(92) + 'u003c';

const getVariantListings = unstable_cache(
  async (op, type, cityName, filter) => searchListings({ op, type, q: cityName, page: 1, pageSize: 24, sort: 'precio_asc', ...filter }),
  ['cl-seo-variant-listings-v1'],
  { revalidate: 300, tags: ['listings'] },
);

async function resolveVariant(params) {
  const tipo = tipoBySlug(params.tipo);
  const city = cityBySlug(params.ciudad);
  const v = VARIANTS[params.barrio];
  if (!isOp(params.operacion) || !tipo || !city || !v) return null;
  const base = `/${params.operacion}/${params.tipo}/${params.ciudad}`;
  const path = `${base}/${params.barrio}`;
  const [baseOv, ov, stats] = await Promise.all([getOverride(base), getOverride(path), pageStats(path)]);
  const state = variantState({ slug: params.barrio, count: stats.count, enabled: baseOv?.enabled_variants, retired: baseOv?.retired_variants, min: MIN_LISTINGS });
  if (state === 'off') return null;
  const op = OPS[params.operacion];
  const Tipo = tipo.plural.charAt(0).toUpperCase() + tipo.plural.slice(1);
  const h1 = `${op.short} de ${tipo.plural} ${v.es} en ${city.name}`;
  const copy = {
    h1: fillCount(ov?.h1, stats.count) || h1,
    title: fillCount(ov?.title, stats.count) || `${Tipo} ${v.es} ${op.label} en ${city.name} — ${stats.count} opciones`,
    description: fillCount(ov?.description, stats.count) || `${stats.count} ${tipo.plural} ${op.label} ${v.es} en ${city.name}, en Casa Libre, con contacto directo por WhatsApp. Precios, fotos y ubicación en el mapa.`,
    h1En: `${tipo.pluralEn.charAt(0).toUpperCase() + tipo.pluralEn.slice(1)} ${op.labelEn} ${v.en} in ${city.name}`,
    h1Pt: `${capPt(tipo.pluralPt)} ${v.pt} ${op.labelPt} em ${city.name}`,
  };
  return { tipo, city, v, op, base, path, stats, state, copy, extra: Array.isArray(ov?.extra_links) ? ov.extra_links : [] };
}

export async function variantMetadata(params) {
  const r = await resolveVariant(params);
  if (!r) return {};
  return {
    title: r.copy.title,
    description: r.copy.description,
    alternates: { canonical: r.path },
    robots: INDEXABLE && r.state === 'index' ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function VariantPage({ params }) {
  const r = await resolveVariant(params);
  if (!r) notFound();
  const { tipo, city, v, op, base, path, stats, copy } = r;
  const filter = variantFilter(params.barrio, stats.cityMedian);
  const { listings } = await getVariantListings(params.operacion, tipo.type, city.name, filter || {});
  const money = await moneyFormatter();
  const ctx = { op: params.operacion, sing: tipo.sing, plural: tipo.plural, opLabel: op.label, place: city.name, stats, money, variantLabel: v.es, variantSing: v.esSing };
  const liveLine = statsLine({ ...ctx, plural: `${tipo.plural} ${v.es}` });
  const faq = faqFor(ctx);
  const cheapNote = v.kind === 'cheap' && stats.cityMedian
    ? `"Baratos" = por debajo del precio típico de ${tipo.plural} ${op.label} en ${city.name} (${money(stats.cityMedian)}${params.operacion === 'alquiler' ? ' por mes' : ''}).`
    : null;
  const url = `${SITE}${path}`;
  const ldCollection = collectionListingLd({ name: copy.h1, description: copy.description, url, listings, site: SITE });
  const ldCrumb = breadcrumbLd([
    { name: 'Casa Libre', url: SITE },
    { name: op.short, url: `${SITE}/${params.operacion === 'venta' ? 'comprar' : 'alquilar'}` },
    { name: `${op.short} de ${tipo.plural} en ${city.name}`, url: `${SITE}${base}` },
    { name: copy.h1, url },
  ]);
  const links = [{ href: base, label: `${op.short} de ${tipo.plural} en ${city.name} (todas)` }, ...r.extra];
  const q = new URLSearchParams({ op: params.operacion, type: tipo.type, q: city.name, ...(filter?.priceMax ? { priceMax: String(filter.priceMax) } : {}), ...(filter?.bedsExact ? { beds: String(filter.bedsExact) } : {}) });

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldCollection).replace(/</g, LT_ESC) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldCrumb).replace(/</g, LT_ESC) }} />
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <nav className="mb-3 text-[13px] text-ink/50">
          <Link href="/propiedades" className="hover:underline"><Bi es="Propiedades" en="Properties" pt="Imóveis" /></Link>
          {' · '}
          <Link href={base} className="hover:underline">{`${op.short} de ${tipo.plural} en ${city.name}`}</Link>
          {' · '}{v.es}
        </nav>
        <h1 className="text-[28px] font-bold tracking-tight text-ink md:text-[36px]"><Bi es={copy.h1} en={copy.h1En} pt={copy.h1Pt} /></h1>
        {liveLine ? <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink/70" data-seo="stats">{liveLine}</p> : null}
        {cheapNote ? <p className="mt-2 max-w-3xl text-[13.5px] text-ink/55">{cheapNote}</p> : null}
        <div className="mt-6"><ListingGrid listings={listings} /></div>
        <div className="mt-6">
          <Link href={`/propiedades?${q}`} className="inline-flex items-center gap-2 rounded-pill bg-ink px-5 py-3 text-[14px] font-semibold text-paper">
            <Bi es={`Ver las ${stats.count} propiedades en el mapa →`} en={`See the ${stats.count} properties on the map →`} pt={`Ver os ${stats.count} imóveis no mapa →`} />
          </Link>
        </div>
        <SeoSections faq={faq} links={links} />
      </div>
    </MarketingShell>
  );
}
