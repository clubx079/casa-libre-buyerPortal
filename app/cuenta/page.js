'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/lib/useLang';
import ListingCard from '@/components/account/ListingCard';
import { CardGridSkeleton, StatSkeleton } from '@/components/account/Skeletons';

const T = {
  es: {
    hi: (n) => `Hola${n ? `, ${n}` : ''}`, sub: 'Este es tu panel de Casa Libre.',
    saved: 'Guardadas', mine: 'Mis publicaciones', browse: 'Ver propiedades', publish: 'Publicar propiedad',
    recent: 'Guardadas recientes', seeAll: 'Ver todas →', empty: 'Todavía no guardaste ninguna propiedad.',
    quick: 'Acciones rápidas',
  },
  en: {
    hi: (n) => `Hi${n ? `, ${n}` : ''}`, sub: 'This is your Casa Libre dashboard.',
    saved: 'Saved', mine: 'My listings', browse: 'Browse listings', publish: 'List a property',
    recent: 'Recently saved', seeAll: 'See all →', empty: "You haven't saved any properties yet.",
    quick: 'Quick actions',
  },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [lang] = useLang();
  const t = T[lang];
  const [savedCount, setSavedCount] = useState(null);
  const [mineCount, setMineCount] = useState(null);
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    fetch('/api/favorites').then((r) => r.json()).then((j) => setSavedCount((j.ids || []).length)).catch(() => setSavedCount(0));
    fetch('/api/account/listings').then((r) => r.json()).then((j) => setMineCount((j.listings || []).length)).catch(() => setMineCount(0));
    fetch('/api/account/saved').then((r) => r.json()).then((j) => setRecent((j.listings || []).slice(0, 3))).catch(() => setRecent([]));
  }, []);

  const firstName = (user?.full_name || '').split(' ')[0] || '';
  const stat = (label, value, href) => (
    <Link href={href} className="flex-1 min-w-[150px] bg-card border border-ink/15 rounded-card p-5 hover:border-ink hover:-translate-y-0.5 transition-all">
      <div className="text-[32px] font-bold tracking-head leading-none min-h-[30px]">{value == null ? <StatSkeleton /> : value}</div>
      <div className="text-[13px] text-ink/55 font-medium mt-1.5">{label}</div>
    </Link>
  );

  return (
    <div>
      <h1 className="text-[clamp(28px,4vw,40px)] font-bold tracking-display leading-tight">{t.hi(firstName)} <span className="font-serif italic font-normal">👋</span></h1>
      <p className="text-[15px] text-ink/55 mt-1 mb-7">{t.sub}</p>

      <div className="flex flex-wrap gap-4 mb-8">
        {stat(t.saved, savedCount, '/cuenta/guardadas')}
        {stat(t.mine, mineCount, '/cuenta/publicaciones')}
      </div>

      <div className="mb-9">
        <div className="text-[13px] font-semibold text-ink/50 uppercase tracking-label mb-3">{t.quick}</div>
        <div className="flex flex-wrap gap-3">
          <Link href="/propiedades" className="px-5 py-3 rounded-pill border-[1.5px] border-ink font-semibold text-[14px]">{t.browse}</Link>
          <Link href="/publicar" className="px-5 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px] shadow-hard-soft">{t.publish}</Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-semibold text-ink/50 uppercase tracking-label">{t.recent}</div>
        {recent && recent.length > 0 && <Link href="/cuenta/guardadas" className="text-[13px] font-semibold">{t.seeAll}</Link>}
      </div>
      {recent === null
        ? <CardGridSkeleton n={3} />
        : recent.length === 0
          ? <div className="bg-card border border-ink/15 rounded-card p-8 text-center font-mono text-[12px] text-ink/45">{t.empty}</div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{recent.map((l) => <ListingCard key={l.id} l={l} />)}</div>}
    </div>
  );
}
