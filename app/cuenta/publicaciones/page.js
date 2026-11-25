'use client';
import { typeLabel } from '@/lib/propertyTypeOptions';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { tr, localeFor } from '@/lib/i18n';
import ListingCard from '@/components/account/ListingCard';
import ShareButton from '@/components/ShareButton';
import ConfirmModal from '@/components/ConfirmModal';
import HighlightModal from '@/components/HighlightModal';
import ListingPaymentModal from '@/components/ListingPaymentModal';
import FixPhotosModal from '@/components/account/FixPhotosModal';
import { CardGridSkeleton } from '@/components/account/Skeletons';
import { useSellFlow } from '@/components/SellFlow';
import { draftMissing } from '@/lib/drafts';
import { track } from '@/lib/analytics';

const T = {
  es: { title: 'Mis publicaciones', sub: (n) => `${n} ${n === 1 ? 'propiedad publicada' : 'propiedades publicadas'}`, empty: 'Todavía no publicaste ninguna propiedad.', publish: 'Publicar propiedad', del: 'Eliminar', confirmT: 'Eliminar publicación', confirm: 'Sale del sitio y de la app ahora. La podés recuperar cuando quieras desde «Eliminadas».', cancel: 'Cancelar', deleting: 'Eliminando…', view: 'Ver', loading: 'Cargando…', promoteVerify: 'Verificar · US$5', promoteHome: 'Portada · US$20', renew: 'Renovar', verifiedChip: 'Verificada', homeChip: 'En portada', upgradeHome: 'Subir a portada · US$20', paying: 'Procesando…', daysLeft: (n) => `faltan ${n} ${n === 1 ? 'día' : 'días'}` },
  en: { title: 'My listings', sub: (n) => `${n} published ${n === 1 ? 'property' : 'properties'}`, empty: "You haven't published any properties yet.", publish: 'List a property', del: 'Delete', confirmT: 'Delete listing', confirm: 'It leaves the site and the app now. You can recover it anytime from "Deleted".', cancel: 'Cancel', deleting: 'Deleting…', view: 'View', loading: 'Loading…', promoteVerify: 'Verify · US$5', promoteHome: 'Landing · US$20', renew: 'Renew', verifiedChip: 'Verified', homeChip: 'On landing', upgradeHome: 'Move to Landing · US$20', paying: 'Processing…', daysLeft: (n) => `${n} ${n === 1 ? 'day' : 'days'} left` },
  pt: { title: 'Meus anúncios', sub: (n) => `${n} ${n === 1 ? 'imóvel publicado' : 'imóveis publicados'}`, empty: "Você ainda não publicou nenhum imóvel.", publish: 'Anunciar imóvel', del: 'Excluir', confirmT: 'Excluir anúncio', confirm: 'Sai do site e do app agora. Você pode recuperá-lo quando quiser em «Excluídos».', cancel: 'Cancelar', deleting: 'Excluindo…', view: 'Ver', loading: 'Carregando…', promoteVerify: 'Verificar · US$5', promoteHome: 'Em destaque · US$20', renew: 'Renovar', verifiedChip: 'Verificado', homeChip: 'Em destaque', upgradeHome: 'Mover para destaque · US$20', paying: 'Processando…', daysLeft: (n) => `${n} ${n === 1 ? 'dia' : 'dias'} restantes` },
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
  pt: {
    claimedT: 'Imóvel verificado',
    claimed: (d) => `Pronto: seu imóvel está agora verificado e em destaque na página inicial da Casa Libre${d ? ` até ${d}` : ''}, grátis. Mais compradores vão vê-lo.`,
    expired: 'Este presente não está mais disponível: o link expirou.',
    inactive: "Não conseguimos ativar o presente porque o anúncio não está ativo no momento.",
    invalid: "Este link não é válido para esta conta.",
    error: "Não conseguimos ativar o presente. Tente novamente mais tarde.",
    seeHome: 'Ver a página inicial', close: 'Fechar',
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
  pt: {
    note: (d) => `Esta vai por nossa conta: publique grátis${d ? ` até ${d}` : ''}.`,
    btn: 'Publicar grátis', busy: 'Publicando…',
    claimedT: 'Pronto, esta vai por nossa conta!',
    claimed: "Seu anúncio está sendo publicado grátis: estamos verificando as fotos e ele ficará ativo em instantes.",
    expired: 'Este presente expirou. Você pode pagar para publicá‑lo.',
    paid: 'Este anúncio já está pago.',
    unavailable: 'Este anúncio não está mais aguardando pagamento.',
    invalid: "Este link não é válido para esta conta.",
    error: "Não conseguimos publicar. Por favor, tente novamente mais tarde.",
    close: 'Fechar',
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
    endedNote: (d) => `Terminó${d ? ` el ${d}` : ''} y ya no está en el sitio. Extendela para volver a publicarla.`, extend: 'Extender', paidChip: 'Publicación paga', freeChip: 'Publicación gratis',
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
    endedNote: (d) => `It ended${d ? ` on ${d}` : ''} and is off the site. Extend it to bring it back.`, extend: 'Extend', paidChip: 'Paid listing', freeChip: 'Free listing',
    rejectedNote: "We didn't publish it: some photos may show 18+, harmful, abusive or unrelated content. Replace them and submit again.",
    fix: 'Fix photos', edit: 'Edit',
    emptyDrafts: "No drafts. If you start a listing and don't finish, we keep it here.",
    saved: (s) => `Saved ${s}`, missing: 'Missing', miss: { price: 'price', area: 'area', phone: 'phone', photos: 'photos' },
    confirmT: 'Delete draft', confirm: 'Delete this draft?',
    types: { casa: 'House', departamento: 'Apartment', duplex: 'Duplex', terreno: 'Lot' }, sale: 'Sale', rent: 'Rent', property: 'Property',
  },
  pt: {
    tabActive: 'Publicados', tabDrafts: 'Rascunhos', tabRejected: 'Rejeitados', draftChip: 'Rascunho', cont: 'Continuar', del: 'Excluir',
    emptyRejected: 'Nenhum anúncio rejeitado.',
    scanningNote: 'Estamos analisando as fotos. Seu anúncio será publicado em breve.',
    reviewNote: 'Em revisão: pode ser um anúncio duplicado. Tem os mesmos dados e fotos de outro seu imóvel, então não o publicamos. Enviamos um e‑mail para você.',
    pendingNote: 'Salvo, mas ainda não está no site: você já usou os anúncios gratuitos deste mês. Pague para publicá‑lo.', payPublish: 'Pagar e publicar',
    endedNote: (d) => `Encerrado${d ? ` em ${d}` : ''} e fora do site. Estenda para trazê‑lo de volta.`, extend: 'Estender', paidChip: 'Anúncio pago', freeChip: 'Anúncio grátis',
    rejectedNote: 'Não publicamos: algumas fotos podem conter conteúdo adulto (+18), prejudicial, ofensivo ou sem relação com o imóvel. Substitua‑as e envie novamente.',
    fix: 'Corrigir fotos', edit: 'Editar',
    emptyDrafts: 'Nenhum rascunho. Se você começar a anunciar e não terminar, salvamos aqui.',
    saved: (s) => `Salvo ${s}`, missing: 'Faltando', miss: { price: 'preço', area: 'área', phone: 'telefone', photos: 'fotos' },
    confirmT: 'Excluir rascunho', confirm: 'Excluir este rascunho?',
    types: { casa: 'Casa', departamento: 'Apartamento', duplex: 'Duplex', terreno: 'Terreno' }, sale: 'Venda', rent: 'Aluguel', property: 'Imóvel',
},
};

function ago(iso, lang) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return tr(lang, 'recién', 'just now', 'agora mesmo');
  if (m < 60) return tr(lang, `hace ${m} min`, `${m} min ago`, `há ${m} min`);
  const h = Math.round(m / 60);
  if (h < 24) return tr(lang, `hace ${h} h`, `${h} h ago`, `há ${h} h`);
  const d = Math.round(h / 24);
  return tr(lang, `hace ${d} ${d === 1 ? 'día' : 'días'}`, `${d} ${d === 1 ? 'day' : 'days'} ago`, `há ${d} ${d === 1 ? 'dia' : 'dias'}`);
}

