'use client';
// Reusable promotion payment modal — used by the sell wizard, /publicar AND the
// dashboard. Plan-aware: 'verified' (US$5) or 'home' (US$20, everything in verified +
// the landing page). Bilingual (es/en).
//   • If the user has a saved card → one-click charge (off_session on the server).
//   • Otherwise → the Stripe Payment Element; the card is vaulted for next time.
// The server (/api/highlight/*) is authoritative for granting the promotion; this
// component only drives the UI + Stripe.js confirmation.
import { useEffect, useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;
const PRICE = { verified: 5, home: 20 };

const appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#111111', colorBackground: '#ffffff', colorText: '#111111',
    colorDanger: '#b91c1c', fontFamily: "'Space Grotesk', system-ui, sans-serif",
    borderRadius: '12px', spacingUnit: '4px',
  },
  rules: { '.Input': { border: '1.5px solid rgba(17,17,17,.25)', boxShadow: 'none' }, '.Input:focus': { border: '1.5px solid #111111' } },
};

const DICT = {
  es: {
    eyebrow: (p) => (p === 'home' ? 'Destacar en la portada' : 'Verificar propiedad'),
    title: (price) => `US$${price} · 30 días`,
    what: (p) => (p === 'home'
      ? 'Tu propiedad tendrá la insignia Verificada, un pin con estrella en el mapa (nunca se agrupa) y aparecerá en la página de inicio, durante 30 días.'
      : 'Tu propiedad tendrá la insignia Verificada y un pin con estrella en el mapa (nunca se agrupa), durante 30 días.'),
    loading: 'Cargando…', processing: 'Procesando pago…',
    payWith: (price) => `Pagar US$${price} con esta tarjeta`, payNew: (price) => `Pagar US$${price}`,
    otherCard: 'Usar otra tarjeta', backSaved: 'Volver a la tarjeta guardada',
    newHint: 'Ingresá los datos de tu tarjeta. La guardamos de forma segura en Stripe para tu próxima renovación.',
    testHint: '· fecha futura · cualquier CVC', notConfigured: 'El pago no está configurado.',
    okTitle: (p) => (p === 'home' ? '¡Tu propiedad está en la portada!' : '¡Propiedad verificada!'),
    okUntil: (d) => `Estará activa hasta el ${d}.`, done: 'Listo',
    errTitle: 'El pago no se completó', retry: 'Reintentar', close: 'Cerrar', tryAgain: 'Intentá nuevamente.',
    payFail: 'El pago no se completó.', startFail: 'No se pudo iniciar el pago.', confirmFail: 'No se pudo confirmar el pago.', authFail: 'La autenticación de la tarjeta falló.',
    err: { unauthorized: 'Iniciá sesión para destacar tu propiedad.', already_promoted: 'Esta propiedad ya tiene una promoción activa.', not_publishable: 'La propiedad debe estar publicada y completa para destacarla.', forbidden: 'No podés destacar esta propiedad.', not_found: 'No encontramos la propiedad.', stripe_not_configured: 'El pago no está disponible en este momento.' },
    locale: 'es-PY',
  },
  en: {
    eyebrow: (p) => (p === 'home' ? 'Feature on the landing page' : 'Verify property'),
    title: (price) => `US$${price} · 30 days`,
    what: (p) => (p === 'home'
      ? 'Your listing gets the Verified badge, a star pin on the map (never hidden in a cluster) and a spot on the home page, for 30 days.'
      : 'Your listing gets the Verified badge and a star pin on the map (never hidden in a cluster), for 30 days.'),
    loading: 'Loading…', processing: 'Processing payment…',
    payWith: (price) => `Pay US$${price} with this card`, payNew: (price) => `Pay US$${price}`,
    otherCard: 'Use another card', backSaved: 'Back to saved card',
    newHint: 'Enter your card details. We store it securely with Stripe for your next renewal.',
    testHint: '· future date · any CVC', notConfigured: 'Payments are not configured.',
    okTitle: (p) => (p === 'home' ? 'Your listing is on the landing page!' : 'Property verified!'),
    okUntil: (d) => `Active until ${d}.`, done: 'Done',
    errTitle: 'Payment did not complete', retry: 'Try again', close: 'Close', tryAgain: 'Please try again.',
    payFail: 'Payment did not complete.', startFail: 'Could not start the payment.', confirmFail: 'Could not confirm the payment.', authFail: 'Card authentication failed.',
    err: { unauthorized: 'Log in to feature your property.', already_promoted: 'This property already has an active promotion.', not_publishable: 'The property must be published and complete to feature it.', forbidden: "You can't feature this property.", not_found: 'Property not found.', stripe_not_configured: 'Payments are unavailable right now.' },
    locale: 'en-US',
  },
};

const brandLabel = (b) => ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' }[b] || (b ? b[0].toUpperCase() + b.slice(1) : 'Card'));

// New-card form (rendered inside <Elements>).
function CardForm({ onDone, t, price }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { setErr(error.message || t.payFail); setBusy(false); return; }
    if (paymentIntent && paymentIntent.status === 'succeeded') { onDone(paymentIntent.id); return; }
    setErr(t.payFail); setBusy(false);
  };
  return (
    <div>
      <div className="bg-white border-[1.5px] border-ink/25 rounded-[16px] p-4">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      <div className="font-mono text-[11px] text-ink/45 mt-3 flex items-center gap-2">
        <span className="border border-ink/30 rounded-[6px] px-2 py-0.5 font-medium">test</span>
        4242 4242 4242 4242 {t.testHint}
      </div>
      {err && <div className="mt-3 text-[12px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">{err}</div>}
      <button onClick={pay} disabled={busy || !stripe} className="mt-4 w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] disabled:opacity-60">
        {busy ? t.processing : t.payNew(price)}
      </button>
    </div>
  );
}

