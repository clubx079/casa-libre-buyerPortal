import { getLandingListings, getActiveCountCached } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import LandingClient from '@/components/LandingClient';
import MobileHome from '@/components/MobileHome';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const [{ listings }, activeCount] = await Promise.all([getLandingListings(), getActiveCountCached()]);
  // Paid "Landing" (US$20) listings OWN the home featured strip — nothing unpaid is
  // mixed in when any exist. Only when there are zero paid listings do we fall back to
  // the most recent ones so the section is never empty.
  const withImg = listings.filter((l) => l.image);
  const onHome = withImg.filter((l) => l.onHome);
  const featured = onHome.length ? onHome.slice(0, 6) : withImg.slice(0, 3);
  const ticker = listings
    .filter((l) => l.usd)
    .slice(0, 8)
    .map((l) => `${(l.neighborhood || l.city || 'Paraguay').toUpperCase()} — ${(typeLabel(l.type, 'es') || 'Propiedad').toUpperCase()} — ${fmtUsd(l.usd, 'es')}${l.mode === 'alquiler' ? '/mes' : ''}`);
  const count = activeCount || listings.length;
  return (
    <>
      {/* Mobile: the app-style home. Desktop: the existing landing (unchanged). */}
      <div className="md:hidden">
        <MobileHome featured={featured} count={count} tickerData={ticker} />
      </div>
      <div className="hidden md:block">
        <LandingClient featured={featured} count={count} tickerData={ticker} />
      </div>
      <Footer />
    </>
  );
}
