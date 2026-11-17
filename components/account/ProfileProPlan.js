'use client';
// Settings → Perfil profesional: the plan box, shown ONLY while the admin's Profile
// Personalization "paid" switch is ON (lib/profilePro.js, GET /api/profile-pro). Switch OFF
// (the default) → renders nothing and the page is exactly as before.
// States: not started (price, or "free — you're among the first N"), active until a date
// (renew early keeps the days left), expired (title / company / website hidden on the
// listings until renewed). Paying reuses the paid-listings Stripe flow: one click on the saved
// card, or the card form (POST /api/profile-pro/create-intent → /confirm).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripePromise } from '@/lib/stripeClient';
import { track } from '@/lib/analytics';

const T = {
  es: {
    free: (n, d) => `Gratis por ${d} días: sos de las primeras ${n} personas en activarlo.`,
    freeAll: (d) => `Gratis por ${d} días.`,
    price: (p, d) => `El perfil profesional cuesta ${p} por ${d} días.`,
    renew: (p, d) => `Renovación: ${p} por ${d} días.`,
    what: 'Mientras está activo, tu cargo, empresa y sitio web se muestran en tus publicaciones.',
    activeUntil: (dt) => `Activo hasta el ${dt}.`, expiredOn: (dt) => `Venció el ${dt}: tu cargo, empresa y sitio web ya no se muestran en tus publicaciones.`,
    activate: 'Activar', activateFree: 'Activar gratis', renewBtn: (p) => `Renovar por ${p}`, pay: (p) => `Pagar ${p}`, payWith: (p, c) => `Pagar ${p} con ${c}`, otherCard: 'Usar otra tarjeta',
    processing: 'Procesando…', ok: (dt) => `¡Listo! Tu perfil profesional está activo hasta el ${dt}.`, fail: 'El pago no se completó.', cancel: 'Cancelar', locale: 'es',
  },
  en: {
    free: (n, d) => `Free for ${d} days: you're among the first ${n} people to activate it.`,
    freeAll: (d) => `Free for ${d} days.`,
    price: (p, d) => `The professional profile costs ${p} for ${d} days.`,
    renew: (p, d) => `Renewal: ${p} for ${d} days.`,
    what: 'While it is active, your title, company and website show on your listings.',
    activeUntil: (dt) => `Active until ${dt}.`, expiredOn: (dt) => `Expired on ${dt}: your title, company and website no longer show on your listings.`,
    activate: 'Activate', activateFree: 'Activate for free', renewBtn: (p) => `Renew for ${p}`, pay: (p) => `Pay ${p}`, payWith: (p, c) => `Pay ${p} with ${c}`, otherCard: 'Use another card',
    processing: 'Processing…', ok: (dt) => `Done! Your professional profile is active until ${dt}.`, fail: 'Payment did not complete.', cancel: 'Cancel', locale: 'en-US',
  },
  pt: {
    free: (n, d) => `Grátis por ${d} dias: você está entre as primeiras ${n} pessoas a ativar.`,
    freeAll: (d) => `Grátis por ${d} dias.`,
    price: (p, d) => `O perfil profissional custa ${p} por ${d} dias.`,
    renew: (p, d) => `Renovação: ${p} por ${d} dias.`,
    what: 'Enquanto estiver ativo, seu cargo, empresa e site aparecem nos seus anúncios.',
    activeUntil: (dt) => `Ativo até ${dt}.`, expiredOn: (dt) => `Venceu em ${dt}: seu cargo, empresa e site não aparecem mais nos seus anúncios.`,
    activate: 'Ativar', activateFree: 'Ativar grátis', renewBtn: (p) => `Renovar por ${p}`, pay: (p) => `Pagar ${p}`, payWith: (p, c) => `Pagar ${p} com ${c}`, otherCard: 'Usar outro cartão',
    processing: 'Processando…', ok: (dt) => `Pronto! Seu perfil profissional está ativo até ${dt}.`, fail: 'Pagamento não concluído.', cancel: 'Cancelar', locale: 'pt-BR',
  },
};
const brandLabel = (b) => ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' }[b] || (b ? b[0].toUpperCase() + b.slice(1) : 'Card'));
const btn = 'px-5 py-2.5 rounded-pill bg-ink text-paper font-bold text-[13.5px] disabled:opacity-60';

function CardForm({ onDone, t, price }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { setErr(error.message || t.fail); setBusy(false); return; }
    if (paymentIntent?.status === 'succeeded') { onDone(paymentIntent.id); return; }
    setErr(t.fail); setBusy(false);
  };
  return (
    <div className="mt-3">
      <div className="bg-white border-[1.5px] border-ink/25 rounded-[14px] p-3"><PaymentElement options={{ layout: 'tabs' }} /></div>
      {err && <p className="mt-2 text-[12px] text-red-700">{err}</p>}
      <button type="button" onClick={pay} disabled={busy || !stripe} className={`${btn} mt-3`}>{busy ? t.processing : t.pay(price)}</button>
    </div>
  );
}

