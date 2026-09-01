import { unstable_cache } from 'next/cache';
import { getActiveCountCached } from '@/lib/listings';
import { searchListings } from '@/lib/marketplace';
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
  { revalidate: 120 },
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
  return (
    <>
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
