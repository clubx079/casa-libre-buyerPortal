import { getActiveCountCached } from '@/lib/listings';
import MarketplaceClient from '@/components/MarketplaceClient';
import MobileMarketplace from '@/components/MobileMarketplace';

export const dynamic = 'force-dynamic';

// #17 Canonical consolidation — every filtered/sorted variant of the marketplace
// (?op, ?q, ?ciudad, ?tipo, price bands) is the same "browse" intent, so they all
// canonicalise to the clean /propiedades path instead of fragmenting SEO.
export const metadata = {
  alternates: { canonical: '/propiedades' },
};

export default async function PropiedadesPage({ searchParams }) {
  // Load all active buildings (the DB has grown well past the old 400 cap) so the
  // count, filters and map reflect the full catalogue.
  // The marketplace now fetches listings/pins itself (server-side search over all
  // ~25k), so the page only needs the initial count + the filter seed.
  const totalCount = await getActiveCountCached();
  const initialOp = searchParams?.op === 'alquiler' ? 'alquiler' : searchParams?.op === 'venta' ? 'venta' : 'all';
  const initialQuery = typeof searchParams?.q === 'string' ? searchParams.q : '';
  return (
    <>
      {/* Mobile: the app-style listing UI. Desktop: the existing marketplace (unchanged). */}
      <div className="md:hidden">
        <MobileMarketplace totalCount={totalCount} initialOp={initialOp} initialQuery={initialQuery} />
      </div>
      <div className="hidden md:block">
        <MarketplaceClient totalCount={totalCount} initialOp={initialOp} initialQuery={initialQuery} />
      </div>
    </>
  );
}
