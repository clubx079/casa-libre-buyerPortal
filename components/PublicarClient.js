'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import AuthButton from '@/components/AuthButton';
import { track } from '@/lib/analytics';

const DICT = {
  es: {
    navBack: 'Ver propiedades', navBuy: 'Comprar', navRent: 'Alquilar', navSell: 'Vender', navCta: 'Publicar gratis', stepLabels: ['Detalles', 'Listo'],
    s1Title: 'Publicá tu propiedad', s1TitleSerif: 'en minutos.',
    s1Sub: 'Contanos sobre tu propiedad. Se publica al instante en el marketplace.',
    opVenta: 'Vender', opAlquiler: 'Alquilar',
    roleQ: '¿Sos el propietario o un agente?', roleOwner: 'Propietario', roleAgent: 'Agente',
    fType: 'Tipo de propiedad', types: [['casa', 'Casa'], ['departamento', 'Departamento'], ['duplex', 'Dúplex'], ['terreno', 'Terreno']],
    fHood: 'Barrio', fHoodPh: 'Villa Morra, Recoleta…', fCity: 'Ciudad', fCityPh: 'Asunción',
    fPrice: (m) => (m === 'venta' ? 'Precio' : 'Alquiler mensual'), fPricePh: (m) => (m === 'venta' ? '145.000' : '4.500.000'),
    fArea: 'Superficie (m²)', fDesc: 'Descripción', fDescPh: 'Depto luminoso con balcón, a 2 cuadras del Shopping del Sol…',
    fName: 'Tu nombre', fNamePh: 'Ana Giménez', fPhone: 'WhatsApp / teléfono', fPhonePh: '0981 123 456',
    fPhotos: 'Arrastrá o elegí tus fotos', fPhotosSub: 'mín. 4 fotos · JPG o PNG · las fotos reales venden más rápido',
    photosChosen: (n) => `${n} foto${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}`,
    publishBtn: 'Publicar gratis', paying: 'Publicando…', payNote: 'Se publica al instante en el marketplace',
    gateTitle: 'Necesitás una cuenta para publicar', gateSub: 'Creá tu cuenta o ingresá para publicar y gestionar tus propiedades. Podés volver a abrir el ingreso cuando quieras.', gateBtn: 'Ingresar / Crear cuenta',
    s4Title: '¡Tu propiedad está', s4TitleSerif: 'publicada!',
    s4Sub: 'Ya aparece en el marketplace de Casa Libre. Compartí el enlace con quien quieras.',
    s4View: 'Ver mi propiedad', s4Btn1: 'Ver propiedades', s4Btn2: 'Publicar otra',
    backLabel: '← Atrás',
    errType: 'Elegí un tipo de propiedad', errHood: 'Ingresá el barrio', errCity: 'Ingresá la ciudad', errPrice: 'Ingresá un precio válido',
    errPriceFloorSale: 'El precio de venta debe ser de al menos US$ 5.000', errPriceFloorRent: 'El alquiler mensual debe ser de al menos ₲ 300.000',
    errArea: 'Ingresá la superficie (m²)', errAreaRange: 'La superficie debe estar entre 5 y 2.000 m²',
    errName: 'Ingresá tu nombre', errPhone: 'Ingresá un WhatsApp / teléfono válido (mín. 6 dígitos)', errPhotos: 'Agregá al menos una foto',
    errFix: 'Faltan algunos datos. Revisá los campos marcados para publicar.',
    errSubmit: 'No se pudo publicar. Intentá de nuevo.',
    fmtGs: (v) => '₲ ' + v.toLocaleString('es-PY'), fmtUsd: (v) => '≈ US$ ' + v, locale: 'es-PY',
  },
  en: {
    navBack: 'Browse listings', navBuy: 'Buy', navRent: 'Rent', navSell: 'Sell', navCta: 'List for free', stepLabels: ['Details', 'Done'],
    s1Title: 'List your property', s1TitleSerif: 'in minutes.',
    s1Sub: 'Tell us about your property. It goes live in the marketplace instantly.',
    opVenta: 'Sell', opAlquiler: 'Rent out',
    roleQ: 'Are you the owner or an agent?', roleOwner: 'Owner', roleAgent: 'Agent',
    fType: 'Property type', types: [['casa', 'House'], ['departamento', 'Apartment'], ['duplex', 'Duplex'], ['terreno', 'Lot']],
    fHood: 'Neighborhood', fHoodPh: 'Villa Morra, Recoleta…', fCity: 'City', fCityPh: 'Asunción',
    fPrice: (m) => (m === 'venta' ? 'Price' : 'Monthly rent'), fPricePh: (m) => (m === 'venta' ? '145,000' : '4,500,000'),
    fArea: 'Area (m²)', fDesc: 'Description', fDescPh: 'Bright apartment with balcony, 2 blocks from Shopping del Sol…',
    fName: 'Your name', fNamePh: 'Ana Giménez', fPhone: 'WhatsApp / phone', fPhonePh: '0981 123 456',
    fPhotos: 'Drag or choose your photos', fPhotosSub: 'min. 4 photos · JPG or PNG · real photos sell faster',
    photosChosen: (n) => `${n} photo${n === 1 ? '' : 's'} selected`,
    publishBtn: 'Publish for free', paying: 'Publishing…', payNote: 'Goes live in the marketplace instantly',
    gateTitle: 'You need an account to post', gateSub: 'Create an account or log in to post and manage your properties. You can reopen the login anytime.', gateBtn: 'Log in / Sign up',
    s4Title: 'Your listing is', s4TitleSerif: 'live!',
    s4Sub: 'It already shows in the Casa Libre marketplace. Share the link with anyone.',
    s4View: 'View my listing', s4Btn1: 'Browse listings', s4Btn2: 'List another',
    backLabel: '← Back',
    errType: 'Choose a property type', errHood: 'Enter the neighborhood', errCity: 'Enter the city', errPrice: 'Enter a valid price',
    errPriceFloorSale: 'Sale price must be at least US$ 5,000', errPriceFloorRent: 'Monthly rent must be at least ₲ 300,000',
    errArea: 'Enter the area (m²)', errAreaRange: 'Area must be between 5 and 2,000 m²',
    errName: 'Enter your name', errPhone: 'Enter a valid WhatsApp / phone number (min. 6 digits)', errPhotos: 'Add at least one photo',
    errFix: 'Some details are missing. Please fix the highlighted fields to publish.',
    errSubmit: 'Could not publish. Please try again.',
    fmtGs: (v) => '₲ ' + v.toLocaleString('en-US'), fmtUsd: (v) => '≈ US$ ' + v, locale: 'en-US',
  },
};

