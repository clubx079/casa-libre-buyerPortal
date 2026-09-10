'use client';
// Add / change the saved card from /cuenta/pagos. Uses a Stripe SetupIntent (vaults
// the card WITHOUT charging) + the Payment Element, then saves it as the default via
// PUT /api/account/card. Bilingual, brand appearance.
import { useEffect, useState } from 'react';
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

const DICT = {
  es: { eyebrow: 'Tarjeta', title: 'Cambiar tarjeta', hint: 'Ingresá tu nueva tarjeta. La guardamos de forma segura en Stripe y reemplaza la anterior. No se cobra nada ahora.', testHint: '· fecha futura · cualquier CVC', save: 'Guardar tarjeta', saving: 'Guardando…', loading: 'Cargando…', okTitle: '¡Tarjeta actualizada!', okSub: 'Usaremos esta tarjeta en tus próximos pagos.', done: 'Listo', errTitle: 'No se pudo guardar', retry: 'Reintentar', close: 'Cerrar', fail: 'No se pudo guardar la tarjeta.', startFail: 'No se pudo iniciar. Intentá de nuevo.', notConfigured: 'El pago no está configurado.' },
  en: { eyebrow: 'Card', title: 'Change card', hint: 'Enter your new card. We store it securely with Stripe and it replaces the old one. Nothing is charged now.', testHint: '· future date · any CVC', save: 'Save card', saving: 'Saving…', loading: 'Loading…', okTitle: 'Card updated!', okSub: "We'll use this card for your next payments.", done: 'Done', errTitle: "Couldn't save", retry: 'Try again', close: 'Close', fail: "Couldn't save the card.", startFail: "Couldn't start. Please try again.", notConfigured: 'Payments are not configured.' },
};

function SetupForm({ onDone, t }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (error) { setErr(error.message || t.fail); setBusy(false); return; }
    if (setupIntent && setupIntent.status === 'succeeded') { onDone(setupIntent.id); return; }
    setErr(t.fail); setBusy(false);
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
      <button onClick={save} disabled={busy || !stripe} className="mt-4 w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] disabled:opacity-60">
        {busy ? t.saving : t.save}
      </button>
    </div>
  );
}

export default function CardModal({ lang = 'es', onClose, onSaved }) {
  const t = DICT[lang] || DICT.es;
  const [phase, setPhase] = useState('loading'); // loading | form | saving | success | error
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/account/card', { method: 'POST' });
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (j.clientSecret) { setClientSecret(j.clientSecret); setPhase('form'); }
        else { setError(t.startFail); setPhase('error'); }
      } catch { if (alive) { setError(t.startFail); setPhase('error'); } }
    })();
    return () => { alive = false; };
  }, [t]);

  const confirmSaved = async (siId) => {
    setPhase('saving');
    try {
      const r = await fetch('/api/account/card', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setupIntentId: siId }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { setPhase('success'); onSaved && onSaved(j.card); }
      else { setError(t.fail); setPhase('error'); }
    } catch { setError(t.fail); setPhase('error'); }
  };

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto cl-scroll bg-ink/60 backdrop-blur-sm" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="relative w-full max-w-[460px] my-4 bg-paper rounded-[22px] border-[1.5px] border-ink/15 shadow-2xl p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} aria-label={t.close} className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-full hover:bg-ink/5 text-ink/50 text-lg">×</button>

          <div className="font-mono text-[11px] uppercase tracking-label text-ink/45 mb-1">{t.eyebrow}</div>
          <h2 className="text-[22px] font-bold tracking-head leading-tight mb-4">{t.title}</h2>

          {phase === 'loading' && <div className="py-10 text-center text-ink/50 text-[14px]">{t.loading}</div>}

          {phase === 'form' && clientSecret && stripePromise && (
            <div>
              <div className="text-[13px] text-ink/55 mb-4">{t.hint}</div>
              <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                <SetupForm onDone={confirmSaved} t={t} />
              </Elements>
            </div>
          )}
          {phase === 'form' && !stripePromise && <div className="py-6 text-center text-[13px] text-red-700">{t.notConfigured}</div>}

          {phase === 'saving' && <div className="py-10 text-center text-ink/60 text-[14px]">{t.saving}</div>}

          {phase === 'success' && (
            <div className="py-6 text-center">
              <div className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-emerald-100 text-emerald-700 text-2xl mb-4">✓</div>
              <div className="text-[18px] font-bold tracking-head mb-1">{t.okTitle}</div>
              <div className="text-[13px] text-ink/55 mb-6">{t.okSub}</div>
              <button onClick={onClose} className="w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px]">{t.done}</button>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-4 text-center">
              <div className="w-14 h-14 mx-auto grid place-items-center rounded-full bg-red-100 text-red-700 text-2xl mb-4">!</div>
              <div className="text-[15px] font-semibold mb-1">{t.errTitle}</div>
              <div className="text-[13px] text-ink/60 mb-6">{error || t.fail}</div>
              <div className="flex gap-2">
                <button onClick={() => window.location.reload()} className="flex-1 py-3 bg-ink text-paper rounded-pill font-bold text-[14px]">{t.retry}</button>
                <button onClick={onClose} className="flex-1 py-3 border-[1.5px] border-ink/25 rounded-pill font-bold text-[14px]">{t.close}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
