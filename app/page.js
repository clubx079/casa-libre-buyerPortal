import { getLandingListings, getActiveCountCached } from '@/lib/listings';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import LandingClient from '@/components/LandingClient';
import MobileHome from '@/components/MobileHome';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const [{ listings }, activeCount] = await Promise.all([getLandingListings(), getActiveCountCached()]);
  // Home ("Feature on landing page", US$20) listings own the featured slots. If there
  // are fewer than 3, top up with the newest listings so the section still looks full;
  // cap at 6 so a burst of paid listings doesn't overrun the hero.
  const withImg = listings.filter((l) => l.image);
  const onHome = withImg.filter((l) => l.onHome);
  const rest = withImg.filter((l) => !l.onHome);
  const featured = [...onHome, ...rest].slice(0, Math.min(6, Math.max(3, onHome.length)));
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
