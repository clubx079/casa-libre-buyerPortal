import { getListings } from '@/lib/listings';
import MarketplaceClient from '@/components/MarketplaceClient';

export const dynamic = 'force-dynamic';

export default async function PropiedadesPage({ searchParams }) {
  const { listings } = await getListings({ limit: 400 });
  const initialOp = searchParams?.op === 'alquiler' ? 'alquiler' : searchParams?.op === 'venta' ? 'venta' : 'all';
  return <MarketplaceClient listings={listings} initialOp={initialOp} />;
}
