'use client';
import { typeLabel } from '@/lib/propertyTypeOptions';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import ListingCard from '@/components/account/ListingCard';
import ConfirmModal from '@/components/ConfirmModal';
import HighlightModal from '@/components/HighlightModal';
import { CardGridSkeleton } from '@/components/account/Skeletons';
import { useSellFlow } from '@/components/SellFlow';
import { draftMissing } from '@/lib/drafts';

const T = {
  es: { title: 'Mis publicaciones', sub: (n) => `${n} ${n === 1 ? 'propiedad publicada' : 'propiedades publicadas'}`, empty: 'Todavía no publicaste ninguna propiedad.', publish: 'Publicar propiedad', del: 'Eliminar', confirmT: 'Eliminar publicación', confirm: 'Esta acción no se puede deshacer. ¿Querés eliminar esta propiedad?', cancel: 'Cancelar', deleting: 'Eliminando…', view: 'Ver', loading: 'Cargando…', promoteVerify: 'Verificar · US$5', promoteHome: 'Portada · US$20', renew: 'Renovar', verifiedChip: 'Verificada', homeChip: 'En portada', upgradeHome: 'Subir a portada · US$20', paying: 'Procesando…', daysLeft: (n) => `faltan ${n} ${n === 1 ? 'día' : 'días'}` },
  en: { title: 'My listings', sub: (n) => `${n} published ${n === 1 ? 'property' : 'properties'}`, empty: "You haven't published any properties yet.", publish: 'List a property', del: 'Delete', confirmT: 'Delete listing', confirm: "This can't be undone. Delete this property?", cancel: 'Cancel', deleting: 'Deleting…', view: 'View', loading: 'Loading…', promoteVerify: 'Verify · US$5', promoteHome: 'Landing · US$20', renew: 'Renew', verifiedChip: 'Verified', homeChip: 'On landing', upgradeHome: 'Move to Landing · US$20', paying: 'Processing…', daysLeft: (n) => `${n} ${n === 1 ? 'day' : 'days'} left` },
};

const daysLeft = (iso) => { try { return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)); } catch { return 0; } };

const D = {
  es: {
    tabActive: 'Publicadas', tabDrafts: 'Borradores', draftChip: 'Borrador', cont: 'Continuar', del: 'Eliminar',
    emptyDrafts: 'No tenés borradores. Si empezás a publicar y no terminás, lo guardamos acá.',
    saved: (s) => `Guardado ${s}`, missing: 'Falta', miss: { price: 'precio', area: 'superficie', phone: 'teléfono', photos: 'fotos' },
    confirmT: 'Eliminar borrador', confirm: '¿Querés eliminar este borrador?',
    types: { casa: 'Casa', departamento: 'Departamento', duplex: 'Dúplex', terreno: 'Terreno' }, sale: 'Venta', rent: 'Alquiler', property: 'Propiedad',
  },
  en: {
    tabActive: 'Published', tabDrafts: 'Drafts', draftChip: 'Draft', cont: 'Continue', del: 'Delete',
    emptyDrafts: "No drafts. If you start a listing and don't finish, we keep it here.",
    saved: (s) => `Saved ${s}`, missing: 'Missing', miss: { price: 'price', area: 'area', phone: 'phone', photos: 'photos' },
    confirmT: 'Delete draft', confirm: 'Delete this draft?',
    types: { casa: 'House', departamento: 'Apartment', duplex: 'Duplex', terreno: 'Lot' }, sale: 'Sale', rent: 'Rent', property: 'Property',
  },
};

function ago(iso, lang) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const es = lang !== 'en';
  if (m < 1) return es ? 'recién' : 'just now';
  if (m < 60) return es ? `hace ${m} min` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return es ? `hace ${h} h` : `${h} h ago`;
  const d = Math.round(h / 24);
  return es ? `hace ${d} ${d === 1 ? 'día' : 'días'}` : `${d} ${d === 1 ? 'day' : 'days'} ago`;
}

