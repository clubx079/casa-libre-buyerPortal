'use client';
import { typeLabel } from '@/lib/propertyTypeOptions';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import ListingCard from '@/components/account/ListingCard';
import ConfirmModal from '@/components/ConfirmModal';
import HighlightModal from '@/components/HighlightModal';
import ListingPaymentModal from '@/components/ListingPaymentModal';
import FixPhotosModal from '@/components/account/FixPhotosModal';
import { CardGridSkeleton } from '@/components/account/Skeletons';
import { useSellFlow } from '@/components/SellFlow';
import { draftMissing } from '@/lib/drafts';
import { track } from '@/lib/analytics';

const T = {
  es: { title: 'Mis publicaciones', sub: (n) => `${n} ${n === 1 ? 'propiedad publicada' : 'propiedades publicadas'}`, empty: 'Todavía no publicaste ninguna propiedad.', publish: 'Publicar propiedad', del: 'Eliminar', confirmT: 'Eliminar publicación', confirm: 'Esta acción no se puede deshacer. ¿Querés eliminar esta propiedad?', cancel: 'Cancelar', deleting: 'Eliminando…', view: 'Ver', loading: 'Cargando…', promoteVerify: 'Verificar · US$5', promoteHome: 'Portada · US$20', renew: 'Renovar', verifiedChip: 'Verificada', homeChip: 'En portada', upgradeHome: 'Subir a portada · US$20', paying: 'Procesando…', daysLeft: (n) => `faltan ${n} ${n === 1 ? 'día' : 'días'}` },
  en: { title: 'My listings', sub: (n) => `${n} published ${n === 1 ? 'property' : 'properties'}`, empty: "You haven't published any properties yet.", publish: 'List a property', del: 'Delete', confirmT: 'Delete listing', confirm: "This can't be undone. Delete this property?", cancel: 'Cancel', deleting: 'Deleting…', view: 'View', loading: 'Loading…', promoteVerify: 'Verify · US$5', promoteHome: 'Landing · US$20', renew: 'Renew', verifiedChip: 'Verified', homeChip: 'On landing', upgradeHome: 'Move to Landing · US$20', paying: 'Processing…', daysLeft: (n) => `${n} ${n === 1 ? 'day' : 'days'} left` },
};

// The first-listing gift email's "Verificar mi publicación" button lands here
// (/api/gift/claim → ?gift=claimed&p=<id>, or ?gift=<reason> when it couldn't be granted).
const GIFT = {
  es: {
    claimedT: 'Publicación verificada',
    claimed: (d) => `Listo: tu propiedad ya está verificada y destacada en la portada de Casa Libre${d ? ` hasta el ${d}` : ''}, gratis. Así la ven más compradores.`,
    expired: 'Este regalo ya no está disponible: el enlace venció.',
    inactive: 'No pudimos activar el regalo porque la publicación no está activa en este momento.',
    invalid: 'El enlace no es válido para esta cuenta.',
    error: 'No pudimos activar el regalo. Probá de nuevo en un rato.',
    seeHome: 'Ver la portada', close: 'Cerrar',
  },
  en: {
    claimedT: 'Listing verified',
    claimed: (d) => `Done: your property is now verified and featured on the Casa Libre home page${d ? ` until ${d}` : ''}, for free. More buyers will see it.`,
    expired: 'This gift is no longer available: the link has expired.',
    inactive: "We couldn't activate the gift because the listing isn't live right now.",
    invalid: "This link isn't valid for this account.",
    error: "We couldn't activate the gift. Please try again later.",
    seeHome: 'See the home page', close: 'Close',
  },
};

// The "this listing is on us" gift for a listing waiting for payment (lib/automations/
// paymentFollowup.js): the email button → /api/listing-gift/claim → ?listing_gift=claimed&p=<id>,
// or the "Publicar gratis" button on the card.
const LGIFT = {
  es: {
    note: (d) => `Esta va por nuestra cuenta: publicala gratis${d ? ` hasta el ${d}` : ''}.`,
    btn: 'Publicar gratis', busy: 'Publicando…',
    claimedT: '¡Listo, va por nuestra cuenta!',
    claimed: 'Tu publicación se está publicando gratis: revisamos las fotos y queda visible en un momento.',
    expired: 'Este regalo ya venció. Podés pagarla para publicarla.',
    paid: 'Esta publicación ya está paga.',
    unavailable: 'Esta publicación ya no está esperando el pago.',
    invalid: 'El enlace no es válido para esta cuenta.',
    error: 'No pudimos publicarla. Probá de nuevo en un rato.',
    close: 'Cerrar',
  },
  en: {
    note: (d) => `This one is on us: publish it for free${d ? ` until ${d}` : ''}.`,
    btn: 'Publish for free', busy: 'Publishing…',
    claimedT: 'Done, this one is on us!',
    claimed: "Your listing is being published for free: we're checking the photos and it goes live in a moment.",
    expired: 'This gift has expired. You can pay to publish it.',
    paid: 'This listing is already paid.',
    unavailable: 'This listing is no longer waiting for payment.',
    invalid: "This link isn't valid for this account.",
    error: "We couldn't publish it. Please try again later.",
    close: 'Close',
  },
};

