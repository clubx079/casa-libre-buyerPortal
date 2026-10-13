'use client';
// The paid-listing pop-up (lib/paidListings.js):
//   kind 'publish' — "You've reached your free listings for this month": the list price
//                    crossed out, the discount, what they pay (US$5.80) and for how long
//                    (90 days), the local price in small print. The listing is already
//                    saved; paying publishes it.
//   kind 'extend'  — "Extend your listing": 30 more days for US$5.
// Prices come from the server (/api/listing-quota), set in the admin. Charged in US$.
// Saved card → one click; no card → the Stripe card form (the card is kept for next time).
import { useEffect, useState, useCallback, useRef } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripePromise } from '@/lib/stripeClient';
import StrikePrice from '@/components/StrikePrice';

const appearance = {
  theme: 'flat',
  variables: { colorPrimary: '#111111', colorBackground: '#ffffff', colorText: '#111111', colorDanger: '#b91c1c', fontFamily: "'Space Grotesk', system-ui, sans-serif", borderRadius: '12px', spacingUnit: '4px' },
  rules: { '.Input': { border: '1.5px solid rgba(17,17,17,.25)', boxShadow: 'none' }, '.Input:focus': { border: '1.5px solid #111111' } },
};

const DICT = {
  es: {
    titlePublish: 'Ya usaste tus publicaciones gratis de este mes',
    subPublish: (n) => `Cada mes podés publicar ${n} ${n === 1 ? 'propiedad' : 'propiedades'} gratis. Tu publicación ya está guardada: publicala ahora.`,
    titleExtend: 'Extendé tu publicación',
    subExtend: (d) => `Tu propiedad vuelve a estar (o sigue) en el sitio ${d} días más.`,
    off: (p) => `${p}% OFF`, live: (d) => `Publicada ${d} días`, more: (d) => `+${d} días`,
    reset: 'Tus publicaciones gratis vuelven el 1.º del mes que viene.',
    agents: '¿Publicás muchas propiedades? Tenemos un plan para agentes e inmobiliarias.', agentsLink: 'Contactanos',
    payWith: (price, c) => `Pagar ${price} con ${c}`, pay: (price) => `Pagar ${price}`, otherCard: 'Usar otra tarjeta',
    newHint: 'Ingresá los datos de tu tarjeta. La guardamos de forma segura en Stripe.',
    loading: 'Cargando…', processing: 'Procesando pago…',
    okPublish: '¡Pago recibido! Revisamos las fotos y la publicamos en un momento.', okExtend: '¡Listo! Tu publicación fue extendida.',
    okUntil: (d) => `Estará en el sitio hasta el ${d}.`, done: 'Listo',
    errTitle: 'El pago no se completó', retry: 'Reintentar', close: 'Cerrar',
    err: { unauthorized: 'Iniciá sesión para pagar.', not_pending: 'Esta publicación ya fue pagada.', not_paid_listing: 'Esta publicación no se puede extender.', forbidden: 'No podés pagar esta publicación.', not_found: 'No encontramos la publicación.', stripe_not_configured: 'El pago no está disponible en este momento.' },
    fail: 'El pago no se completó.', locale: 'es',
  },
  en: {
    titlePublish: "You've reached your free listings for this month",
    subPublish: (n) => `Each month you can publish ${n} ${n === 1 ? 'listing' : 'listings'} for free. Your listing is saved — publish it now.`,
    titleExtend: 'Extend your listing',
    subExtend: (d) => `Your listing goes back on (or stays on) the site for ${d} more days.`,
    off: (p) => `${p}% OFF`, live: (d) => `Live for ${d} days`, more: (d) => `+${d} days`,
    reset: 'Your free listings come back on the 1st of next month.',
    agents: 'Listing a lot of properties? We have a plan for agents and agencies.', agentsLink: 'Contact us',
    payWith: (price, c) => `Pay ${price} with ${c}`, pay: (price) => `Pay ${price}`, otherCard: 'Use another card',
    newHint: 'Enter your card details. We store it securely with Stripe.',
    loading: 'Loading…', processing: 'Processing payment…',
    okPublish: 'Payment received! We check the photos and publish it in a moment.', okExtend: 'Done! Your listing was extended.',
    okUntil: (d) => `It stays on the site until ${d}.`, done: 'Done',
    errTitle: 'Payment did not complete', retry: 'Try again', close: 'Close',
    err: { unauthorized: 'Log in to pay.', not_pending: 'This listing is already paid.', not_paid_listing: "This listing can't be extended.", forbidden: "You can't pay for this listing.", not_found: 'Listing not found.', stripe_not_configured: 'Payments are unavailable right now.' },
    fail: 'Payment did not complete.', locale: 'en-US',
  },
};

