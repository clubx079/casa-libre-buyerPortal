import { getListings } from '@/lib/listings';
import MarketplaceClient from '@/components/MarketplaceClient';

export const dynamic = 'force-dynamic';

export default async function PropiedadesPage({ searchParams }) {
  // Load all active buildings (the DB has grown well past the old 400 cap) so the
  // count, filters and map reflect the full catalogue.
  const { listings } = await getListings({ limit: 5000 });
  const initialOp = searchParams?.op === 'alquiler' ? 'alquiler' : searchParams?.op === 'venta' ? 'venta' : 'all';
  const initialQuery = typeof searchParams?.q === 'string' ? searchParams.q : '';
  return <MarketplaceClient listings={listings} initialOp={initialOp} initialQuery={initialQuery} />;
}
