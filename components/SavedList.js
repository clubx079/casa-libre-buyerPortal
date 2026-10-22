'use client';
// The saved listings grid — ONE list, shown on /cuenta/guardadas (signed in) and on the
// public /guardadas (not signed in: this browser's saves). Data: /api/account/saved, which
// moves a browser's guest saves into the account once they sign in.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useFavorites } from '@/components/FavoritesProvider';
import ListingCard from '@/components/account/ListingCard';
import SaveButton from '@/components/SaveButton';
import { CardGridSkeleton } from '@/components/account/Skeletons';

const T = {
  es: { title: 'Guardadas', sub: (n) => `${n} ${n === 1 ? 'propiedad guardada' : 'propiedades guardadas'}`, empty: 'Todavía no guardaste ninguna propiedad. Tocá el ♥ en las que te gusten y te esperan acá.', browse: 'Ver propiedades' },
  en: { title: 'Saved', sub: (n) => `${n} saved ${n === 1 ? 'property' : 'properties'}`, empty: "You haven't saved any properties yet. Tap the ♥ on the ones you like and they'll wait for you here.", browse: 'Browse listings' },
};

export default function SavedList({ banner = null }) {
  const [lang] = useLang();
  const t = T[lang] || T.es;
  const { ids } = useFavorites();
  const [listings, setListings] = useState(null);

  // Re-fetch whenever the saved set changes (e.g. unsaved from this page).
  useEffect(() => {
    fetch('/api/account/saved', { cache: 'no-store' }).then((r) => r.json()).then((j) => setListings(j.listings || [])).catch(() => setListings([]));
  }, [ids.size]);

  return (
    <div>
      <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-display leading-tight">{t.title}</h1>
      <p className="text-[14px] text-ink/55 mt-1 mb-6">{t.sub(listings?.length ?? ids.size)}</p>
      {banner}

      {listings === null && <CardGridSkeleton n={6} />}
      {listings !== null && listings.length === 0 && (
        <div className="bg-card border border-ink/15 rounded-card p-10 text-center">
          <p className="text-[14px] text-ink/60 mb-5 max-w-[46ch] mx-auto">{t.empty}</p>
          <Link href="/propiedades" className="inline-block px-6 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px]">{t.browse}</Link>
        </div>
      )}
      {listings && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="saved-list">
          {listings.map((l) => <ListingCard key={l.id} l={l} action={<SaveButton id={l.id} mode={l.mode} variant="detail" className="!py-2 !px-4 w-full justify-center" />} />)}
        </div>
      )}
    </div>
  );
}
