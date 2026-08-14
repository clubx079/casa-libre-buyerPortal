'use client';
// Embedded Stripe Payment Element for the Publicar payment step. Creates a
// PaymentIntent for the chosen plan, renders the card form (Casa Libre themed),
// and on a successful charge calls onPaid(paymentIntentId).
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

function PayInner({ tierName, durLabel, ivaStr, totalStr, labels, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { setErr(error.message || labels.payError); setBusy(false); return; }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      onPaid(paymentIntent.id);
    } else {
      setErr(labels.payError); setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-7 items-start">
      <div>
        <h1 className="text-[clamp(34px,4.5vw,48px)] font-bold tracking-display leading-[1.05] mb-2">{labels.s3Title}</h1>
        <p className="text-[16px] text-ink/55 mb-7">{labels.s3Sub}</p>
        <div className="bg-card border-[1.5px] border-ink/35 rounded-[18px] p-6">
          <PaymentElement options={{ layout: 'tabs' }} />
          <div className="font-mono text-[11px] text-ink/45 flex items-center gap-2 mt-4">
            <span className="border border-ink/30 rounded-[6px] px-2 py-0.5 font-medium">stripe test</span>{labels.testCard}
          </div>
        </div>
      </div>
      <div className="bg-ink text-paper rounded-[20px] p-[26px]">
        <div className="font-mono text-[11px] uppercase tracking-label text-paper/50 mb-3.5">{labels.sumTitle}</div>
        <div className="flex justify-between text-[15px] mb-2"><span>{labels.sumPlanLabel}</span><span className="font-semibold">{tierName}</span></div>
        <div className="flex justify-between text-[15px] mb-2"><span>{labels.sumDurLabel}</span><span className="font-semibold">{durLabel}</span></div>
        <div className="flex justify-between text-[15px] pb-3.5 border-b border-paper/25 mb-3.5"><span>IVA (10%)</span><span className="font-semibold">{ivaStr}</span></div>
        <div className="flex justify-between items-baseline mb-5"><span className="text-[15px]">Total</span><span className="text-[28px] font-bold tracking-head">{totalStr}</span></div>
        <button onClick={pay} disabled={busy || !stripe} className="w-full text-center py-4 bg-paper text-ink rounded-pill font-bold text-[15px] disabled:opacity-60">{busy ? labels.paying : labels.payBtn}</button>
        <div className="text-center font-mono text-[10.5px] text-paper/40 mt-3">{labels.payNote}</div>
        {err && <div className="mt-3 text-[12px] font-medium text-red-200 bg-red-900/40 border border-red-300/30 rounded-[10px] px-3 py-2">{err}</div>}
      </div>
    </div>
  );
}

export default function StripePayment({ plan, tierName, durLabel, ivaStr, totalStr, labels, onPaid }) {
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }),
        });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok || !j.clientSecret) { setError(j.error === 'unauthorized' ? labels.needLogin : labels.initError); return; }
        setClientSecret(j.clientSecret);
      } catch { if (alive) setError(labels.initError); }
    })();
    return () => { alive = false; };
  }, [plan, labels.initError, labels.needLogin]);

  if (error) return <div className="text-[14px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3">{error}</div>;
  if (!stripePromise) return <div className="text-[14px] text-ink/60">{labels.initError}</div>;
  if (!clientSecret) return <div className="text-[14px] text-ink/50 py-10 text-center">{labels.loadingPay}</div>;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
      <PayInner tierName={tierName} durLabel={durLabel} ivaStr={ivaStr} totalStr={totalStr} labels={labels} onPaid={onPaid} />
    </Elements>
  );
}
