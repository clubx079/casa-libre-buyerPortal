import { unstable_cache } from 'next/cache';
import { getActiveCountCached } from '@/lib/listings';
import { searchListings } from '@/lib/marketplace';
import { placeById } from '@/lib/placeIndex';
import { searchBounds } from '@/lib/areaGeom';
import { roundArea } from '@/lib/mapArea';
import { withSellerPhotosPage } from '@/lib/sellerPhotos';
import { SITE } from '@/lib/site';
import { COUNTRY } from '@/lib/country';
import { zoningEnabled } from '@/lib/zoning/categories';
import { collectionListingLd } from '@/lib/schema';
import MarketplaceClient from '@/components/MarketplaceClient';
import MobileMarketplace from '@/components/MobileMarketplace';

export const dynamic = 'force-dynamic';

// Cache the SSR first page per op/query (a small, high-hit set) so repeat loads
// skip the count=exact — the page paints its initial listings near-instantly.
const getInitialPage = unstable_cache(
  async (op, q, type, place, box) => {
    const mobileOp = op === 'alquiler' ? 'alquiler' : 'venta';
    const a = box || {};
    const [dRes, mRes] = await Promise.all([
      searchListings({ op, q, type, place, ...a, page: 1, pageSize: 24, sort: 'relevancia' }),
      searchListings({ op: mobileOp, q, type, place, ...a, page: 1, pageSize: 24, sort: 'relevancia' }),
    ]);
    return { dRes, mRes };
  },
  ['cl-initial-marketplace-v4'],
  { revalidate: 120, tags: ['listings'] },
);

// #17 Canonical consolidation — every filtered/sorted variant of the marketplace
// canonicalises to the clean /propiedades path.
export const metadata = { alternates: { canonical: '/propiedades' } };

export default async function PropiedadesPage({ searchParams }) {
  const initialOp = searchParams?.op === 'alquiler' ? 'alquiler' : searchParams?.op === 'venta' ? 'venta' : 'all';
  const initialQuery = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const initialType = typeof searchParams?.type === 'string' ? searchParams.type : 'all';
  // ?place= = a barrio / city / departamento picked from the search suggestions (lib/places.js ids).
  const initialPlace = typeof searchParams?.place === 'string' && /^[bcd]:/.test(searchParams.place) ? searchParams.place.slice(0, 200) : '';
  // A picked place opens on its own box: the first page is already "this place, on the map"
  // (the client starts with the same area and flies the map there) — no wider list first.
  let initialArea = null;
  if (initialPlace) {
    try {
      // the same box the search box uses for a pick (lib/placeIndex.js compactIndex → searchBounds)
      const pl = await placeById(initialPlace);
      const b = pl?.pts?.length ? searchBounds(pl.pts, pl.kind) : null;
      if (b) initialArea = roundArea({ n: b.n + 0.002, s: b.s - 0.002, e: b.e + 0.002, w: b.w - 0.002 });
    } catch { /* no box → the place's whole list, as before */ }
  }
  // The marketplace fetches server-side (all ~25k). We SSR the FIRST page + pins
  // so the initial paint already has results — no client loading wait. Desktop
  // starts on `initialOp`; mobile's segmented always starts on venta/alquiler.
  // SSR only the first LIST page (cached, indexed) — the map pins load client-side
  // right after mount (cached endpoint), so the visible content is instant.
  const [{ dRes: dCached, mRes: mCached }, totalCount] = await Promise.all([
    // ?type= (SEO pages link here) filters the first page too, not just the pins.
    getInitialPage(initialOp, initialQuery, initialType === 'all' ? undefined : initialType, initialPlace || undefined, initialArea || undefined), getActiveCountCached(),
  ]);
  // Sellers' approved profile photos, attached after the cache (lib/sellerPhotos.js).
  const [dRes, mRes] = await Promise.all([withSellerPhotosPage(dCached), withSellerPhotosPage(mCached)]);
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
  const zoningOn = zoningEnabled();   // Asunción zoning filter + map layer (after migration 007)
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="sr-only">{h1} — Casa Libre</h1>
      {/* Mobile: the app-style listing UI. Desktop: the existing marketplace (unchanged). */}
      <div className="md:hidden">
        <MobileMarketplace initialListings={mRes.listings} initialCount={mRes.count} totalCount={totalCount} initialOp={initialOp} initialQuery={initialQuery} initialType={initialType} initialPlace={initialPlace} initialArea={initialArea} zoningOn={zoningOn} />
      </div>
      <div className="hidden md:block">
        <MarketplaceClient initialListings={dRes.listings} initialCount={dRes.count} totalCount={totalCount} initialOp={initialOp} initialQuery={initialQuery} initialType={initialType} initialPlace={initialPlace} initialArea={initialArea} zoningOn={zoningOn} />
      </div>
    </>
  );
}
