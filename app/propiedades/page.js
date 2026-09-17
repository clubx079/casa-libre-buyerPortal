import { unstable_cache } from 'next/cache';
import { getActiveCountCached } from '@/lib/listings';
import { searchListings } from '@/lib/marketplace';
import { SITE } from '@/lib/site';
import { COUNTRY } from '@/lib/country';
import { collectionListingLd } from '@/lib/schema';
import MarketplaceClient from '@/components/MarketplaceClient';
import MobileMarketplace from '@/components/MobileMarketplace';

export const dynamic = 'force-dynamic';

// Cache the SSR first page per op/query (a small, high-hit set) so repeat loads
// skip the count=exact — the page paints its initial listings near-instantly.
const getInitialPage = unstable_cache(
  async (op, q) => {
    const mobileOp = op === 'alquiler' ? 'alquiler' : 'venta';
    const [dRes, mRes] = await Promise.all([
      searchListings({ op, q, page: 1, pageSize: 24, sort: 'relevancia' }),
      searchListings({ op: mobileOp, q, page: 1, pageSize: 24, sort: 'relevancia' }),
    ]);
    return { dRes, mRes };
  },
  ['cl-initial-marketplace-v1'],
  { revalidate: 120, tags: ['listings'] },
);

// #17 Canonical consolidation — every filtered/sorted variant of the marketplace
// canonicalises to the clean /propiedades path.
export const metadata = { alternates: { canonical: '/propiedades' } };

export default async function PropiedadesPage({ searchParams }) {
  const initialOp = searchParams?.op === 'alquiler' ? 'alquiler' : searchParams?.op === 'venta' ? 'venta' : 'all';
  const initialQuery = typeof searchParams?.q === 'string' ? searchParams.q : '';
  // The marketplace fetches server-side (all ~25k). We SSR the FIRST page + pins
  // so the initial paint already has results — no client loading wait. Desktop
  // starts on `initialOp`; mobile's segmented always starts on venta/alquiler.
  // SSR only the first LIST page (cached, indexed) — the map pins load client-side
  // right after mount (cached endpoint), so the visible content is instant.
  const [{ dRes, mRes }, totalCount] = await Promise.all([
    getInitialPage(initialOp, initialQuery), getActiveCountCached(),
  ]);
  // SEO: a keyword H1 (sr-only, so the search-first UI is unchanged) + CollectionPage
  // /ItemList schema for the listings this page SSRs. Invisible to users; gives the
  // main marketplace page the structured data it was missing.
  const opLabel = initialOp === 'venta' ? 'en venta' : initialOp === 'alquiler' ? 'en alquiler' : 'en venta y alquiler';
  const h1 = `Propiedades ${opLabel} en ${COUNTRY.name}`;
  const ld = collectionListingLd({
    name: h1,
    description: `Casas, departamentos, dúplex, terrenos y locales ${opLabel} en ${COUNTRY.name}. Explorá ${Number(totalCount || 0).toLocaleString('es')} propiedades en el mapa con Casa Libre.`,
    url: `${SITE}/propiedades`,
    listings: dRes.listings,
    site: SITE,
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="sr-only">{h1} — Casa Libre</h1>
      {/* Mobile: the app-style listing UI. Desktop: the existing marketplace (unchanged). */}
      <div className="md:hidden">
        <MobileMarketplace initialListings={mRes.listings} initialCount={mRes.count} totalCount={totalCount} initialOp={initialOp} initialQuery={initialQuery} />
      </div>
      <div className="hidden md:block">
        <MarketplaceClient initialListings={dRes.listings} initialCount={dRes.count} totalCount={totalCount} initialOp={initialOp} initialQuery={initialQuery} />
      </div>
    </>
  );
}
