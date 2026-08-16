'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useFavorites } from '@/components/FavoritesProvider';
import ListingCard from '@/components/account/ListingCard';
import SaveButton from '@/components/SaveButton';
import { CardGridSkeleton } from '@/components/account/Skeletons';

const T = {
  es: { title: 'Guardadas', sub: (n) => `${n} ${n === 1 ? 'propiedad guardada' : 'propiedades guardadas'}`, empty: 'Todavía no guardaste ninguna propiedad.', browse: 'Ver propiedades', loading: 'Cargando…' },
  en: { title: 'Saved', sub: (n) => `${n} saved ${n === 1 ? 'property' : 'properties'}`, empty: "You haven't saved any properties yet.", browse: 'Browse listings', loading: 'Loading…' },
};

export default function SavedPage() {
  const [lang] = useLang();
  const t = T[lang];
  const { ids } = useFavorites();
  const [listings, setListings] = useState(null);

  // Re-fetch whenever the saved set changes (e.g. user unsaves from this page).
  useEffect(() => {
    fetch('/api/account/saved').then((r) => r.json()).then((j) => setListings(j.listings || [])).catch(() => setListings([]));
  }, [ids.size]);

  return (
    <div>
      <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-display leading-tight">{t.title}</h1>
      <p className="text-[14px] text-ink/55 mt-1 mb-7">{t.sub(listings?.length ?? ids.size)}</p>

      {listings === null && <CardGridSkeleton n={6} />}
      {listings !== null && listings.length === 0 && (
        <div className="bg-card border border-ink/15 rounded-card p-10 text-center">
          <div className="font-mono text-[12px] text-ink/45 mb-4">{t.empty}</div>
          <Link href="/propiedades" className="inline-block px-6 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px]">{t.browse}</Link>
        </div>
      )}
      {listings && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => <ListingCard key={l.id} l={l} action={<SaveButton id={l.id} variant="detail" className="!py-2 !px-4 w-full justify-center" />} />)}
        </div>
      )}
    </div>
  );
}