export default function ProfileProPlan({ lang = 'es' }) {
  const t = T[lang] || T.es;
  const [plan, setPlan] = useState(null);
  const [card, setCard] = useState(null);
  const [phase, setPhase] = useState('idle');   // idle | processing | card | done | error
  const [secret, setSecret] = useState('');
  const [msg, setMsg] = useState('');
  const [stripeObj, setStripeObj] = useState(null);
  const stripeRef = useRef(null);

  const load = useCallback(() => fetch('/api/profile-pro').then((r) => r.json()).then((j) => setPlan(j && !j.error ? j : null)).catch(() => setPlan(null)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!plan?.enabled || plan.next?.cents === 0) return;
    fetch('/api/account/payments').then((r) => r.json()).then((p) => setCard(p?.card?.last4 ? p.card : null)).catch(() => {});
  }, [plan]);

  const fmt = (iso) => { try { return new Date(iso).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
  const done = (until) => { track('profile_plan_activated', { kind: plan?.next?.kind }); setMsg(t.ok(fmt(until))); setPhase('done'); load(); };
  const confirm = async (piId) => {
    setPhase('processing');
    const j = await fetch('/api/profile-pro/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentIntentId: piId }) }).then((r) => r.json()).catch(() => ({}));
    if (j.status === 'succeeded') done(j.until); else { setMsg(j.error || t.fail); setPhase('error'); }
  };
  const start = async (useSavedCard) => {
    track('profile_plan_started', { kind: plan?.next?.kind, cents: plan?.next?.cents, saved_card: !!useSavedCard });
    setPhase('processing'); setMsg('');
    try {
      const j = await fetch('/api/profile-pro/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ useSavedCard }) }).then((r) => r.json());
      if (j.status === 'succeeded') { done(j.until); return; }
      if (j.status === 'requires_action' && j.clientSecret) {
        const s = stripeRef.current || await getStripePromise();
        const { error, paymentIntent } = s ? await s.handleNextAction({ clientSecret: j.clientSecret }) : { error: { message: t.fail } };
        if (error) { setMsg(error.message || t.fail); setPhase('error'); return; }
        if (paymentIntent?.status === 'succeeded') { await confirm(paymentIntent.id); return; }
      }
      if (j.status === 'requires_payment' && j.clientSecret) {
        const s = await getStripePromise();
        stripeRef.current = s; setStripeObj(s); setSecret(j.clientSecret); setPhase('card'); return;
      }
      setMsg(j.error || t.fail); setPhase('error');
    } catch { setMsg(t.fail); setPhase('error'); }
  };

  if (!plan?.enabled) return null;
  const { status, next } = plan;
  const free = next?.cents === 0;
  const head = status?.active ? t.activeUntil(fmt(status.until))
    : status?.expired ? t.expiredOn(fmt(status.until))
      : free ? (next.kind === 'profile_free' && plan.firstFree > 0 && plan.price !== 'US$0' ? t.free(plan.firstFree, plan.days) : t.freeAll(plan.days))
        : t.price(plan.price, plan.days);
  const label = free ? t.activateFree : status?.ever ? t.renewBtn(next.price) : t.activate;

  return (
    <div className={`rounded-[14px] border-[1.5px] p-4 mb-4 ${status?.expired ? 'border-amber-300 bg-amber-50' : status?.active ? 'border-green-200 bg-green-50' : 'border-ink/20 bg-paper/60'}`} data-testid="profile-plan" data-state={status?.active ? 'active' : status?.expired ? 'expired' : 'none'}>
      <p className="text-[13.5px] font-semibold">{head}</p>
      <p className="text-[12.5px] text-ink/60 mt-1">{t.what} {!status?.ever && !free ? t.renew(plan.renewPrice, plan.days) : ''}</p>
      {phase === 'done' ? <p className="mt-2 text-[13px] font-semibold text-green-800">{msg}</p> : (
        <div className="mt-3">
          {phase === 'card' && secret && stripeObj
            ? <Elements stripe={stripeObj} options={{ clientSecret: secret }}><CardForm onDone={confirm} t={t} price={next.price} /></Elements>
            : card && !free ? (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => start(true)} disabled={phase === 'processing'} className={btn}>{phase === 'processing' ? t.processing : t.payWith(next.price, `${brandLabel(card.brand)} •••• ${card.last4}`)}</button>
                <button type="button" onClick={() => start(false)} className="text-[12.5px] font-semibold underline">{t.otherCard}</button>
              </div>
            ) : (
              <button type="button" onClick={() => start(false)} disabled={phase === 'processing'} className={btn} data-testid="profile-plan-go">{phase === 'processing' ? t.processing : label}</button>
            )}
          {phase === 'error' && msg && <p className="mt-2 text-[12.5px] text-red-700">{msg}</p>}
        </div>
      )}
    </div>
  );
}
