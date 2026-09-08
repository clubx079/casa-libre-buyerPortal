'use client';
// Reusable "Destacar propiedad" (highlight) payment modal — used by the sell
// wizard AND the dashboard. Flat US$5 → 30-day highlight.
//   • If the user has a saved card → one-click charge (off_session on the server).
//   • Otherwise → the Stripe Payment Element; the card is vaulted for next time.
// The server (/api/highlight/*) is authoritative for granting the highlight; this
// component only drives the UI + Stripe.js confirmation.
import { useEffect, useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;

const appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#111111', colorBackground: '#ffffff', colorText: '#111111',
    colorDanger: '#b91c1c', fontFamily: "'Space Grotesk', system-ui, sans-serif",
    borderRadius: '12px', spacingUnit: '4px',
  },
  rules: { '.Input': { border: '1.5px solid rgba(17,17,17,.25)', boxShadow: 'none' }, '.Input:focus': { border: '1.5px solid #111111' } },
};

function mapErr(code) {
  switch (code) {
    case 'unauthorized': return 'Iniciá sesión para destacar tu propiedad.';
    case 'already_highlighted': return 'Esta propiedad ya está destacada.';
    case 'not_publishable': return 'La propiedad debe estar publicada y completa para destacarla.';
    case 'forbidden': return 'No podés destacar esta propiedad.';
    case 'not_found': return 'No encontramos la propiedad.';
    case 'stripe_not_configured': return 'El pago no está disponible en este momento.';
    default: return '';
  }
}

const brandLabel = (b) => ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' }[b] || (b ? b[0].toUpperCase() + b.slice(1) : 'Tarjeta'));

// New-card form (rendered inside <Elements>).
function CardForm({ onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { setErr(error.message || 'El pago no pudo completarse.'); setBusy(false); return; }
    if (paymentIntent && paymentIntent.status === 'succeeded') { onDone(paymentIntent.id); return; }
    setErr('El pago no se completó.'); setBusy(false);
  };
  return (
    <div>
      <div className="bg-white border-[1.5px] border-ink/25 rounded-[16px] p-4">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      <div className="font-mono text-[11px] text-ink/45 mt-3 flex items-center gap-2">
        <span className="border border-ink/30 rounded-[6px] px-2 py-0.5 font-medium">test</span>
        4242 4242 4242 4242 · fecha futura · cualquier CVC
      </div>
      {err && <div className="mt-3 text-[12px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">{err}</div>}
      <button onClick={pay} disabled={busy || !stripe} className="mt-4 w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] disabled:opacity-60">
        {busy ? 'Procesando…' : 'Pagar US$5'}
      </button>
    </div>
  );
}

