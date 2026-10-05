import { getLandingListings, getActiveCountCached, getFreeHomeIds, getPromotedListings } from '@/lib/listings';
import { fillHomeFeatured } from '@/lib/homeOrder';
import { typeLabel } from '@/lib/propertyType';
import { fmtUsd } from '@/lib/ui';
import LandingClient from '@/components/LandingClient';
import MobileHome from '@/components/MobileHome';
import Footer from '@/components/Footer';
import { COUNTRY } from '@/lib/country';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const [{ listings }, activeCount, freeIds, promotedRes] = await Promise.all([getLandingListings(), getActiveCountCached(), getFreeHomeIds(), getPromotedListings().catch(() => ({ listings: [] }))]);
  // Featured strip: always 6 cards. Paid "Landing" (US$20) listings first, then free
  // first-listing gifts, then the other Verified listings (rotated hourly), and only
  // if room is left, regular listings — a random blend of sale and rental, reshuffled
  // every load so the home never looks static.
  const withImg = listings.filter((l) => l.image);
  const promoted = new Map();
  for (const l of [...(promotedRes?.listings || []), ...withImg]) if (l.image && l.verified && !promoted.has(String(l.id))) promoted.set(String(l.id), l);
  const onHome = [...promoted.values()].filter((l) => l.onHome);
  const verifiedOnly = [...promoted.values()].filter((l) => !l.onHome);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const ventas = shuffle(withImg.filter((l) => l.mode === 'venta'));
  const alquileres = shuffle(withImg.filter((l) => l.mode === 'alquiler'));
  const blend = shuffle([...ventas.slice(0, 4), ...alquileres.slice(0, 3)]);
  const others = [...blend, ...shuffle(withImg)].filter((l) => !promoted.has(String(l.id)));
  const featured = fillHomeFeatured({ onHome, freeIds: new Set(freeIds), verified: verifiedOnly, others, slots: 6, seed: Math.floor(Date.now() / 3600000) });
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