function DraftCard({ d, lang, onContinue, onDelete }) {
  const x = D[lang] || D.es;
  const data = d.data || {};
  const title = `${typeLabel(data.ptype, lang) || x.property}${data.neighborhood ? ` · ${data.neighborhood}` : ''}`;
  const miss = draftMissing(data).map((k) => x.miss[k]);
  return (
    <div className="bg-card rounded-[18px] border border-dashed border-ink/35 p-4 flex flex-col gap-3" data-testid="draft-card">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold bg-paper border border-ink/25 px-2.5 py-1 rounded-pill">{x.draftChip}</span>
        {data.mode && <span className="text-[10px] font-semibold bg-ink text-paper px-2.5 py-1 rounded-pill">{data.mode === 'alquiler' ? x.rent : x.sale}</span>}
        <span className="ml-auto font-mono text-[11px] text-ink/45">{x.saved(ago(d.updated_at, lang))}</span>
      </div>
      <div className="flex gap-3">
        {Array.isArray(data.photos) && data.photos[0]?.url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={data.photos[0].url} alt="" className="w-16 h-16 rounded-[10px] object-cover border border-ink/10 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-[16px] font-bold tracking-head line-clamp-1">{title}</div>
          <div className="text-[12.5px] text-ink/55 line-clamp-1">{[data.addressText, data.city].filter(Boolean).join(' · ')}</div>
          {miss.length > 0 && <div className="text-[12px] text-ink/60 mt-1.5">{x.missing}: {miss.join(', ')}</div>}
        </div>
      </div>
      <div className="flex gap-2 mt-auto">
        <button onClick={onContinue} className="flex-[2] py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90">{x.cont}</button>
        <button onClick={onDelete} className="flex-1 py-2 rounded-pill border-[1.5px] border-red-300 text-red-700 text-[13px] font-semibold">{x.del}</button>
      </div>
    </div>
  );
}

export default function MyListingsPage() {
  const [lang] = useLang();
  const t = T[lang];
  const x = D[lang] || D.es;
  const { openSell } = useSellFlow();
  const [tab, setTab] = useState('active');           // 'active' | 'drafts'
  const [drafts, setDrafts] = useState(null);
  const [confirmDraft, setConfirmDraft] = useState(null);
  const [listings, setListings] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [promo, setPromo] = useState(null);     // { id, plan } — open the payment modal (no card / 3DS)
  const [payingId, setPayingId] = useState(null); // id being charged silently on a saved card
  const [autoPay, setAutoPay] = useState(false);  // one-shot: honor a ?pay=&plan= deep link once

  const load = () => {
    fetch('/api/account/listings').then((r) => r.json()).then((j) => setListings(j.listings || [])).catch(() => setListings([]));
    fetch('/api/drafts').then((r) => r.json()).then((j) => setDrafts(j.drafts || [])).catch(() => setDrafts([]));
  };
  useEffect(() => {
    load();
    try { if (new URLSearchParams(window.location.search).get('tab') === 'borradores') setTab('drafts'); } catch {}
    // The sell wizard publishes / starts drafts in place — refresh both tabs when it does.
    window.addEventListener('cl:listings-changed', load);
    return () => window.removeEventListener('cl:listings-changed', load);
  }, []);

  // Deep link from the mobile app's "Continuar": /cuenta/publicaciones?tab=borradores&draft=<id>
  // → open that draft in the sell wizard as soon as the drafts have loaded (once).
  const draftOpened = useRef(false);
  useEffect(() => {
    if (draftOpened.current || !drafts) return;
    let id = null;
    try { id = new URLSearchParams(window.location.search).get('draft'); } catch {}
    const d = id && drafts.find((x) => x.id === id);
    if (!d) return;
    draftOpened.current = true;
    openSell({ draft: d });
  }, [drafts, openSell]);

  const delDraft = async () => {
    const id = confirmDraft;
    if (!id) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
      if (r.ok) setDrafts((ds) => ds.filter((d) => d.id !== id));
    } finally { setBusy(false); setConfirmDraft(null); }
  };

  // Charge a saved card silently (renew / promote / upgrade) — NO modal flash. Only
  // open the modal when there's no saved card, or a 3DS/decline needs finishing.
  const payFor = async (id, pl) => {
    setPayingId(id);
    let hasCard = false;
    try { const pr = await fetch('/api/account/payments'); const pj = await pr.json(); hasCard = !!(pj?.card?.last4); } catch {}
    if (!hasCard) { setPayingId(null); setPromo({ id, plan: pl }); return; }
    try {
      const r = await fetch('/api/highlight/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: id, plan: pl, useSavedCard: true }) });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'succeeded') {
        setListings((ls) => ls.map((x) => (x.id === id ? { ...x, verified: true, highlighted: true, plan: pl, onHome: pl === 'home', promotion_expires_at: j.promotionUntil } : x)));
        setPayingId(null); return;
      }
      setPayingId(null); setPromo({ id, plan: pl });
    } catch { setPayingId(null); setPromo({ id, plan: pl }); }
  };

  // Deep link from the mobile app after a free publish:
  // /cuenta/publicaciones?pay=<id>&plan=<verified|home> → jump straight to the
  // Stripe payment for that listing + plan as soon as the listings load.
  useEffect(() => {
    if (autoPay || !listings) return;
    let id, pl;
    try { const sp = new URLSearchParams(window.location.search); id = sp.get('pay'); pl = sp.get('plan'); } catch {}
    if (id && (pl === 'verified' || pl === 'home')) { setAutoPay(true); payFor(id, pl); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, autoPay]);

  const del = async () => {
    const id = confirmId;
    if (!id) return;
    setBusy(true);
    try {
      const r = await fetch('/api/account/listings', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (r.ok) setListings((ls) => ls.filter((l) => l.id !== id));
    } finally { setBusy(false); setConfirmId(null); }
  };

  const hi = listings && promo ? listings.find((l) => l.id === promo.id) : null;
  const hiLabel = hi ? [hi.type, hi.neighborhood, hi.city].filter(Boolean).join(' · ') : '';

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-display leading-tight">{t.title}</h1>
          <p className="text-[14px] text-ink/55 mt-1">{t.sub(listings?.length ?? 0)}</p>
        </div>
        {listings && listings.length > 0 && (
          <Link href="/publicar" className="shrink-0 px-5 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px] shadow-hard-soft">{t.publish}</Link>
        )}
      </div>

      {/* Tabs: published listings / unfinished drafts */}
      <div role="tablist" className="inline-flex items-center border-[1.5px] border-ink rounded-pill p-[3px] bg-card mb-6">
        {[['active', x.tabActive, listings?.length], ['drafts', x.tabDrafts, drafts?.length]].map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-pill text-[13.5px] font-semibold inline-flex items-center gap-2 ${tab === k ? 'bg-ink text-paper' : 'text-ink/60'}`}>
            {label}
            {n != null && <span className={`min-w-[20px] h-5 px-1.5 rounded-pill text-[11px] font-bold inline-flex items-center justify-center ${tab === k ? 'bg-paper text-ink' : 'bg-ink/10 text-ink/70'}`}>{n}</span>}
          </button>
        ))}
      </div>

      {tab === 'drafts' && (
        drafts === null ? <CardGridSkeleton n={2} /> : drafts.length === 0 ? (
          <div className="bg-card border border-ink/15 rounded-card p-10 text-center font-mono text-[12px] text-ink/45">{x.emptyDrafts}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drafts.map((d) => (
              <DraftCard key={d.id} d={d} lang={lang} onContinue={() => openSell({ draft: d })} onDelete={() => setConfirmDraft(d.id)} />
            ))}
          </div>
        )
      )}

      {tab === 'active' && listings === null && <CardGridSkeleton n={3} />}
      {tab === 'active' && listings !== null && listings.length === 0 && (
        <div className="bg-card border border-ink/15 rounded-card p-10 text-center">
          <div className="font-mono text-[12px] text-ink/45 mb-4">{t.empty}</div>
          <Link href="/publicar" className="inline-block px-6 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px]">{t.publish}</Link>
        </div>
      )}
      {tab === 'active' && listings && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => (
            <ListingCard key={l.id} l={l} action={
              <div className="flex flex-col gap-2">
                {payingId === l.id ? (
                  <div className="text-center py-2 rounded-pill bg-card text-ink text-[12.5px] font-bold border-[1.5px] border-ink">{t.paying}</div>
                ) : l.verified ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-center py-2 rounded-pill bg-card text-ink text-[12px] font-bold border-[1.5px] border-ink">{(l.plan === 'home' ? t.homeChip : t.verifiedChip)}{l.promotion_expires_at ? ` · ${t.daysLeft(daysLeft(l.promotion_expires_at))}` : ''}</div>
                      <button onClick={() => payFor(l.id, l.plan || 'verified')} className="shrink-0 px-4 py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90">{t.renew}</button>
                    </div>
                    {l.plan !== 'home' && (
                      <button onClick={() => payFor(l.id, 'home')} className="w-full py-2 rounded-pill border-[1.5px] border-ink text-[12.5px] font-bold hover:bg-ink hover:text-paper transition-colors">{t.upgradeHome}</button>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => payFor(l.id, 'verified')} disabled={!!(l.admin_status && l.admin_status !== 'active')} className="py-2 rounded-pill border-[1.5px] border-ink text-[12.5px] font-bold hover:bg-ink hover:text-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed">{t.promoteVerify}</button>
                    <button onClick={() => payFor(l.id, 'home')} disabled={!!(l.admin_status && l.admin_status !== 'active')} className="py-2 rounded-pill bg-ink text-paper text-[12.5px] font-bold hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed">{t.promoteHome}</button>
                  </div>
                )}
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
      <ConfirmModal
        open={!!confirmDraft}
        title={x.confirmT}
        message={x.confirm}
        confirmLabel={busy ? t.deleting : x.del}
        cancelLabel={t.cancel}
        danger
        busy={busy}
        onConfirm={delDraft}
        onCancel={() => setConfirmDraft(null)}
      />

      {promo && (
        <HighlightModal
          propertyId={promo.id}
          plan={promo.plan}
          lang={lang}
          propertyLabel={hiLabel}
          onClose={() => setPromo(null)}
          onSuccess={(until) => { setListings((ls) => ls.map((x) => (x.id === promo.id ? { ...x, verified: true, highlighted: true, plan: promo.plan, onHome: promo.plan === 'home', promotion_expires_at: until } : x))); setPromo(null); }}
        />
      )}
    </div>
  );
}