const brandLabel = (b) => ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' }[b] || (b ? b[0].toUpperCase() + b.slice(1) : 'Card'));

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
    if (paymentIntent && paymentIntent.status === 'succeeded') { onDone(paymentIntent.id); return; }
    setErr(t.fail); setBusy(false);
  };
  return (
    <div>
      <div className="bg-white border-[1.5px] border-ink/25 rounded-[16px] p-4"><PaymentElement options={{ layout: 'tabs' }} /></div>
      {err && <div className="mt-3 text-[12px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">{err}</div>}
      <button onClick={pay} disabled={busy || !stripe} data-testid="lp-card-pay" className="mt-4 w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] disabled:opacity-60">{busy ? t.processing : t.pay(price)}</button>
    </div>
  );
}

export default function ListingPaymentModal({ propertyId, kind = 'publish', lang = 'es', propertyLabel, onClose, onSuccess }) {
  const t = DICT[lang] || DICT.es;
  const [offer, setOffer] = useState(null);
  const [card, setCard] = useState(null);
  const [phase, setPhase] = useState('loading');   // loading | offer | card | processing | success | error
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const [until, setUntil] = useState('');
  const [stripeObj, setStripeObj] = useState(undefined);
  const stripeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.resolve(getStripePromise()).then((s) => { if (alive) { stripeRef.current = s || null; setStripeObj(s || null); } }).catch(() => { if (alive) setStripeObj(null); });
    Promise.all([
      fetch('/api/listing-quota').then((r) => r.json()).catch(() => null),
      fetch('/api/account/payments').then((r) => r.json()).catch(() => null),
    ]).then(([q, p]) => { if (!alive) return; setOffer(q); setCard(p?.card?.last4 ? p.card : null); setPhase('offer'); });
    return () => { alive = false; };
  }, []);

  const price = kind === 'extend' ? offer?.extendPrice : offer?.price;
  const ok = (u) => { setUntil(u || ''); setPhase('success'); onSuccess && onSuccess(u); };

  const serverConfirm = useCallback(async (piId) => {
    setPhase('processing');
    try {
      const r = await fetch('/api/listing-payment/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, paymentIntentId: piId }) });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'succeeded') ok(j.until); else { setError(j.error || t.fail); setPhase('error'); }
    } catch { setError(t.fail); setPhase('error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, t]);

  const start = useCallback(async (useSavedCard) => {
    setError(''); setPhase('processing');
    try {
      const r = await fetch('/api/listing-payment/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, kind, useSavedCard }) });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'succeeded') { ok(j.until); return; }
      if (j.status === 'requires_action' && j.clientSecret && stripeRef.current) {
        const { error: e, paymentIntent } = await stripeRef.current.handleNextAction({ clientSecret: j.clientSecret });
        if (e) { setError(e.message || t.fail); setPhase('error'); return; }
        if (paymentIntent?.status === 'succeeded') { await serverConfirm(paymentIntent.id); return; }
      }
      if (j.status === 'requires_payment' && j.clientSecret) { setClientSecret(j.clientSecret); setPhase('card'); return; }
      setError(t.err[j.error] || j.error || t.fail); setPhase('error');
    } catch { setError(t.fail); setPhase('error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, kind, serverConfirm, t]);

  const fmt = (iso) => { try { return new Date(iso).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
  const local = kind === 'extend' ? offer?.local?.extend : offer?.local?.price;

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto cl-scroll bg-ink/60 backdrop-blur-sm" onClick={onClose} data-testid="listing-payment-modal">
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="relative w-full max-w-[460px] my-4 bg-paper rounded-[22px] border-[1.5px] border-ink/15 shadow-2xl p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} aria-label={t.close} className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-full hover:bg-ink/5 text-ink/50 text-lg">×</button>
          <h2 className="text-[21px] font-bold tracking-head leading-tight mb-1.5 pr-8">{kind === 'extend' ? t.titleExtend : t.titlePublish}</h2>
          {offer && <p className="text-[13px] text-ink/60 mb-4">{kind === 'extend' ? t.subExtend(offer.extendDays) : t.subPublish(offer.freePerMonth)}</p>}
          {propertyLabel && <p className="text-[12.5px] font-medium text-ink/55 mb-4 truncate">{propertyLabel}</p>}

          {phase === 'loading' && <div className="py-10 text-center text-ink/50 text-[14px]">{t.loading}</div>}

          {offer && (phase === 'offer' || phase === 'card') && (
            <div className="rounded-[16px] border-[1.5px] border-ink bg-card px-4 py-4 mb-4" data-testid="lp-price">
              <div className="flex items-center gap-2.5 flex-wrap">
                {kind === 'publish' && offer.discountPct > 0 && <StrikePrice className="text-[23px] leading-none" data-testid="lp-list-price">{offer.listPrice}</StrikePrice>}
                {kind === 'publish' && offer.discountPct > 0 && <span className="text-[11px] font-bold bg-ink text-paper px-2 py-0.5 rounded-pill" data-testid="lp-discount">{t.off(offer.discountPct)}</span>}
                <span className="text-[30px] font-bold tracking-head leading-none" data-testid="lp-final-price">{price}</span>
                {local && <span className="text-[12.5px] font-semibold text-ink/55" data-testid="lp-local">{local}</span>}
              </div>
              <div className="mt-2 text-[12.5px] font-semibold text-ink/60">{kind === 'extend' ? t.more(offer.extendDays) : t.live(offer.days)}</div>
            </div>
          )}

          {phase === 'offer' && offer && (
            <div className="flex flex-col gap-2">
              {card ? (
                <>
                  <button onClick={() => start(true)} data-testid="lp-pay-saved" className="w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px]">{t.payWith(price, `${brandLabel(card.brand)} •••• ${card.last4}`)}</button>
                  <button onClick={() => start(false)} className="w-full py-2.5 text-[13px] font-medium text-ink/60 hover:text-ink underline underline-offset-2">{t.otherCard}</button>
                </>
              ) : (
                <button onClick={() => start(false)} data-testid="lp-pay" className="w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px]">{t.pay(price)}</button>
              )}
              {kind === 'publish' && (
                <>
                  <p className="text-[11.5px] text-ink/50 text-center mt-1">{t.reset}</p>
                  <p className="text-[12px] text-ink/65 text-center mt-1">{t.agents} <a href="/empresas" className="font-semibold underline">{t.agentsLink}</a></p>
                </>
              )}
            </div>
          )}

          {phase === 'card' && clientSecret && stripeObj && (
            <div>
              <div className="text-[13px] text-ink/55 mb-3">{t.newHint}</div>
              <Elements stripe={stripeObj} options={{ clientSecret, appearance }}><CardForm onDone={serverConfirm} t={t} price={price} /></Elements>
            </div>
          )}
          {phase === 'processing' && <div className="py-10 text-center text-ink/60 text-[14px]">{t.processing}</div>}

          {phase === 'success' && (
            <div className="py-6 text-center" data-testid="lp-success">
              <div className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-emerald-100 text-emerald-700 text-2xl mb-4">✓</div>
              <div className="text-[16px] font-bold tracking-head mb-1">{kind === 'extend' ? t.okExtend : t.okPublish}</div>
              {until && <div className="text-[13px] text-ink/55 mb-6">{t.okUntil(fmt(until))}</div>}
              <button onClick={onClose} className="w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px]">{t.done}</button>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-4 text-center" data-testid="lp-error">
              <div className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-red-100 text-red-700 text-2xl mb-4">!</div>
              <div className="text-[15px] font-semibold mb-1">{t.errTitle}</div>
              <div className="text-[13px] text-ink/60 mb-6">{error}</div>
              <div className="flex gap-2">
                <button onClick={() => setPhase('offer')} className="flex-1 py-3 bg-ink text-paper rounded-pill font-bold text-[14px]">{t.retry}</button>
                <button onClick={onClose} className="flex-1 py-3 border-[1.5px] border-ink/25 rounded-pill font-bold text-[14px]">{t.close}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