// "More options" panel for a listing card: a bottom sheet on phones, a centred card on larger
// screens. Esc or a tap outside closes it.
function ListingMore({ title, onClose, closeLabel, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-[400px] bg-paper rounded-t-[20px] sm:rounded-[20px] p-4 pb-6 sm:pb-4 shadow-xl max-h-[85vh] overflow-y-auto" data-testid="listing-more-panel">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <div className="font-bold text-[15px] truncate">{title}</div>
          <button onClick={onClose} aria-label={closeLabel} className="shrink-0 w-8 h-8 rounded-full border border-ink/20 grid place-items-center text-[16px] leading-none hover:bg-ink/[0.05]">×</button>
        </div>
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    </div>
  );
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
  const [moreId, setMoreId] = useState(null);      // the listing whose "More options" panel is open
  const [busy, setBusy] = useState(false);
  const [promo, setPromo] = useState(null);     // { id, plan } — open the payment modal (no card / 3DS)
  const [payingId, setPayingId] = useState(null); // id being charged silently on a saved card
  const [autoPay, setAutoPay] = useState(false);  // one-shot: honor a ?pay=&plan= deep link once
  const [gift, setGift] = useState(null);         // { state, id } from the gift email's verify link
  const [lpay, setLpay] = useState(null);         // { id, kind: 'publish' | 'extend' } — the paid-listing pop-up
  const [lgift, setLgift] = useState(null);       // { state, id } — the "on us" gift result
  const [claimingId, setClaimingId] = useState(null);
  const [trash, setTrash] = useState(null);        // "Eliminadas": deleted listings, recoverable (lib/listingTrash.js)
  const [recoveringId, setRecoveringId] = useState(null);
  const [recovered, setRecovered] = useState(null); // { id, ended } just brought back → banner

  const load = () => {
    fetch('/api/account/listings').then((r) => r.json()).then((j) => { setListings(j.listings || []); setTrash(j.deleted || []); }).catch(() => { setListings([]); setTrash([]); });
    fetch('/api/drafts').then((r) => r.json()).then((j) => setDrafts(j.drafts || [])).catch(() => setDrafts([]));
  };
  useEffect(() => {
    load();
    try { const tb = new URLSearchParams(window.location.search).get('tab'); if (tb === 'borradores') setTab('drafts'); else if (tb === 'rechazadas') setTab('rejected'); else if (tb === 'eliminadas') setTab('deleted'); } catch {}
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

  // Deep link from the mobile app's "Editar" (the app has no edit form of its own):
  // /cuenta/publicaciones?edit=<id> → open that listing in the edit form once the listings
  // have loaded (once). Only the person's own listings (the list comes from their account).
  const editOpened = useRef(false);
  useEffect(() => {
    if (editOpened.current || !listings) return;
    let id = null;
    try { id = new URLSearchParams(window.location.search).get('edit'); } catch {}
    if (!id || !listings.some((l) => l.id === id)) return;
    editOpened.current = true;
    openSell({ edit: id });
  }, [listings, openSell]);

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
      if (r.ok) { setListings((ls) => ls.filter((l) => l.id !== id)); setRecovered(null); load(); }
    } finally { setBusy(false); setConfirmId(null); }
  };

  // "Eliminadas" → Recover: back as it was; paid features keep their original end dates (ended → comes back ended).
  const recover = async (id) => {
    setRecoveringId(id);
    try {
      const r = await fetch('/api/account/listings/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setTrash((ts) => (ts || []).filter((l) => l.id !== id)); setRecovered({ id, ended: !!j.ended }); setTab('active'); track('listing_recovered', { property_id: id, ended: !!j.ended }); load(); }
    } finally { setRecoveringId(null); }
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
        try { if (l?.promotion_expires_at) until = new Date(l.promotion_expires_at).toLocaleDateString(localeFor(lang, 'es-PY'), { day: 'numeric', month: 'long' }); } catch {}
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
        {[['active', x.tabActive, listings && published.length], ['rejected', x.tabRejected, listings && rejected.length], ['drafts', x.tabDrafts, drafts?.length], ...(trash && trash.length ? [['deleted', tr(lang, 'Eliminadas', 'Deleted', 'Excluídos'), trash.length]] : [])].map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-pill text-[13.5px] font-semibold inline-flex items-center gap-2 ${tab === k ? 'bg-ink text-paper' : 'text-ink/60'}`}>
            {label}
            {n != null && <span className={`min-w-[20px] h-5 px-1.5 rounded-pill text-[11px] font-bold inline-flex items-center justify-center ${tab === k ? 'bg-paper text-ink' : 'bg-ink/10 text-ink/70'}`}>{n}</span>}
          </button>
        ))}
      </div>

      {recovered && (
        <div data-testid="recovered-banner" className="mb-6 rounded-card border-[1.5px] border-ink bg-card shadow-hard-soft p-4 sm:p-5 flex items-start gap-3">
          <span aria-hidden className="shrink-0 w-9 h-9 rounded-full bg-ink text-paper inline-flex items-center justify-center text-[18px] font-bold">✓</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[16px] leading-tight">{tr(lang, 'Publicación recuperada', 'Listing recovered', 'Anúncio recuperado')}</p>
            <p className="text-[14px] leading-snug text-ink/70 mt-1">{recovered.ended
              ? tr(lang, 'Su período de publicación terminó mientras estaba eliminada. Extendela para volver a publicarla.', 'Its listing period ended while it was deleted. Extend it to publish it again.', 'O período do anúncio terminou enquanto estava excluído. Estenda para publicá-lo de novo.')
              : tr(lang, 'Volvió a estar en línea como estaba, con sus mejoras pagas hasta la misma fecha de vencimiento.', 'It is live again as it was, with its paid features until the same end date.', 'Voltou a ficar no ar como estava, com os recursos pagos até a mesma data de vencimento.')}</p>
          </div>
          <button onClick={() => setRecovered(null)} aria-label={t.cancel} className="shrink-0 text-ink/40 hover:text-ink text-[20px] leading-none">×</button>
        </div>
      )}

      {tab === 'deleted' && (
        <div data-testid="trash-tab">
          <p className="text-[13.5px] text-ink/60 mb-4 max-w-[640px]">{tr(lang,
            'Las publicaciones que eliminás quedan acá. Ya no se ven en el sitio ni en la app; si fue un error, recuperala con un clic.',
            'Listings you delete stay here. They no longer show on the site or in the app; if it was a mistake, recover it in one click.',
            'Os anúncios que você exclui ficam aqui. Eles não aparecem mais no site nem no app; se foi um engano, recupere com um clique.')}</p>
          {!trash || trash.length === 0 ? (
            <div className="bg-card border border-ink/15 rounded-card p-10 text-center font-mono text-[12px] text-ink/45">{tr(lang, 'No hay publicaciones eliminadas.', 'No deleted listings.', 'Nenhum anúncio excluído.')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trash.map((l) => {
                return (
                  <div key={l.id} className="opacity-90">
                    <ListingCard l={l} action={
                      <div className="flex flex-col gap-2.5" data-testid="trash-card">
                        <button onClick={() => recover(l.id)} disabled={recoveringId === l.id} className="py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90 disabled:opacity-60" data-testid="recover-listing">
                          {recoveringId === l.id ? tr(lang, 'Recuperando…', 'Recovering…', 'Recuperando…') : tr(lang, 'Recuperar publicación', 'Recover listing', 'Recuperar anúncio')}
                        </button>
                      </div>
                    } />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                <p className="text-[12.5px] leading-snug text-ink/70">{l.payState === 'payment_pending' ? x.pendingNote : x.endedNote((l.paid?.until || l.freeUntil) ? new Date(l.paid?.until || l.freeUntil).toLocaleDateString(localeFor(lang, 'es'), { day: 'numeric', month: 'long' }) : '')}</p>
                {l.payState === 'payment_pending' && l.paid?.gift?.open && (() => {
                  const g = LGIFT[lang] || LGIFT.es;
                  let d = '';
                  try { d = new Date(l.paid.gift.expires_at).toLocaleDateString(localeFor(lang, 'es'), { day: 'numeric', month: 'long' }); } catch {}
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
              /* Card actions (Nov 25, "show few buttons, the rest in a panel"): Share + its numbers,
                 then Edit and More options. More opens ListingMore (plan + Extend, promote, View, Delete). */
              <div className="flex flex-col gap-3">
                {(!l.status || l.status === 'published') && (!l.admin_status || l.admin_status === 'active') && (
                  <div className="flex flex-col gap-1.5" data-testid="share-row">
                    <ShareButton listingId={l.id} source="account" variant="pill" className="w-full py-2" />
                    {l.share && (
                      <p className="text-[12px] text-center text-ink/60" data-testid="share-week">
                        {tr(lang,
                          `Tu link trajo ${l.share.last7.visits} ${l.share.last7.visits === 1 ? 'visita' : 'visitas'} y ${l.share.last7.contacts} ${l.share.last7.contacts === 1 ? 'contacto' : 'contactos'} esta semana`,
                          `Your link brought ${l.share.last7.visits} ${l.share.last7.visits === 1 ? 'visit' : 'visits'} and ${l.share.last7.contacts} ${l.share.last7.contacts === 1 ? 'contact' : 'contacts'} this week`,
                          `Seu link trouxe ${l.share.last7.visits} ${l.share.last7.visits === 1 ? 'visita' : 'visitas'} e ${l.share.last7.contacts} ${l.share.last7.contacts === 1 ? 'contato' : 'contatos'} esta semana`)}
                      </p>
                    )}
                  </div>
                )}
                {payingId === l.id && (
                  <div className="text-center py-2 rounded-pill bg-card text-ink text-[12.5px] font-bold border-[1.5px] border-ink">{t.paying}</div>
                )}
                <div className="flex gap-2">
                  {(!l.admin_status || l.admin_status === 'active') && (
                    <button onClick={() => openSell({ edit: l.id })} className="flex-1 py-2 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90" data-testid="edit-listing">{x.edit}</button>
                  )}
                  <button onClick={() => setMoreId(l.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-pill border-[1.5px] border-ink/70 text-[13px] font-semibold hover:bg-ink hover:text-paper transition-colors" data-testid="listing-more" aria-haspopup="dialog">
                    {tr(lang, 'Más opciones', 'More options', 'Mais opções')}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                  </button>
                </div>
              </div>
            )} />
          ))}
        </div>
      )}

      {(() => {
        const l = moreId ? (listings || []).find((r) => r.id === moreId) : null;
        if (!l) return null;
        const close = () => setMoreId(null);
        const run = (fn) => () => { close(); fn(); };
        const active = !l.admin_status || l.admin_status === 'active';
        const paid = !!(l.paid?.state === 'active' && l.paid.until);
        const planUntil = paid ? l.paid.until : (!l.paid?.until && l.freeUntil) || null;
        const row = 'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[12px] text-left text-[14px] hover:bg-ink/[0.05] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
        return (
          <ListingMore title={[l.type, l.neighborhood || l.city].filter(Boolean).join(' · ')} onClose={close} closeLabel={t.cancel}>
            {planUntil && (
              <div className="flex items-center justify-between gap-3 rounded-[12px] bg-ink/[0.04] pl-4 pr-2 py-2" data-testid={paid ? 'paid-active' : 'free-active'}>
                <span className="text-[13px] text-ink/80"><span className="font-semibold text-ink">{paid ? x.paidChip : x.freeChip}</span> · {t.daysLeft(daysLeft(planUntil))}</span>
                <button onClick={run(() => setLpay({ id: l.id, kind: 'extend' }))} className="shrink-0 px-4 py-1.5 rounded-pill bg-ink text-paper text-[13px] font-bold hover:bg-ink/90" data-testid={paid ? undefined : 'free-extend'}>{x.extend}</button>
              </div>
            )}
            <div className="text-[12px] font-semibold text-ink/50 px-1 pt-2">{tr(lang, 'Destacá tu publicación', 'Promote your listing', 'Destaque seu anúncio')}</div>
            {l.verified ? (
              <>
                <button onClick={run(() => payFor(l.id, l.plan || 'verified'))} className={row}>
                  <span><span className="font-semibold">{l.plan === 'home' ? t.homeChip : t.verifiedChip}</span>{l.promotion_expires_at ? ` · ${t.daysLeft(daysLeft(l.promotion_expires_at))}` : ''}</span>
                  <span className="text-[13px] font-bold">{t.renew}</span>
                </button>
                {l.plan !== 'home' && <button onClick={run(() => payFor(l.id, 'home'))} className={row}><span>{t.upgradeHome}</span><span aria-hidden="true">›</span></button>}
              </>
            ) : (
              <>
                <button onClick={run(() => payFor(l.id, 'verified'))} disabled={!active} className={row}><span>{t.promoteVerify}</span><span aria-hidden="true">›</span></button>
                <button onClick={run(() => payFor(l.id, 'home'))} disabled={!active} className={row}><span>{t.promoteHome}</span><span aria-hidden="true">›</span></button>
              </>
            )}
            <div className="border-t border-ink/10 my-1" />
            <Link href={`/propiedad/${l.id}`} onClick={close} className={row}><span>{tr(lang, 'Ver publicación', 'View listing', 'Ver anúncio')}</span><span aria-hidden="true">›</span></Link>
            <button onClick={run(() => setConfirmId(l.id))} className={`${row} text-red-700 hover:bg-red-50`}><span>{t.del}</span></button>
          </ListingMore>
        );
      })()}
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
          until={(() => { const it = (listings || []).find((v) => v.id === lpay.id); return it?.paid?.until || it?.freeUntil || null; })()}
          summary={(() => { const it = (listings || []).find((v) => v.id === lpay.id); return it ? { image: it.image || null, price: it.price, currency: it.currency, ended: it.payState === 'expired' } : null; })()}
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