const inputCls = 'px-4 py-[14px] border-[1.5px] border-ink/35 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink';
const labelCls = 'flex flex-col gap-[7px] text-[13px] font-semibold';

export default function PublicarClient() {
  const [lang, setLang] = useLang();
  const { user, loading, openAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('venta');
  const [f, setF] = useState({ ptype: 'casa', neighborhood: '', city: '', price: '', currency: '', area: '', description: '', contact_name: '', contact_phone: '', seller_type: 'owner' });
  const [photos, setPhotos] = useState([]); // {file, url}
  const [err, setErr] = useState('');
  const [errs, setErrs] = useState({}); // per-field errors { field: message }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {ref, slug}
  const fileRef = useRef(null);
  const autoOpened = useRef(false);
  const t = DICT[lang];

  // Auto-open the login modal the moment we know the visitor is logged out —
  // collapses the old "dead-end gate → click a button → modal" flow into one
  // step. Runs once per mount; guarded so it never re-fires (e.g. if the user
  // closes the modal without logging in, we don't force it back open on them).
  useEffect(() => {
    if (!loading && !user && !autoOpened.current) {
      autoOpened.current = true;
      openAuth();
    }
  }, [loading, user, openAuth]);

  // Prefill contact from the logged-in user (only if the fields are still empty).
  useEffect(() => {
    if (!user) return;
    setF((s) => ({ ...s, contact_name: s.contact_name || user.full_name || '', contact_phone: s.contact_phone || user.phone || '' }));
  }, [user]);

  // Update a field and clear its error as soon as the user edits it.
  const set = (k) => (e) => {
    const v = e.target.value;
    setF((s) => ({ ...s, [k]: v }));
    setErrs((er) => (er[k] ? { ...er, [k]: undefined } : er));
  };
  const addPhotos = (list) => {
    const files = Array.from(list || []).filter((x) => x.type.startsWith('image/'));
    setPhotos((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 20));
    setErrs((er) => (er.photos ? { ...er, photos: undefined } : er));
  };
  const removePhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const priceCurrency = f.currency || (mode === 'alquiler' ? 'PYG' : 'USD');

  // Full completeness validation — a published listing must clear the same bar the
  // marketplace uses to show it (contact + location + plausible price + area), so
  // a user's listing is never created "incomplete" and then hidden/404'd.
  const APPROX_RATE = 7300; // client-side floor approximation; the live gate uses the real rate
  const numOf = (v) => Number(String(v).replace(/[^\d.]/g, ''));
  const validate = () => {
    const e = {};
    if (!f.ptype) e.ptype = t.errType;
    if (!f.neighborhood.trim()) e.neighborhood = t.errHood;
    if (!f.city.trim()) e.city = t.errCity;

    const p = numOf(f.price);
    if (!Number.isFinite(p) || p <= 0) e.price = t.errPrice;
    else if (mode === 'venta') {
      const usd = priceCurrency === 'USD' ? p : p / APPROX_RATE;
      if (usd < 5000) e.price = t.errPriceFloorSale;
    } else {
      const pyg = priceCurrency === 'PYG' ? p : p * APPROX_RATE;
      if (pyg < 300000) e.price = t.errPriceFloorRent;
    }

    const isLand = f.ptype === 'terreno';
    const a = numOf(f.area);
    if (!Number.isFinite(a) || a <= 0) e.area = t.errArea;
    else if (!isLand && (a < 5 || a > 2000)) e.area = t.errAreaRange;

    if (!f.contact_name.trim()) e.contact_name = t.errName;
    if (String(f.contact_phone).replace(/\D/g, '').length < 6) e.contact_phone = t.errPhone;

    if (photos.length < 1) e.photos = t.errPhotos;
    return e;
  };
  const back = () => { setErr(''); setStep(1); };

  // Free publish — no plan, no payment. Requires login (gated below).
  const publishListing = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrs(e);
      setErr(t.errFix);
      // jump to the first field with an error so it's obvious what to fix
      if (typeof document !== 'undefined') {
        const first = document.querySelector('[data-err="1"]');
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setErrs({}); setBusy(true); setErr('');
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
      fd.set('seller_type', f.seller_type);
      photos.forEach((p) => fd.append('photos', p.file));
      const res = await fetch('/api/publish', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
      track('listing_created', {
        property_id: j.id,
        slug: j.slug,
        ref: j.ref,
        operation: mode,
        property_type: f.ptype,
        city: f.city,
        neighborhood: f.neighborhood,
        price: f.price ? Number(f.price) : null,
        currency: priceCurrency,
        photos: photos.length,
      });
      setResult({ ref: j.ref, id: j.id });
      setStep(2);
    } catch {
      setErr(t.errSubmit);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep(1); setMode('venta'); setResult(null); setErr(''); setErrs({});
    setF({ ptype: 'casa', neighborhood: '', city: '', price: '', currency: '', area: '', description: '', contact_name: '', contact_phone: '', seller_type: 'owner' });
    setPhotos([]);
  };

  // Input class + inline error helpers (red border + message on the errored field).
  const fieldCls = (k) => `px-4 py-[14px] border-[1.5px] rounded-input bg-card font-medium text-[15px] outline-none ${errs[k] ? 'border-red-500 focus:border-red-600' : 'border-ink/35 focus:border-ink'}`;
  const FErr = ({ k }) => (errs[k] ? <span data-err="1" className="text-[12.5px] font-medium text-red-600">{errs[k]}</span> : null);

  const stepper = t.stepLabels.map((label, i) => {
    const n = i + 1, active = step === n, done = step > n;
    return { n: done ? '✓' : String(n), label, active, done, go: () => { if (n < step) setStep(n); } };
  });

  const nav = (
    <nav className="flex items-center justify-center md:justify-between flex-wrap gap-3 px-5 md:px-9 py-4 border-b border-ink/12">
      <Link href="/" className="font-bold text-[22px] tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
      <div className="flex gap-2 flex-wrap text-[14px] font-medium">
        <Link href="/propiedades?op=venta" className="inline-flex items-center h-[40px] px-[18px] border border-ink rounded-pill">{t.navBuy}</Link>
        <Link href="/propiedades?op=alquiler" className="inline-flex items-center h-[40px] px-[18px] border border-ink rounded-pill">{t.navRent}</Link>
        <Link href="/publicar" className="inline-flex items-center h-[40px] px-[18px] border border-ink rounded-pill">{t.navSell}</Link>
      </div>
      <div className="flex items-center gap-3.5">
        <div className="flex items-center h-[40px] border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
          {['es', 'en'].map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`h-full flex items-center px-3 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>
          ))}
        </div>
        <AuthButton />
        <Link href="/publicar" className="inline-flex items-center h-[40px] px-[22px] bg-ink text-paper rounded-pill text-[14px] font-semibold whitespace-nowrap">{t.navCta}</Link>
      </div>
    </nav>
  );

  // Gate the whole flow behind login so every published deal has an owner.
  // The modal auto-opens on mount (effect above); this is just the fallback
  // screen shown behind/after it in case the visitor closes it without
  // logging in, with a button to bring it back.
  if (!loading && !user) {
    return (
      <div className="min-h-screen">
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
    <div className="min-h-screen">
      {nav}

      <div className="max-w-[860px] mx-auto px-5 md:px-11 pt-10 pb-[90px]">
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
            <h1 className="text-[clamp(34px,4.5vw,48px)] font-bold tracking-[-0.04em] mb-2">{t.s1Title} <span className="font-serif italic font-normal">{t.s1TitleSerif}</span></h1>
            <p className="text-[16px] text-ink/55 mb-[34px]">{t.s1Sub}</p>
            <div className="flex gap-2.5 mb-[26px]">
              {[['venta', t.opVenta], ['alquiler', t.opAlquiler]].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} className={`px-[22px] py-2.5 rounded-pill text-[14px] font-semibold border-[1.5px] border-ink ${mode === m ? 'bg-ink text-paper' : 'bg-transparent'}`}>{label}</button>
              ))}
            </div>
            <div className="mb-[26px]">
              <div className="text-[13px] font-semibold mb-2">{t.roleQ}</div>
              <div className="flex gap-2.5">
                {[['owner', t.roleOwner], ['agent', t.roleAgent]].map(([r, label]) => (
                  <button key={r} type="button" onClick={() => setF((s) => ({ ...s, seller_type: r }))} className={`px-[22px] py-2.5 rounded-pill text-[14px] font-semibold border-[1.5px] border-ink ${f.seller_type === r ? 'bg-ink text-paper' : 'bg-transparent'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelCls}>{t.fType}
                <select value={f.ptype} onChange={set('ptype')} className={`${inputCls} cursor-pointer`}>
                  {t.types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className={labelCls}>{t.fHood}
                <input value={f.neighborhood} onChange={set('neighborhood')} placeholder={t.fHoodPh} className={fieldCls('neighborhood')} />
                <FErr k="neighborhood" />
              </label>
              <label className={labelCls}>{t.fCity}
                <input value={f.city} onChange={set('city')} placeholder={t.fCityPh} className={fieldCls('city')} />
                <FErr k="city" />
              </label>
              <label className={labelCls}>{t.fPrice(mode)}
                <div className="flex gap-2">
                  <input value={f.price} onChange={set('price')} inputMode="numeric" placeholder={t.fPricePh(mode)} className={`${fieldCls('price')} flex-1 min-w-0`} />
                  <select value={priceCurrency} onChange={set('currency')} className={`${inputCls} cursor-pointer w-[92px]`}>
                    <option value="USD">US$</option>
                    <option value="PYG">₲</option>
                  </select>
                </div>
                <FErr k="price" />
              </label>
              <label className={labelCls}>{t.fArea}
                <input value={f.area} onChange={set('area')} inputMode="numeric" placeholder="120" className={fieldCls('area')} />
                <FErr k="area" />
              </label>
              <label className={labelCls}>{t.fName}
                <input value={f.contact_name} onChange={set('contact_name')} placeholder={t.fNamePh} className={fieldCls('contact_name')} />
                <FErr k="contact_name" />
              </label>
              <label className={labelCls}>{t.fPhone}
                <input value={f.contact_phone} onChange={set('contact_phone')} placeholder={t.fPhonePh} className={fieldCls('contact_phone')} />
                <FErr k="contact_phone" />
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
              className={`mt-[22px] border-[1.5px] border-dashed rounded-[18px] p-[34px] text-center bg-card cursor-pointer transition-colors ${errs.photos ? 'border-red-500' : 'border-ink/35 hover:border-ink'}`}
            >
              <div className="text-[15px] font-semibold mb-1">{t.fPhotos}</div>
              <div className="font-mono text-[12px] text-ink/45">{photos.length ? t.photosChosen(photos.length) : t.fPhotosSub}</div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
            </div>
            {errs.photos && <div className="mt-1.5"><FErr k="photos" /></div>}
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

        {/* STEP 2 — CONFIRMATION */}
        {step === 2 && (
          <div className="text-center py-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot.png" alt="" className="w-[170px] object-contain mx-auto mb-2.5" />
            <h1 className="text-[clamp(36px,5vw,54px)] font-bold tracking-[-0.04em] mb-2.5">{t.s4Title} <span className="font-serif italic font-normal">{t.s4TitleSerif}</span></h1>
            <p className="text-[17px] text-ink/55 max-w-[440px] mx-auto mb-2.5">{t.s4Sub}</p>
            <div className="font-mono text-[12px] text-ink/45 mb-7">REF: {result?.ref}</div>
            <div className="flex gap-3 justify-center flex-wrap">
              {result?.id && <Link href={`/propiedad/${result.id}`} className="px-8 py-4 bg-ink text-paper font-semibold text-[15px] rounded-pill shadow-hard-soft">{t.s4View}</Link>}
              <Link href="/propiedades" className="px-8 py-4 border-2 border-ink font-semibold text-[15px] rounded-pill">{t.s4Btn1}</Link>
              <button onClick={restart} className="px-8 py-4 border-2 border-ink font-semibold text-[15px] rounded-pill">{t.s4Btn2}</button>
            </div>
          </div>
        )}

        {err && <div className="mt-6 text-[14px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3">{err}</div>}

        {/* FOOTER — publish (free, instant) */}
        {step === 1 && (
          <div className="flex justify-end mt-11 pt-[26px] border-t border-ink/15">
            <button onClick={publishListing} disabled={busy} className="px-[28px] py-3.5 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60">{busy ? t.paying : t.publishBtn}</button>
          </div>
        )}
      </div>
    </div>
  );
}