const daysLeft = (iso) => { try { return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)); } catch { return 0; } };

const D = {
  es: {
    tabActive: 'Publicadas', tabDrafts: 'Borradores', tabRejected: 'Rechazadas', draftChip: 'Borrador', cont: 'Continuar', del: 'Eliminar',
    emptyRejected: 'No tenés publicaciones rechazadas.',
    scanningNote: 'Estamos revisando las fotos. Se publica en un momento.',
    reviewNote: 'En revisión: puede ser una publicación repetida. Tiene los mismos datos y fotos que otra de tus propiedades, así que no la publicamos. Te enviamos un email.',
    pendingNote: 'Guardada, pero no está en el sitio: ya usaste tus publicaciones gratis del mes. Pagala para publicarla.', payPublish: 'Pagar y publicar',
    endedNote: (d) => `Terminó${d ? ` el ${d}` : ''} y ya no está en el sitio. Extendela para volver a publicarla.`, extend: 'Extender', paidChip: 'Publicación paga',
    rejectedNote: 'No la publicamos: algunas fotos pueden tener contenido para adultos (+18), dañino, ofensivo o sin relación con la propiedad. Cambialas y enviala de nuevo.',
    fix: 'Cambiar fotos', edit: 'Editar',
    emptyDrafts: 'No tenés borradores. Si empezás a publicar y no terminás, lo guardamos acá.',
    saved: (s) => `Guardado ${s}`, missing: 'Falta', miss: { price: 'precio', area: 'superficie', phone: 'teléfono', photos: 'fotos' },
    confirmT: 'Eliminar borrador', confirm: '¿Querés eliminar este borrador?',
    types: { casa: 'Casa', departamento: 'Departamento', duplex: 'Dúplex', terreno: 'Terreno' }, sale: 'Venta', rent: 'Alquiler', property: 'Propiedad',
  },
  en: {
    tabActive: 'Published', tabDrafts: 'Drafts', tabRejected: 'Rejected', draftChip: 'Draft', cont: 'Continue', del: 'Delete',
    emptyRejected: 'No rejected listings.',
    scanningNote: "We're checking the photos. It goes live in a moment.",
    reviewNote: "Under review: it might be a duplicate. It has the same details and photos as another of your listings, so we didn't publish it. We've emailed you.",
    pendingNote: "Saved, but not on the site: you've used this month's free listings. Pay to publish it.", payPublish: 'Pay and publish',
    endedNote: (d) => `It ended${d ? ` on ${d}` : ''} and is off the site. Extend it to bring it back.`, extend: 'Extend', paidChip: 'Paid listing',
    rejectedNote: "We didn't publish it: some photos may show 18+, harmful, abusive or unrelated content. Replace them and submit again.",
    fix: 'Fix photos', edit: 'Edit',
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
  const [tab, setTab] = useState('active');           // 'active' | 'rejected' | 'drafts'
  const [fix, setFix] = useState(null);               // { id, label } — the "Fix photos" window
  const [drafts, setDrafts] = useState(null);
  const [confirmDraft, setConfirmDraft] = useState(null);
  const [listings, setListings] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [promo, setPromo] = useState(null);     // { id, plan } — open the payment modal (no card / 3DS)
  const [payingId, setPayingId] = useState(null); // id being charged silently on a saved card
  const [autoPay, setAutoPay] = useState(false);  // one-shot: honor a ?pay=&plan= deep link once
  const [gift, setGift] = useState(null);         // { state, id } from the gift email's verify link
  const [lpay, setLpay] = useState(null);         // { id, kind: 'publish' | 'extend' } — the paid-listing pop-up
  const [lgift, setLgift] = useState(null);       // { state, id } — the "on us" gift result
  const [claimingId, setClaimingId] = useState(null);

  const load = () => {
    fetch('/api/account/listings').then((r) => r.json()).then((j) => setListings(j.listings || [])).catch(() => setListings([]));
    fetch('/api/drafts').then((r) => r.json()).then((j) => setDrafts(j.drafts || [])).catch(() => setDrafts([]));
  };
  useEffect(() => {
    load();
    try { const tb = new URLSearchParams(window.location.search).get('tab'); if (tb === 'borradores') setTab('drafts'); else if (tb === 'rechazadas') setTab('rejected'); } catch {}
    // The sell wizard publishes / starts drafts in place — refresh both tabs when it does.
    window.addEventListener('cl:listings-changed', load);
    return () => window.removeEventListener('cl:listings-changed', load);
  }, []);

  // While a listing's photos are being checked (lib/listingScan.js — usually seconds),
  // look again every 4 s, for up to ~3 minutes, so it moves to live / Rejected by itself.
  const polls = useRef(0);
  useEffect(() => {
    if (!listings || !listings.some((l) => l.scan === 'scanning') || polls.current >= 45) return undefined;
    const id = setTimeout(() => {
      polls.current += 1;
      fetch('/api/account/listings').then((r) => r.json()).then((j) => setListings(j.listings || [])).catch(() => {});
    }, 4000);
    return () => clearTimeout(id);
  }, [listings]);
  const published = (listings || []).filter((l) => l.scan !== 'rejected');
  const rejected = (listings || []).filter((l) => l.scan === 'rejected');

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
    // From the paid-listing emails: ?extend=<id> (extend 30 days) · ?pay_listing=<id> (pay to publish)
    let ext = null, pub = null;
    try { const sp = new URLSearchParams(window.location.search); ext = sp.get('extend'); pub = sp.get('pay_listing'); } catch {}
    if (ext && listings.some((l) => l.id === ext)) { setAutoPay(true); setLpay({ id: ext, kind: 'extend' }); }
    else if (pub && listings.some((l) => l.id === pub)) { setAutoPay(true); setLpay({ id: pub, kind: 'publish' }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, autoPay]);

  useEffect(() => {
    let state = null, id = null;
    try { const sp = new URLSearchParams(window.location.search); state = sp.get('gift'); id = sp.get('p'); } catch {}
    if (!state) return;
    setGift({ state, id });
    if (state === 'claimed') { setTab('active'); track('gift_claimed', { property_id: id }); }
    else track('gift_claim_failed', { reason: state });
    try { const u = new URL(window.location.href); u.searchParams.delete('gift'); u.searchParams.delete('p'); window.history.replaceState(null, '', u.toString()); } catch {}
  }, []);

  useEffect(() => {
    let state = null, id = null;
    try { const sp = new URLSearchParams(window.location.search); state = sp.get('listing_gift'); id = sp.get('p'); } catch {}
    if (!state) return;
    setLgift({ state, id });
    if (state === 'claimed') { setTab('active'); polls.current = 0; }
    track(state === 'claimed' ? 'listing_gift_claimed' : 'listing_gift_failed', { property_id: id, reason: state === 'claimed' ? undefined : state, via: 'email' });
    try { const u = new URL(window.location.href); u.searchParams.delete('listing_gift'); u.searchParams.delete('p'); window.history.replaceState(null, '', u.toString()); } catch {}
  }, []);

  const claimGift = async (id) => {
    setClaimingId(id);
    try {
      const r = await fetch('/api/listing-gift/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: id }) });
      const j = await r.json().catch(() => ({}));
      const state = j.ok ? 'claimed' : j.reason || 'error';
      setLgift({ state, id });
      track(j.ok ? 'listing_gift_claimed' : 'listing_gift_failed', { property_id: id, reason: j.ok ? undefined : state, via: 'my_listings' });
      polls.current = 0; load();
    } catch { setLgift({ state: 'error', id }); } finally { setClaimingId(null); }
  };

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
          <p className="text-[14px] text-ink/55 mt-1">{t.sub(published.length)}</p>
        </div>
        {listings && listings.length > 0 && (
          <Link href="/publicar" className="shrink-0 px-5 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px] shadow-hard-soft">{t.publish}</Link>
        )}
      </div>

      {gift && (() => {
        const g = GIFT[lang] || GIFT.es;
        const ok = gift.state === 'claimed';
        const l = ok && listings ? listings.find((x) => x.id === gift.id) : null;
        let until = '';
        try { if (l?.promotion_expires_at) until = new Date(l.promotion_expires_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PY', { day: 'numeric', month: 'long' }); } catch {}
        return (
          <div data-testid="gift-banner" className={`mb-6 rounded-card border-[1.5px] p-4 sm:p-5 flex items-start gap-3 ${ok ? 'border-ink bg-card shadow-hard-soft' : 'border-red-300 bg-red-50'}`}>
            {ok && <span aria-hidden className="shrink-0 w-9 h-9 rounded-full bg-ink text-paper inline-flex items-center justify-center text-[18px] font-bold">✓</span>}
            <div className="flex-1 min-w-0">
              {ok && <p className="font-bold text-[16px] leading-tight">{g.claimedT}</p>}
              <p className={`text-[14px] leading-snug ${ok ? 'text-ink/70 mt-1' : 'text-red-800'}`}>{ok ? g.claimed(until) : (g[gift.state] || g.error)}</p>
              {ok && <Link href="/" className="inline-block mt-3 px-4 py-2 rounded-pill bg-ink text-paper text-[13px] font-semibold">{g.seeHome}</Link>}
            </div>
            <button onClick={() => setGift(null)} aria-label={g.close} className="shrink-0 text-ink/40 hover:text-ink text-[20px] leading-none">×</button>
          </div>
        );
      })()}

      {lgift && (() => {
        const g = LGIFT[lang] || LGIFT.es;
        const ok = lgift.state === 'claimed';
        return (
          <div data-testid="listing-gift-banner" className={`mb-6 rounded-card border-[1.5px] p-4 sm:p-5 flex items-start gap-3 ${ok ? 'border-ink bg-card shadow-hard-soft' : 'border-red-300 bg-red-50'}`}>
            {ok && <span aria-hidden className="shrink-0 w-9 h-9 rounded-full bg-ink text-paper inline-flex items-center justify-center text-[18px] font-bold">✓</span>}
            <div className="flex-1 min-w-0">
              {ok && <p className="font-bold text-[16px] leading-tight">{g.claimedT}</p>}
              <p className={`text-[14px] leading-snug ${ok ? 'text-ink/70 mt-1' : 'text-red-800'}`}>{ok ? g.claimed : (g[lgift.state] || g.error)}</p>
            </div>
            <button onClick={() => setLgift(null)} aria-label={g.close} className="shrink-0 text-ink/40 hover:text-ink text-[20px] leading-none">×</button>
          </div>
        );
      })()}

      {/* Tabs: published listings (and ones being checked) / rejected / unfinished drafts */}
      <div role="tablist" className="inline-flex items-center border-[1.5px] border-ink rounded-pill p-[3px] bg-card mb-6">
        {[['active', x.tabActive, listings && published.length], ['rejected', x.tabRejected, listings && rejected.length], ['drafts', x.tabDrafts, drafts?.length]].map(([k, label, n]) => (
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
      {tab === 'rejected' && (
        listings === null ? <CardGridSkeleton n={2} /> : rejected.length === 0 ? (
          <div className="bg-card border border-ink/15 rounded-card p-10 text-center font-mono text-[12px] text-ink/45">{x.emptyRejected}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rejected.map((l) => (
              <ListingCard key={l.id} l={l} action={
                <div className="flex flex-col gap-2.5" data-testid="rejected-card">
                  <p className="text-[12.5px] leading-snug text-red-700">{x.rejectedNote}</p>
                  {l.rejectedPhotos?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {l.rejectedPhotos.slice(0, 6).map((ph) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img key={ph.url || ph.position} src={ph.url} alt="" className="w-11 h-11 rounded-[8px] object-cover ring-2 ring-red-500 opacity-70" />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setFix({ id: l.id, label: [l.type, l.neighborhood, l.city].filter(Boolean).join(' · ') })} className="flex-[2] py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90">{x.fix}</button>
                    <button onClick={() => openSell({ edit: l.id })} className="flex-1 py-2 rounded-pill border-[1.5px] border-ink text-[13px] font-semibold" data-testid="edit-listing">{x.edit}</button>
                    <button onClick={() => setConfirmId(l.id)} className="flex-1 py-2 rounded-pill border-[1.5px] border-red-300 text-red-700 text-[13px] font-semibold">{t.del}</button>
                  </div>
                </div>
              } />
            ))}
          </div>
        )
      )}

      {tab === 'active' && listings !== null && published.length === 0 && (
        <div className="bg-card border border-ink/15 rounded-card p-10 text-center">
          <div className="font-mono text-[12px] text-ink/45 mb-4">{t.empty}</div>
          <Link href="/publicar" className="inline-block px-6 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px]">{t.publish}</Link>
        </div>
      )}
      {tab === 'active' && listings && published.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {published.map((l) => (
            <ListingCard key={l.id} l={l} action={l.review ? (
              <div className="flex flex-col gap-2.5" data-testid="review-card">
                <p className="text-[12.5px] leading-snug text-ink/70">{x.reviewNote}</p>
                <button onClick={() => setConfirmId(l.id)} className="py-2 rounded-pill border-[1.5px] border-red-300 text-red-700 text-[13px] font-semibold">{t.del}</button>
              </div>
            ) : l.payState ? (
              <div className="flex flex-col gap-2.5" data-testid={`pay-card-${l.payState}`}>
                <p className="text-[12.5px] leading-snug text-ink/70">{l.payState === 'payment_pending' ? x.pendingNote : x.endedNote(l.paid?.until ? new Date(l.paid.until).toLocaleDateString(lang === 'es' ? 'es' : 'en-US', { day: 'numeric', month: 'long' }) : '')}</p>
                {l.payState === 'payment_pending' && l.paid?.gift?.open && (() => {
                  const g = LGIFT[lang] || LGIFT.es;
                  let d = '';
                  try { d = new Date(l.paid.gift.expires_at).toLocaleDateString(lang === 'es' ? 'es' : 'en-US', { day: 'numeric', month: 'long' }); } catch {}
                  return (
                    <div className="rounded-[12px] border-[1.5px] border-ink bg-card p-3 flex flex-col gap-2" data-testid="listing-gift-offer">
                      <p className="text-[12.5px] leading-snug font-semibold">{g.note(d)}</p>
                      <button onClick={() => claimGift(l.id)} disabled={claimingId === l.id} className="py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90 disabled:opacity-60" data-testid="listing-gift-claim">{claimingId === l.id ? g.busy : g.btn}</button>
                    </div>
                  );
                })()}
                <div className="flex gap-2">
                  <button onClick={() => setLpay({ id: l.id, kind: l.payState === 'payment_pending' ? 'publish' : 'extend' })} className="flex-[2] py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90">{l.payState === 'payment_pending' ? x.payPublish : x.extend}</button>
                  <button onClick={() => setConfirmId(l.id)} className="flex-1 py-2 rounded-pill border-[1.5px] border-red-300 text-red-700 text-[13px] font-semibold">{t.del}</button>
                </div>
              </div>
            ) : l.scan === 'scanning' ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-[12.5px] leading-snug text-ink/60">{x.scanningNote}</p>
                <button onClick={() => setConfirmId(l.id)} className="py-2 rounded-pill border-[1.5px] border-red-300 text-red-700 text-[13px] font-semibold">{t.del}</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {l.paid?.state === 'active' && l.paid.until && (
                  <div className="flex items-center gap-2" data-testid="paid-active">
                    <div className="flex-1 text-center py-2 rounded-pill bg-card text-ink text-[12px] font-bold border-[1.5px] border-ink/40">{x.paidChip} · {t.daysLeft(daysLeft(l.paid.until))}</div>
                    <button onClick={() => setLpay({ id: l.id, kind: 'extend' })} className="shrink-0 px-4 py-2 rounded-pill border-[1.5px] border-ink text-[13px] font-bold hover:bg-ink hover:text-paper">{x.extend}</button>
                  </div>
                )}
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
                  {(!l.admin_status || l.admin_status === 'active') && (
                    <button onClick={() => openSell({ edit: l.id })} className="flex-1 py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90" data-testid="edit-listing">{x.edit}</button>
                  )}
                  <button onClick={() => setConfirmId(l.id)} className="flex-1 py-2 rounded-pill border-[1.5px] border-red-300 text-red-700 text-[13px] font-semibold">{t.del}</button>
                </div>
              </div>
            )} />
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

      {fix && (
        <FixPhotosModal
          listing={fix}
          lang={lang}
          onClose={() => setFix(null)}
          onDone={() => { setFix(null); setTab('active'); polls.current = 0; load(); }}
        />
      )}

      {lpay && (
        <ListingPaymentModal
          propertyId={lpay.id}
          kind={lpay.kind}
          until={(listings || []).find((v) => v.id === lpay.id)?.paid?.until || null}
          lang={lang}
          propertyLabel={(() => { const it = (listings || []).find((v) => v.id === lpay.id); return it ? [it.type, it.neighborhood, it.city].filter(Boolean).join(' · ') : ''; })()}
          onClose={() => { setLpay(null); polls.current = 0; load(); }}
          onSuccess={() => { polls.current = 0; load(); }}
        />
      )}

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
