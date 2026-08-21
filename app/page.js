import { getListings } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import LandingClient from '@/components/LandingClient';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const { listings, count, total } = await getListings({ limit: 120 });
  const featured = listings.filter((l) => l.image).slice(0, 3);
  const ticker = listings
    .filter((l) => l.usd)
    .slice(0, 8)
    .map((l) => `${(l.neighborhood || l.city || 'Paraguay').toUpperCase()} — ${(typeLabel(l.type, 'es') || 'Propiedad').toUpperCase()} — ${fmtUsd(l.usd, 'es')}${l.mode === 'alquiler' ? '/mes' : ''}`);
  return (
    <>
      <LandingClient featured={featured} count={total || count || listings.length} tickerData={ticker} />
      <Footer />
    </>
  );
}
