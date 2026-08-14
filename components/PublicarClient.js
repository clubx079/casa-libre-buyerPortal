'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import StripePayment from '@/components/StripePayment';

const TIERS = {
  basico: { gs: 75000, usd: 10, dur: 30 },
  destacado: { gs: 150000, usd: 20, dur: 45 },
  premium: { gs: 290000, usd: 39, dur: 60 },
};

const DICT = {
  es: {
    navBack: 'Ver propiedades', stepLabels: ['Detalles', 'Plan', 'Pago', 'Listo'],
    s1Title: 'Publicá tu propiedad', s1TitleSerif: 'en minutos.',
    s1Sub: 'Contanos sobre tu propiedad. Se publica al instante en el marketplace.',
    opVenta: 'Vender', opAlquiler: 'Alquilar',
    fType: 'Tipo de propiedad', types: [['casa', 'Casa'], ['departamento', 'Departamento'], ['duplex', 'Dúplex'], ['terreno', 'Terreno']],
    fHood: 'Barrio', fHoodPh: 'Villa Morra, Recoleta…', fCity: 'Ciudad', fCityPh: 'Asunción',
    fPrice: (m) => (m === 'venta' ? 'Precio' : 'Alquiler mensual'), fPricePh: (m) => (m === 'venta' ? '145.000' : '4.500.000'),
    fArea: 'Superficie (m²)', fDesc: 'Descripción', fDescPh: 'Depto luminoso con balcón, a 2 cuadras del Shopping del Sol…',
    fName: 'Tu nombre', fNamePh: 'Ana Giménez', fPhone: 'WhatsApp / teléfono', fPhonePh: '0981 123 456',
    fPhotos: 'Arrastrá o elegí tus fotos', fPhotosSub: 'mín. 4 fotos · JPG o PNG · las fotos reales venden más rápido',
    photosChosen: (n) => `${n} foto${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}`,
    s2Title: 'Elegí tu plan', s2TitleSerif: 'de publicación.',
    s2Sub: 'Todos los planes publican al instante. Sin comisión por venta.',
    tierNames: { basico: 'Básico', destacado: 'Destacado', premium: 'Premium' }, popularLabel: 'Más elegido',
    tierFeats: {
      basico: ['Publicación por 30 días', 'Hasta 10 fotos', 'Chat con interesados', 'Aparece en el mapa'],
      destacado: ['Publicación por 45 días', 'Hasta 20 fotos', 'Borde destacado en resultados', 'Prioridad en búsquedas', 'Estadísticas de visitas'],
      premium: ['Publicación por 60 días', 'Fotos ilimitadas', 'Destacado en la portada', 'Primero en el mapa y búsquedas', 'Asesor dedicado'],
    },
    pickLabel: 'Elegir', pickedLabel: 'Elegido ✓',
    s3Title: 'Pago seguro.', s3Sub: 'Pagá con tarjeta. Procesado por Stripe. Tu propiedad se publica al confirmar.',
    sumTitle: 'Resumen', sumPlanLabel: 'Plan', sumDurLabel: 'Duración', dur: (d) => `${d} días`,
    payBtn: 'Pagar y publicar', paying: 'Procesando…', payNote: 'Se publica al instante en el marketplace',
    testCard: 'modo prueba · usá la tarjeta 4242 4242 4242 4242', payError: 'No se pudo procesar el pago. Revisá los datos.',
    initError: 'No se pudo iniciar el pago. Intentá de nuevo.', loadingPay: 'Cargando pago seguro…', needLogin: 'Ingresá para pagar y publicar.',
    gateTitle: 'Ingresá para publicar', gateSub: 'Creá tu cuenta o ingresá para publicar y gestionar tus propiedades.', gateBtn: 'Ingresar / Crear cuenta',
    publishError: 'El pago se procesó pero hubo un error al publicar. Escribinos y lo resolvemos.',
    s4Title: '¡Tu propiedad está', s4TitleSerif: 'publicada!',
    s4Sub: 'Ya aparece en el marketplace de Casa Libre. Compartí el enlace con quien quieras.',
    s4View: 'Ver mi propiedad', s4Btn1: 'Ver propiedades', s4Btn2: 'Publicar otra',
    backLabel: '← Atrás', nextLabels: ['Continuar →', 'Continuar al pago →'],
    errType: 'Elegí un tipo de propiedad', errHood: 'Ingresá el barrio', errPrice: 'Ingresá un precio válido',
    errSubmit: 'No se pudo publicar. Intentá de nuevo.',
    fmtGs: (v) => '₲ ' + v.toLocaleString('es-PY'), fmtUsd: (v) => '≈ US$ ' + v, locale: 'es-PY',
  },
  en: {
    navBack: 'Browse listings', stepLabels: ['Details', 'Plan', 'Payment', 'Done'],
    s1Title: 'List your property', s1TitleSerif: 'in minutes.',
    s1Sub: 'Tell us about your property. It goes live in the marketplace instantly.',
    opVenta: 'Sell', opAlquiler: 'Rent out',
    fType: 'Property type', types: [['casa', 'House'], ['departamento', 'Apartment'], ['duplex', 'Duplex'], ['terreno', 'Lot']],
    fHood: 'Neighborhood', fHoodPh: 'Villa Morra, Recoleta…', fCity: 'City', fCityPh: 'Asunción',
    fPrice: (m) => (m === 'venta' ? 'Price' : 'Monthly rent'), fPricePh: (m) => (m === 'venta' ? '145,000' : '4,500,000'),
    fArea: 'Area (m²)', fDesc: 'Description', fDescPh: 'Bright apartment with balcony, 2 blocks from Shopping del Sol…',
    fName: 'Your name', fNamePh: 'Ana Giménez', fPhone: 'WhatsApp / phone', fPhonePh: '0981 123 456',
    fPhotos: 'Drag or choose your photos', fPhotosSub: 'min. 4 photos · JPG or PNG · real photos sell faster',
    photosChosen: (n) => `${n} photo${n === 1 ? '' : 's'} selected`,
    s2Title: 'Choose your', s2TitleSerif: 'listing plan.',
    s2Sub: 'Every plan goes live instantly. No commission on sale.',
    tierNames: { basico: 'Basic', destacado: 'Highlighted', premium: 'Featured' }, popularLabel: 'Most popular',
    tierFeats: {
      basico: ['Live for 30 days', 'Up to 10 photos', 'Chat with buyers', 'Shows on the map'],
      destacado: ['Live for 45 days', 'Up to 20 photos', 'Highlighted border in results', 'Priority in search', 'Visit statistics'],
      premium: ['Live for 60 days', 'Unlimited photos', 'Featured on the homepage', 'First on map & search', 'Dedicated advisor'],
    },
    pickLabel: 'Choose', pickedLabel: 'Selected ✓',
    s3Title: 'Secure payment.', s3Sub: 'Pay by card. Processed by Stripe. Your listing publishes on confirm.',
    sumTitle: 'Summary', sumPlanLabel: 'Plan', sumDurLabel: 'Duration', dur: (d) => `${d} days`,
    payBtn: 'Pay & publish', paying: 'Processing…', payNote: 'Goes live in the marketplace instantly',
    testCard: 'test mode · use card 4242 4242 4242 4242', payError: 'Payment could not be processed. Check your details.',
    initError: 'Could not start payment. Please try again.', loadingPay: 'Loading secure payment…', needLogin: 'Log in to pay & publish.',
    gateTitle: 'Log in to post', gateSub: 'Create an account or log in to post and manage your properties.', gateBtn: 'Log in / Sign up',
    publishError: 'Payment went through but publishing failed. Contact us and we’ll fix it.',
    s4Title: 'Your listing is', s4TitleSerif: 'live!',
    s4Sub: 'It already shows in the Casa Libre marketplace. Share the link with anyone.',
    s4View: 'View my listing', s4Btn1: 'Browse listings', s4Btn2: 'List another',
    backLabel: '← Back', nextLabels: ['Continue →', 'Continue to payment →'],
    errType: 'Choose a property type', errHood: 'Enter the neighborhood', errPrice: 'Enter a valid price',
    errSubmit: 'Could not publish. Please try again.',
    fmtGs: (v) => '₲ ' + v.toLocaleString('en-US'), fmtUsd: (v) => '≈ US$ ' + v, locale: 'en-US',
  },
};

