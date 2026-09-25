import { getLandingListings, getActiveCountCached, getFreeHomeIds } from '@/lib/listings';
import { orderHomeFeatured } from '@/lib/homeOrder';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import LandingClient from '@/components/LandingClient';
import MobileHome from '@/components/MobileHome';
import Footer from '@/components/Footer';
import { COUNTRY } from '@/lib/country';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const [{ listings }, activeCount, freeIds] = await Promise.all([getLandingListings(), getActiveCountCached(), getFreeHomeIds()]);
  // Paid "Landing" (US$20) listings OWN the home featured strip — nothing unpaid is
  // mixed in when any exist (unchanged). Only when there are ZERO paid listings do we
  // fall back to a RANDOM blend of BOTH sale and rental listings (not just the newest
  // sale ones from one agent), reshuffled every load so the home never looks static.
  const withImg = listings.filter((l) => l.image);
  const onHome = withImg.filter((l) => l.onHome);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const ventas = shuffle(withImg.filter((l) => l.mode === 'venta'));
  const alquileres = shuffle(withImg.filter((l) => l.mode === 'alquiler'));
  const blend = shuffle([...ventas.slice(0, 4), ...alquileres.slice(0, 3)]);
  const fallback = (blend.length >= 3 ? blend : shuffle(withImg)).slice(0, 6);
  // Paid first; free first-listing gifts (automation) only fill leftover slots, rotated hourly.
  const homeOrdered = orderHomeFeatured(onHome, new Set(freeIds), { slots: 6, seed: Math.floor(Date.now() / 3600000) });
  const featured = homeOrdered.length ? homeOrdered : fallback;
  const ticker = listings
    .filter((l) => l.usd)
    .slice(0, 8)
    .map((l) => `${(l.neighborhood || l.city || COUNTRY.name).toUpperCase()} — ${(typeLabel(l.type, 'es') || 'Propiedad').toUpperCase()} — ${fmtUsd(l.usd, 'es')}${l.mode === 'alquiler' ? '/mes' : ''}`);
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
