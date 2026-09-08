'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import ListingCard from '@/components/account/ListingCard';
import ConfirmModal from '@/components/ConfirmModal';
import HighlightModal from '@/components/HighlightModal';
import { CardGridSkeleton } from '@/components/account/Skeletons';

const T = {
  es: { title: 'Mis publicaciones', sub: (n) => `${n} ${n === 1 ? 'propiedad publicada' : 'propiedades publicadas'}`, empty: 'Todavía no publicaste ninguna propiedad.', publish: 'Publicar propiedad', del: 'Eliminar', confirmT: 'Eliminar publicación', confirm: 'Esta acción no se puede deshacer. ¿Querés eliminar esta propiedad?', cancel: 'Cancelar', deleting: 'Eliminando…', view: 'Ver', loading: 'Cargando…', highlight: 'Destacar · US$5', highlighted: 'Destacada', daysLeft: (n) => `faltan ${n} ${n === 1 ? 'día' : 'días'}` },
  en: { title: 'My listings', sub: (n) => `${n} published ${n === 1 ? 'property' : 'properties'}`, empty: "You haven't published any properties yet.", publish: 'List a property', del: 'Delete', confirmT: 'Delete listing', confirm: "This can't be undone. Delete this property?", cancel: 'Cancel', deleting: 'Deleting…', view: 'View', loading: 'Loading…', highlight: 'Feature · US$5', highlighted: 'Featured', daysLeft: (n) => `${n} ${n === 1 ? 'day' : 'days'} left` },
};

const daysLeft = (iso) => { try { return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)); } catch { return 0; } };

export default function MyListingsPage() {
  const [lang] = useLang();
  const t = T[lang];
  const [listings, setListings] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hiId, setHiId] = useState(null);

  useEffect(() => {
    fetch('/api/account/listings').then((r) => r.json()).then((j) => setListings(j.listings || [])).catch(() => setListings([]));
  }, []);

  const del = async () => {
    const id = confirmId;
    if (!id) return;
    setBusy(true);
    try {
      const r = await fetch('/api/account/listings', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (r.ok) setListings((ls) => ls.filter((l) => l.id !== id));
    } finally { setBusy(false); setConfirmId(null); }
  };

  const hi = listings && hiId ? listings.find((l) => l.id === hiId) : null;
  const hiLabel = hi ? [hi.type, hi.neighborhood, hi.city].filter(Boolean).join(' · ') : '';

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-display leading-tight">{t.title}</h1>
          <p className="text-[14px] text-ink/55 mt-1">{t.sub(listings?.length ?? 0)}</p>
        </div>
        <Link href="/publicar" className="shrink-0 px-5 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px] shadow-hard-soft">{t.publish}</Link>
      </div>

      {listings === null && <CardGridSkeleton n={3} />}
      {listings !== null && listings.length === 0 && (
        <div className="bg-card border border-ink/15 rounded-card p-10 text-center">
          <div className="font-mono text-[12px] text-ink/45 mb-4">{t.empty}</div>
          <Link href="/publicar" className="inline-block px-6 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px]">{t.publish}</Link>
        </div>
      )}
      {listings && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => (
            <ListingCard key={l.id} l={l} action={
              <div className="flex flex-col gap-2">
                {l.highlighted
                  ? <div className="text-center py-2 rounded-pill bg-card text-ink text-[12px] font-bold border-[1.5px] border-ink">{t.highlighted}{l.highlighted_until ? ` · ${t.daysLeft(daysLeft(l.highlighted_until))}` : ''}</div>
                  : <button onClick={() => setHiId(l.id)} disabled={!!(l.admin_status && l.admin_status !== 'active')} className="w-full py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed">{t.highlight}</button>}
                <div className="flex gap-2">
                  <Link href={`/propiedad/${l.id}`} className="flex-1 text-center py-2 rounded-pill border-[1.5px] border-ink text-[13px] font-semibold">{t.view}</Link>
                  <button onClick={() => setConfirmId(l.id)} className="flex-1 py-2 rounded-pill border-[1.5px] border-red-300 text-red-700 text-[13px] font-semibold">{t.del}</button>
                </div>
              </div>
            } />
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmId}
        title={t.confirmT}
        message={t.confirm}
        confirmLabel={busy ? t.deleting : t.del}
        cancelLabel={t.cancel}
        danger
        busy={busy}
        onConfirm={del}
        onCancel={() => setConfirmId(null)}
      />

      {hiId && (
        <HighlightModal
          propertyId={hiId}
          propertyLabel={hiLabel}
          onClose={() => setHiId(null)}
          onSuccess={(until) => { setListings((ls) => ls.map((x) => (x.id === hiId ? { ...x, highlighted: true, highlighted_until: until } : x))); setHiId(null); }}
        />
      )}
    </div>
  );
}