export default function HighlightModal({ propertyId, propertyLabel, onClose, onSuccess }) {
  const [phase, setPhase] = useState('loading'); // loading | choose | card | processing | success | error
  const [savedCard, setSavedCard] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const [until, setUntil] = useState('');

  // Create a fresh PaymentIntent for a new card.
  const startNewCard = useCallback(async () => {
    setError(''); setPhase('loading');
    try {
      const r = await fetch('/api/highlight/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.clientSecret) { setError(mapErr(j.error) || 'No se pudo iniciar el pago.'); setPhase('error'); return; }
      setClientSecret(j.clientSecret); setPhase('card');
    } catch { setError('No se pudo iniciar el pago.'); setPhase('error'); }
  }, [propertyId]);

  // Load the saved card (if any) to decide the first screen.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/account/payments');
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (j?.card?.last4) { setSavedCard(j.card); setPhase('choose'); }
        else { await startNewCard(); }
      } catch { if (alive) await startNewCard(); }
    })();
    return () => { alive = false; };
  }, [startNewCard]);

  // Server-side authoritative confirm after a client success.
  const serverConfirm = useCallback(async (piId) => {
    setPhase('processing');
    try {
      const r = await fetch('/api/highlight/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, paymentIntentId: piId }) });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'succeeded') { setUntil(j.highlightUntil); setPhase('success'); onSuccess && onSuccess(j.highlightUntil); }
      else { setError(j.error || 'El pago no se completó.'); setPhase('error'); }
    } catch { setError('No se pudo confirmar el pago.'); setPhase('error'); }
  }, [propertyId, onSuccess]);

  // One-click charge on the saved card.
  const paySaved = useCallback(async () => {
    setPhase('processing'); setError('');
    try {
      const r = await fetch('/api/highlight/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, useSavedCard: true }) });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'succeeded') { setUntil(j.highlightUntil); setPhase('success'); onSuccess && onSuccess(j.highlightUntil); return; }
      if (j.status === 'requires_action' && j.clientSecret && stripePromise) {
        const stripe = await stripePromise;
        const { error, paymentIntent } = await stripe.handleNextAction({ clientSecret: j.clientSecret });
        if (error) { setError(error.message || 'La autenticación de la tarjeta falló.'); setPhase('error'); return; }
        if (paymentIntent && paymentIntent.status === 'succeeded') { await serverConfirm(paymentIntent.id); return; }
        setError('El pago no se completó.'); setPhase('error'); return;
      }
      setError(j.error || mapErr(j.error) || 'El pago no se completó.'); setPhase('error');
    } catch { setError('El pago no pudo completarse.'); setPhase('error'); }
  }, [propertyId, onSuccess, serverConfirm]);

  const fmtUntil = (iso) => { try { return new Date(iso).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto cl-scroll bg-ink/60 backdrop-blur-sm" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="relative w-full max-w-[460px] my-4 bg-paper rounded-[22px] border-[1.5px] border-ink/15 shadow-2xl p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-full hover:bg-ink/5 text-ink/50 text-lg">×</button>

        <div className="font-mono text-[11px] uppercase tracking-label text-ink/45 mb-1">Destacar propiedad</div>
        <h2 className="text-[24px] font-bold tracking-head leading-tight mb-1">US$5 · 30 días destacada</h2>
        {propertyLabel && <p className="text-[13px] text-ink/55 mb-5 truncate">{propertyLabel}</p>}

        {phase === 'loading' && <div className="py-10 text-center text-ink/50 text-[14px]">Cargando…</div>}

        {phase === 'choose' && savedCard && (
          <div>
            <div className="text-[13px] text-ink/55 mb-3">Tu propiedad aparecerá arriba de todo en el mapa y la lista, con una insignia destacada, durante 30 días.</div>
            <div className="flex items-center justify-between bg-card border-[1.5px] border-ink/20 rounded-[14px] px-4 py-3.5 mb-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-label text-ink/45">{brandLabel(savedCard.brand)}</span>
                <span className="font-semibold tracking-head">•••• {savedCard.last4}</span>
              </div>
              {savedCard.exp_month && <span className="font-mono text-[11px] text-ink/45">{String(savedCard.exp_month).padStart(2, '0')}/{String(savedCard.exp_year).slice(-2)}</span>}
            </div>
            <button onClick={paySaved} className="w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px]">Pagar US$5 con esta tarjeta</button>
            <button onClick={startNewCard} className="w-full mt-2 py-2.5 text-[13px] font-medium text-ink/60 hover:text-ink underline underline-offset-2">Usar otra tarjeta</button>
          </div>
        )}

        {phase === 'card' && clientSecret && stripePromise && (
          <div>
            <div className="text-[13px] text-ink/55 mb-4">Ingresá los datos de tu tarjeta. La guardamos de forma segura en Stripe para tu próximo destacado.</div>
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <CardForm onDone={serverConfirm} />
            </Elements>
            {savedCard && <button onClick={() => setPhase('choose')} className="w-full mt-2 py-2.5 text-[13px] font-medium text-ink/60 hover:text-ink underline underline-offset-2">Volver a la tarjeta guardada</button>}
          </div>
        )}
        {phase === 'card' && !stripePromise && <div className="py-6 text-center text-[13px] text-red-700">El pago no está configurado.</div>}

        {phase === 'processing' && <div className="py-10 text-center text-ink/60 text-[14px]">Procesando pago…</div>}

        {phase === 'success' && (
          <div className="py-6 text-center">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-emerald-100 text-emerald-700 text-2xl mb-4">✓</div>
            <div className="text-[18px] font-bold tracking-head mb-1">¡Propiedad destacada!</div>
            <div className="text-[13px] text-ink/55 mb-6">Estará destacada hasta el {fmtUntil(until)}.</div>
            <button onClick={onClose} className="w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px]">Listo</button>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-4 text-center">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-red-100 text-red-700 text-2xl mb-4">!</div>
            <div className="text-[15px] font-semibold mb-1">El pago no se completó</div>
            <div className="text-[13px] text-ink/60 mb-6">{error || 'Intentá nuevamente.'}</div>
            <div className="flex gap-2">
              <button onClick={() => (savedCard ? setPhase('choose') : startNewCard())} className="flex-1 py-3 bg-ink text-paper rounded-pill font-bold text-[14px]">Reintentar</button>
              <button onClick={onClose} className="flex-1 py-3 border-[1.5px] border-ink/25 rounded-pill font-bold text-[14px]">Cerrar</button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