const inputCls = 'px-4 py-[13px] border-[1.5px] border-ink/35 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink';
const labelCls = 'flex flex-col gap-[7px] text-[13px] font-semibold';

export default function PublicarClient() {
  const [lang, setLang] = useLang();
  const { user, loading, openAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('venta');
  const [tier, setTier] = useState('destacado');
  const [f, setF] = useState({ ptype: 'casa', neighborhood: '', city: '', price: '', currency: '', area: '', description: '', contact_name: '', contact_phone: '' });
  const [photos, setPhotos] = useState([]); // {file, url}
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {ref, slug}
  const fileRef = useRef(null);
  const t = DICT[lang];

  // Prefill contact from the logged-in user (only if the fields are still empty).
  useEffect(() => {
    if (!user) return;
    setF((s) => ({ ...s, contact_name: s.contact_name || user.full_name || '', contact_phone: s.contact_phone || user.phone || '' }));
  }, [user]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const addPhotos = (list) => {
    const files = Array.from(list || []).filter((x) => x.type.startsWith('image/'));
    setPhotos((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 20));
  };
  const removePhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const sel = TIERS[tier];
  const iva = Math.round(sel.gs * 0.1);
  const total = sel.gs + iva;
  const priceCurrency = f.currency || (mode === 'alquiler' ? 'PYG' : 'USD');

  const validateStep1 = () => {
    if (!f.ptype) return t.errType;
    if (!f.neighborhood.trim()) return t.errHood;
    const p = Number(String(f.price).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(p) || p <= 0) return t.errPrice;
    return '';
  };
  const next = () => {
    if (step === 1) { const e = validateStep1(); if (e) { setErr(e); return; } }
    setErr(''); setStep((s) => Math.min(4, s + 1));
  };
  const back = () => { setErr(''); setStep((s) => Math.max(1, s - 1)); };

  // Called by StripePayment after a successful charge — now create the listing.
  const publishListing = async (paymentIntentId) => {
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.set('mode', mode);
      fd.set('ptype', f.ptype);
      fd.set('neighborhood', f.neighborhood);
      fd.set('city', f.city);
      fd.set('price', f.price);
      fd.set('currency', priceCurrency);
      fd.set('area', f.area);
      fd.set('description', f.description);
      fd.set('contact_name', f.contact_name);
      fd.set('contact_phone', f.contact_phone);
      fd.set('plan', tier);
      if (paymentIntentId) fd.set('payment_intent', paymentIntentId);
      photos.forEach((p) => fd.append('photos', p.file));
      const res = await fetch('/api/publish', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
      setResult({ ref: j.ref, slug: j.slug });
      setStep(4);
    } catch {
      setErr(t.publishError);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep(1); setMode('venta'); setTier('destacado'); setResult(null); setErr('');
    setF({ ptype: 'casa', neighborhood: '', city: '', price: '', currency: '', area: '', description: '', contact_name: '', contact_phone: '' });
    setPhotos([]);
  };

  const stepper = t.stepLabels.map((label, i) => {
    const n = i + 1, active = step === n, done = step > n;
    return { n: done ? '✓' : String(n), label, active, done, go: () => { if (n < step) setStep(n); } };
  });

  const nav = (
    <nav className="flex items-center justify-between flex-wrap gap-3 px-5 md:px-11 py-5 border-b border-ink/12">
      <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif not-italic italic font-normal">.py</em></Link>
      <div className="flex items-center gap-3.5">
        <div className="flex items-center border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
          {['es', 'en'].map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>
          ))}
        </div>
        <Link href="/propiedades" className="text-[14px] font-medium px-[18px] py-2.5 border border-ink rounded-pill">{t.navBack}</Link>
      </div>
    </nav>
  );

  // Gate the whole flow behind login so every published deal has an owner.
  if (!loading && !user) {
    return (
      <div className="max-w-[1440px] mx-auto min-h-screen">
        {nav}
        <div className="max-w-[520px] mx-auto px-5 py-24 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.png" alt="" className="w-[130px] object-contain mx-auto mb-4" />
          <h1 className="text-[clamp(30px,4.5vw,42px)] font-bold tracking-display leading-tight mb-2">{t.gateTitle}</h1>
          <p className="text-[16px] text-ink/55 mb-7">{t.gateSub}</p>
          <button onClick={() => openAuth()} className="px-8 py-4 bg-ink text-paper font-semibold text-[15px] rounded-pill shadow-hard-soft">{t.gateBtn}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto min-h-screen">
      {nav}

      <div className="max-w-[860px] mx-auto px-5 md:px-11 pt-10 pb-24">
        {/* STEPPER */}
        <div className="flex items-center gap-3.5 mb-11 flex-wrap">
          {stepper.map((s, i) => (
            <button key={i} onClick={s.go} className="flex items-center gap-2 cursor-pointer">
              <span className={`w-7 h-7 rounded-pill inline-flex items-center justify-center text-[13px] font-bold border-[1.5px] ${s.active || s.done ? 'bg-ink text-paper border-ink' : 'text-ink/40 border-ink/30'}`}>{s.n}</span>
              <span className={`text-[13.5px] ${s.active ? 'font-bold text-ink' : 'font-medium text-ink/45'}`}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* STEP 1 — DETAILS */}
        {step === 1 && (
          <div>
            <h1 className="text-[clamp(34px,4.5vw,48px)] font-bold tracking-display leading-[1.05] mb-2">{t.s1Title} <span className="font-serif italic font-normal">{t.s1TitleSerif}</span></h1>
            <p className="text-[16px] text-ink/55 mb-8">{t.s1Sub}</p>
            <div className="flex gap-2.5 mb-6">
              {[['venta', t.opVenta], ['alquiler', t.opAlquiler]].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} className={`px-[22px] py-2.5 rounded-pill text-[14px] font-semibold border-[1.5px] border-ink ${mode === m ? 'bg-ink text-paper' : 'bg-transparent'}`}>{label}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelCls}>{t.fType}
                <select value={f.ptype} onChange={set('ptype')} className={`${inputCls} cursor-pointer`}>
                  {t.types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className={labelCls}>{t.fHood}
                <input value={f.neighborhood} onChange={set('neighborhood')} placeholder={t.fHoodPh} className={inputCls} />
              </label>
              <label className={labelCls}>{t.fCity}
                <input value={f.city} onChange={set('city')} placeholder={t.fCityPh} className={inputCls} />
              </label>
              <label className={labelCls}>{t.fPrice(mode)}
                <div className="flex gap-2">
                  <input value={f.price} onChange={set('price')} inputMode="numeric" placeholder={t.fPricePh(mode)} className={`${inputCls} flex-1 min-w-0`} />
                  <select value={priceCurrency} onChange={set('currency')} className={`${inputCls} cursor-pointer w-[92px]`}>
                    <option value="USD">US$</option>
                    <option value="PYG">₲</option>
                  </select>
                </div>
              </label>
              <label className={labelCls}>{t.fArea}
                <input value={f.area} onChange={set('area')} inputMode="numeric" placeholder="120" className={inputCls} />
              </label>
              <label className={labelCls}>{t.fName}
                <input value={f.contact_name} onChange={set('contact_name')} placeholder={t.fNamePh} className={inputCls} />
              </label>
              <label className={labelCls}>{t.fPhone}
                <input value={f.contact_phone} onChange={set('contact_phone')} placeholder={t.fPhonePh} className={inputCls} />
              </label>
            </div>
            <label className={`${labelCls} mt-4`}>{t.fDesc}
              <textarea value={f.description} onChange={set('description')} rows={4} placeholder={t.fDescPh} className={`${inputCls} resize-y`} />
            </label>

            {/* PHOTOS */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}
              className="mt-[22px] border-[1.5px] border-dashed border-ink/35 rounded-[18px] p-[26px] text-center bg-card cursor-pointer hover:border-ink transition-colors"
            >
              <div className="text-[15px] font-semibold mb-1">{t.fPhotos}</div>
              <div className="font-mono text-[12px] text-ink/45">{photos.length ? t.photosChosen(photos.length) : t.fPhotosSub}</div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden border border-ink/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    <button onClick={(e) => { e.stopPropagation(); removePhoto(i); }} className="absolute top-1 right-1 w-5 h-5 rounded-pill bg-ink text-paper text-[11px] leading-none flex items-center justify-center">×</button>
                    {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] font-semibold bg-ink text-paper px-1.5 py-0.5 rounded-pill">1ª</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — PLAN */}
        {step === 2 && (
          <div>
            <h1 className="text-[clamp(34px,4.5vw,48px)] font-bold tracking-display leading-[1.05] mb-2">{t.s2Title} <span className="font-serif italic font-normal">{t.s2TitleSerif}</span></h1>
            <p className="text-[16px] text-ink/55 mb-8">{t.s2Sub}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[18px] items-stretch">
              {['basico', 'destacado', 'premium'].map((k) => {
                const on = tier === k;
                return (
                  <button key={k} onClick={() => setTier(k)} className={`relative flex flex-col text-left bg-card rounded-card p-[26px] transition-all ${on ? 'border-2 border-ink shadow-hard' : 'border-[1.5px] border-ink/25'}`}>
                    {k === 'destacado' && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold bg-ink text-paper px-3.5 py-[5px] rounded-pill whitespace-nowrap">{t.popularLabel}</span>}
                    <div className="text-[17px] font-bold">{t.tierNames[k]}</div>
                    <div className="text-[30px] font-bold tracking-head mt-2.5">{t.fmtGs(TIERS[k].gs)}</div>
                    <div className="font-mono text-[11px] text-ink/45 mb-4">{t.fmtUsd(TIERS[k].usd)} · {t.dur(TIERS[k].dur)}</div>
                    <div className="flex flex-col gap-2.5 text-[13.5px] leading-snug flex-1">
                      {t.tierFeats[k].map((feat, j) => <div key={j} className="flex gap-2"><span>✓</span><span>{feat}</span></div>)}
                    </div>
                    <div className={`mt-[18px] text-center py-3 rounded-pill font-bold text-[14px] border-[1.5px] border-ink ${on ? 'bg-ink text-paper' : ''}`}>{on ? t.pickedLabel : t.pickLabel}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3 — PAYMENT (real Stripe Payment Element) */}
        {step === 3 && (
          busy
            ? <div className="text-center text-ink/50 py-16">{t.paying}</div>
            : <StripePayment
                plan={tier}
                tierName={t.tierNames[tier]}
                durLabel={t.dur(sel.dur)}
                ivaStr={t.fmtGs(iva)}
                totalStr={t.fmtGs(total)}
                onPaid={publishListing}
                labels={{
                  s3Title: t.s3Title, s3Sub: t.s3Sub, sumTitle: t.sumTitle, sumPlanLabel: t.sumPlanLabel,
                  sumDurLabel: t.sumDurLabel, payBtn: t.payBtn, paying: t.paying, payNote: t.payNote,
                  testCard: t.testCard, payError: t.payError, initError: t.initError, loadingPay: t.loadingPay, needLogin: t.needLogin,
                }}
              />
        )}

        {/* STEP 4 — CONFIRMATION */}
        {step === 4 && (
          <div className="text-center py-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot.png" alt="" className="w-[170px] object-contain mx-auto mb-2.5" />
            <h1 className="text-[clamp(36px,5vw,54px)] font-bold tracking-display leading-[1.03] mb-2.5">{t.s4Title} <span className="font-serif italic font-normal">{t.s4TitleSerif}</span></h1>
            <p className="text-[17px] text-ink/55 max-w-[440px] mx-auto mb-2.5">{t.s4Sub}</p>
            <div className="font-mono text-[12px] text-ink/45 mb-7">REF: {result?.ref} · plan {t.tierNames[tier]}</div>
            <div className="flex gap-3 justify-center flex-wrap">
              {result?.slug && <Link href={`/propiedad/${result.slug}`} className="px-8 py-4 bg-ink text-paper font-semibold text-[15px] rounded-pill shadow-hard-soft">{t.s4View}</Link>}
              <Link href="/propiedades" className="px-8 py-4 border-2 border-ink font-semibold text-[15px] rounded-pill">{t.s4Btn1}</Link>
              <button onClick={restart} className="px-8 py-4 border-2 border-ink font-semibold text-[15px] rounded-pill">{t.s4Btn2}</button>
            </div>
          </div>
        )}

        {err && <div className="mt-6 text-[14px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3">{err}</div>}

        {/* FOOTER NAV — steps 1 & 2 */}
        {step < 3 && (
          <div className="flex justify-between mt-11 pt-6 border-t border-ink/15">
            <button onClick={back} className={`px-[26px] py-3.5 border-[1.5px] border-ink/35 rounded-pill font-semibold text-[14px] ${step === 1 ? 'invisible' : ''}`}>{t.backLabel}</button>
            <button onClick={next} className="px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft">{step === 2 ? t.nextLabels[1] : t.nextLabels[0]}</button>
          </div>
        )}
      </div>
    </div>
  );
}