export default function HighlightModal({ propertyId, plan = 'verified', lang = 'es', propertyLabel, onClose, onSuccess }) {
  const t = DICT[lang] || DICT.es;
  const price = PRICE[plan] || PRICE.verified;
  const [phase, setPhase] = useState('loading'); // loading | choose | card | processing | success | error
  const [savedCard, setSavedCard] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const [until, setUntil] = useState('');

  // Create a fresh PaymentIntent for a new card.
  const startNewCard = useCallback(async () => {
    setError(''); setPhase('loading');
    try {
      const r = await fetch('/api/highlight/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, plan }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.clientSecret) { setError(t.err[j.error] || t.startFail); setPhase('error'); return; }
      setClientSecret(j.clientSecret); setPhase('card');
    } catch { setError(t.startFail); setPhase('error'); }
  }, [propertyId, plan, t]);

  // Server-side authoritative confirm after a client success.
  const serverConfirm = useCallback(async (piId) => {
    setPhase('processing');
    try {
      const r = await fetch('/api/highlight/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, paymentIntentId: piId }) });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'succeeded') { const u = j.promotionUntil || j.highlightUntil; setUntil(u); setPhase('success'); onSuccess && onSuccess(u); }
      else { setError(j.error || t.payFail); setPhase('error'); }
    } catch { setError(t.confirmFail); setPhase('error'); }
  }, [propertyId, onSuccess, t]);

  // One-click charge on the saved card.
  const paySaved = useCallback(async () => {
    setPhase('processing'); setError('');
    try {
      const r = await fetch('/api/highlight/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, plan, useSavedCard: true }) });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'succeeded') { const u = j.promotionUntil || j.highlightUntil; setUntil(u); setPhase('success'); onSuccess && onSuccess(u); return; }
      if (j.status === 'requires_action' && j.clientSecret && stripePromise) {
        const stripe = await stripePromise;
        const { error, paymentIntent } = await stripe.handleNextAction({ clientSecret: j.clientSecret });
        if (error) { setError(error.message || t.authFail); setPhase('error'); return; }
        if (paymentIntent && paymentIntent.status === 'succeeded') { await serverConfirm(paymentIntent.id); return; }
        setError(t.payFail); setPhase('error'); return;
      }
      setError(j.error || t.err[j.error] || t.payFail); setPhase('error');
    } catch { setError(t.payFail); setPhase('error'); }
  }, [propertyId, plan, onSuccess, serverConfirm, t]);

  // On mount: with a saved card, charge it straight away — no extra confirm screen
  // (card management lives in /cuenta/pagos). No saved card → open the new-card form.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/account/payments');
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (j?.card?.last4) { setSavedCard(j.card); paySaved(); }
        else { await startNewCard(); }
      } catch { if (alive) await startNewCard(); }
    })();
    return () => { alive = false; };
  }, [startNewCard, paySaved]);

  const fmtUntil = (iso) => { try { return new Date(iso).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto cl-scroll bg-ink/60 backdrop-blur-sm" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="relative w-full max-w-[460px] my-4 bg-paper rounded-[22px] border-[1.5px] border-ink/15 shadow-2xl p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label={t.close} className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-full hover:bg-ink/5 text-ink/50 text-lg">×</button>

        <div className="font-mono text-[11px] uppercase tracking-label text-ink/45 mb-1">{t.eyebrow(plan)}</div>
        <h2 className="text-[24px] font-bold tracking-head leading-tight mb-1">{t.title(price)}</h2>
        {propertyLabel && <p className="text-[13px] text-ink/55 mb-5 truncate">{propertyLabel}</p>}

        {phase === 'loading' && <div className="py-10 text-center text-ink/50 text-[14px]">{t.loading}</div>}

        {phase === 'card' && clientSecret && stripePromise && (
          <div>
            <div className="text-[13px] text-ink/55 mb-4">{t.newHint}</div>
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <CardForm onDone={serverConfirm} t={t} price={price} />
            </Elements>
            {savedCard && <button onClick={() => setPhase('choose')} className="w-full mt-2 py-2.5 text-[13px] font-medium text-ink/60 hover:text-ink underline underline-offset-2">{t.backSaved}</button>}
          </div>
        )}
        {phase === 'card' && !stripePromise && <div className="py-6 text-center text-[13px] text-red-700">{t.notConfigured}</div>}

        {phase === 'processing' && <div className="py-10 text-center text-ink/60 text-[14px]">{t.processing}</div>}

        {phase === 'success' && (
          <div className="py-6 text-center">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-emerald-100 text-emerald-700 text-2xl mb-4">✓</div>
            <div className="text-[18px] font-bold tracking-head mb-1">{t.okTitle(plan)}</div>
            <div className="text-[13px] text-ink/55 mb-6">{t.okUntil(fmtUntil(until))}</div>
            <button onClick={onClose} className="w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px]">{t.done}</button>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-4 text-center">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-red-100 text-red-700 text-2xl mb-4">!</div>
            <div className="text-[15px] font-semibold mb-1">{t.errTitle}</div>
            <div className="text-[13px] text-ink/60 mb-6">{error || t.tryAgain}</div>
            <div className="flex gap-2">
              <button onClick={() => (savedCard ? paySaved() : startNewCard())} className="flex-1 py-3 bg-ink text-paper rounded-pill font-bold text-[14px]">{t.retry}</button>
              <button onClick={onClose} className="flex-1 py-3 border-[1.5px] border-ink/25 rounded-pill font-bold text-[14px]">{t.close}</button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
