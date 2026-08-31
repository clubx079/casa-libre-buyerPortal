'use client';
// Sell flow. openSell() decides:
//   - logged in  -> go straight to /publicar (the sell form)
//   - logged out -> open a step-by-step POPUP wizard that collects the whole
//     listing as a guest, THEN logs the user in (via openAuth), THEN publishes
//     and routes them to their new listing. Login is the LAST step, not the first.
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import { track } from '@/lib/analytics';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { savePendingSell, loadPendingSell, clearPendingSell } from '@/lib/pendingSell';

const SellFlowContext = createContext({ openSell: () => {} });
export const useSellFlow = () => useContext(SellFlowContext);

const DICT = {
  es: {
    steps: ['Operación', 'Vendedor', 'Ubicación', 'Detalles', 'Fotos', 'Contacto'],
    q1: '¿Qué querés hacer?', sell: 'Vender', rent: 'Alquilar',
    q2: '¿Sos el propietario o un agente?', owner: 'Propietario', agent: 'Agente',
    q3: '¿Dónde está la propiedad?', addrPh: 'Escribí la dirección…', addrHint: 'Elegí una dirección de la lista para estandarizarla.',
    barrio: 'Barrio', ciudad: 'Ciudad',
    q4: 'Contanos sobre la propiedad', type: 'Tipo', price: 'Precio', area: 'Superficie (m²)', desc: 'Descripción (opcional)', descPh: 'Depto luminoso con balcón…',
    types: [['casa', 'Casa'], ['departamento', 'Departamento'], ['duplex', 'Dúplex'], ['terreno', 'Terreno'], ['oficina', 'Oficina'], ['comercial', 'Local comercial']],
    q5: 'Agregá fotos', photosHint: 'mín. 1 foto · las fotos reales venden más rápido', chosen: (n) => `${n} foto${n === 1 ? '' : 's'}`,
    q6: 'Tu contacto', name: 'Tu nombre', namePh: 'Ana Giménez', phone: 'WhatsApp / teléfono', phonePh: '0981 123 456',
    next: 'Siguiente', back: '← Atrás', finishTitle: '¡Casi listo!', finishSub: 'Ingresá o creá tu cuenta para publicar. Ya tenemos todos los datos — tu propiedad se publica al instante.',
    finishBtn: 'Ingresar y publicar', publishing: 'Publicando…', close: 'Cerrar',
    errType: 'Elegí un tipo', errAddr: 'Elegí una dirección', errPrice: 'Ingresá un precio válido', errArea: 'Ingresá la superficie', errPhotos: 'Agregá al menos una foto', errName: 'Ingresá tu nombre', errPhone: 'Ingresá un teléfono válido', errPublish: 'No se pudo publicar. Intentá de nuevo.',
  },
  en: {
    steps: ['Operation', 'Seller', 'Location', 'Details', 'Photos', 'Contact'],
    q1: 'What do you want to do?', sell: 'Sell', rent: 'Rent out',
    q2: 'Are you the owner or an agent?', owner: 'Owner', agent: 'Agent',
    q3: 'Where is the property?', addrPh: 'Type the address…', addrHint: 'Pick an address from the list to standardize it.',
    barrio: 'Neighborhood', ciudad: 'City',
    q4: 'Tell us about the property', type: 'Type', price: 'Price', area: 'Area (m²)', desc: 'Description (optional)', descPh: 'Bright apartment with balcony…',
    types: [['casa', 'House'], ['departamento', 'Apartment'], ['duplex', 'Duplex'], ['terreno', 'Lot'], ['oficina', 'Office'], ['comercial', 'Commercial']],
    q5: 'Add photos', photosHint: 'min. 1 photo · real photos sell faster', chosen: (n) => `${n} photo${n === 1 ? '' : 's'}`,
    q6: 'Your contact', name: 'Your name', namePh: 'Ana Giménez', phone: 'WhatsApp / phone', phonePh: '0981 123 456',
    next: 'Next', back: '← Back', finishTitle: 'Almost done!', finishSub: 'Log in or create your account to publish. We already have all the details — your listing goes live instantly.',
    finishBtn: 'Log in & publish', publishing: 'Publishing…', close: 'Close',
    errType: 'Choose a type', errAddr: 'Choose an address', errPrice: 'Enter a valid price', errArea: 'Enter the area', errPhotos: 'Add at least one photo', errName: 'Enter your name', errPhone: 'Enter a valid phone', errPublish: 'Could not publish. Please try again.',
  },
};

const inputCls = 'w-full px-4 py-[13px] border-[1.5px] border-ink/30 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink';
const labelCls = 'block text-[13px] font-semibold mb-1.5';
const pickCls = (on) => `flex-1 px-5 py-4 rounded-[14px] border-[1.5px] text-[15px] font-semibold ${on ? 'bg-ink text-paper border-ink' : 'bg-card border-ink/30'}`;

export default function SellFlowProvider({ children }) {
  const [lang] = useLang();
  const t = DICT[lang];
  const router = useRouter();
  const { user, openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ mode: '', seller_type: '', neighborhood: '', city: '', addressText: '', ptype: '', price: '', currency: 'USD', area: '', description: '', contact_name: '', contact_phone: '' });
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);

  const reset = () => { setStep(0); setErr(''); setBusy(false); setPhotos([]); setF({ mode: '', seller_type: '', neighborhood: '', city: '', addressText: '', ptype: '', price: '', currency: 'USD', area: '', description: '', contact_name: '', contact_phone: '' }); };
  const close = () => { setOpen(false); reset(); };

  const openSell = useCallback(() => {
    if (user) { router.push('/publicar'); return; }
    reset(); setOpen(true); track('sell_wizard_opened', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const addPhotos = (list) => {
    const files = Array.from(list || []).filter((x) => x.type.startsWith('image/'));
    setPhotos((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 20));
  };

  // Per-step validation gate for the Next button.
  const stepValid = () => {
    switch (step) {
      case 0: return !!f.mode;
      case 1: return !!f.seller_type;
      case 2: return !!f.neighborhood;
      case 3: return !!f.ptype && Number(String(f.price).replace(/[^\d.]/g, '')) > 0 && (f.ptype === 'terreno' || Number(String(f.area).replace(/[^\d.]/g, '')) > 0);
      case 4: return photos.length >= 1;
      case 5: return f.contact_name.trim() && String(f.contact_phone).replace(/\D/g, '').length >= 6;
      default: return true;
    }
  };
  const next = () => { if (!stepValid()) { setErr(stepErr()); return; } setErr(''); setStep((s) => Math.min(s + 1, 6)); };
  const back = () => { setErr(''); setStep((s) => Math.max(s - 1, 0)); };
  const stepErr = () => [null, null, t.errAddr, (!f.ptype ? t.errType : t.errPrice), t.errPhotos, (!f.contact_name.trim() ? t.errName : t.errPhone)][step] || '';

  // Publish a stashed payload (fields + photo Blobs). Used by the resume effect.
  const publishingRef = useRef(false);
  const publishPayload = async (payload) => {
    const fx = payload.fields || {};
    const fd = new FormData();
    fd.set('mode', fx.mode); fd.set('seller_type', fx.seller_type); fd.set('ptype', fx.ptype);
    fd.set('neighborhood', fx.neighborhood); fd.set('city', fx.city || 'Asunción');
    fd.set('price', fx.price); fd.set('currency', fx.mode === 'alquiler' ? 'PYG' : fx.currency);
    fd.set('area', fx.area); fd.set('description', fx.description || '');
    fd.set('contact_name', fx.contact_name); fd.set('contact_phone', fx.contact_phone);
    (payload.photos || []).forEach((file) => fd.append('photos', file));
    const res = await fetch('/api/publish', { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
    return j;
  };

  // The single publish trigger. Whenever a user becomes logged in AND a pending
  // sell payload exists, publish it — this handles BOTH login paths with one
  // path: email/OTP (stays on page) and Google OAuth (full-page redirect back).
  useEffect(() => {
    if (!user || publishingRef.current) return;
    (async () => {
      const payload = await loadPendingSell();
      if (!payload) return;                 // normal login (no sell in progress) → no-op
      publishingRef.current = true;
      await clearPendingSell();             // claim it — can never publish twice
      setResuming(true);
      try {
        const j = await publishPayload(payload);
        track('listing_created', { property_id: j.id, via: 'sell_wizard' });
        setOpen(false); reset();
        router.push(`/propiedad/${j.id}`);
      } catch {
        setResuming(false); setOpen(false);
        router.push('/publicar');           // logged in but publish failed → land on the form
      } finally {
        publishingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Final wizard step: stash everything (incl. photo files) so it survives a
  // Google redirect, then open login. The effect above does the publish.
  const goPublish = async () => {
    setBusy(true); setErr('');
    const ok = await savePendingSell({
      fields: { mode: f.mode, seller_type: f.seller_type, ptype: f.ptype, neighborhood: f.neighborhood, city: f.city, price: f.price, currency: f.currency, area: f.area, description: f.description, contact_name: f.contact_name, contact_phone: f.contact_phone },
      photos: photos.map((p) => p.file),
    });
    if (!ok) { setErr(t.errPublish); setBusy(false); return; }
    openAuth();
  };

  return (
    <SellFlowContext.Provider value={{ openSell }}>
      {children}
      {resuming && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-paper/95">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot.png" alt="" className="w-[120px] object-contain mx-auto mb-4" />
            <div className="text-[18px] font-bold tracking-head">{lang === 'en' ? 'Publishing your listing…' : 'Publicando tu propiedad…'}</div>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-[480px] bg-paper border-[1.5px] border-ink rounded-[24px] shadow-hard p-6 md:p-7 max-h-[92vh] overflow-y-auto">
            <button onClick={close} aria-label={t.close} className="absolute top-4 right-4 w-8 h-8 rounded-pill border border-ink/25 flex items-center justify-center text-ink/60 hover:text-ink">×</button>

            {/* stepper */}
            <div className="flex items-center gap-1.5 mb-5 mt-1">
              {t.steps.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-pill ${i <= step ? 'bg-ink' : 'bg-ink/15'}`} />
              ))}
            </div>

            {step === 0 && (
              <div>
                <h2 className="text-[22px] font-bold tracking-head mb-4">{t.q1}</h2>
                <div className="flex gap-3">
                  <button onClick={() => { set('mode', 'venta'); setStep(1); }} className={pickCls(f.mode === 'venta')}>{t.sell}</button>
                  <button onClick={() => { set('mode', 'alquiler'); setStep(1); }} className={pickCls(f.mode === 'alquiler')}>{t.rent}</button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-[22px] font-bold tracking-head mb-4">{t.q2}</h2>
                <div className="flex gap-3">
                  <button onClick={() => { set('seller_type', 'owner'); setStep(2); }} className={pickCls(f.seller_type === 'owner')}>{t.owner}</button>
                  <button onClick={() => { set('seller_type', 'agent'); setStep(2); }} className={pickCls(f.seller_type === 'agent')}>{t.agent}</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-[22px] font-bold tracking-head mb-1">{t.q3}</h2>
                <p className="text-[13px] text-ink/50 mb-4">{t.addrHint}</p>
                <AddressAutocomplete value={f.addressText} onChange={(v) => set('addressText', v)} onSelect={({ neighborhood, city }) => setF((s) => ({ ...s, neighborhood, city }))} placeholder={t.addrPh} className={inputCls} />
                {f.neighborhood ? (
                  <div className="mt-3 flex gap-2 text-[13px]">
                    <span className="px-3 py-1.5 rounded-pill bg-card border border-ink/20 font-medium">{t.barrio}: <b>{f.neighborhood}</b></span>
                    <span className="px-3 py-1.5 rounded-pill bg-card border border-ink/20 font-medium">{t.ciudad}: <b>{f.city}</b></span>
                  </div>
                ) : null}
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-[22px] font-bold tracking-head mb-4">{t.q4}</h2>
                <label className={labelCls}>{t.type}</label>
                <select value={f.ptype} onChange={(e) => set('ptype', e.target.value)} className={`${inputCls} cursor-pointer mb-3`}>
                  <option value="">—</option>
                  {t.types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1"><label className={labelCls}>{t.price}</label>
                    <input value={f.price} onChange={(e) => set('price', e.target.value)} inputMode="numeric" placeholder="145.000" className={inputCls} /></div>
                  {f.mode !== 'alquiler' && (
                    <div className="w-[92px]"><label className={labelCls}>&nbsp;</label>
                      <select value={f.currency} onChange={(e) => set('currency', e.target.value)} className={`${inputCls} cursor-pointer`}><option value="USD">US$</option><option value="PYG">₲</option></select></div>
                  )}
                </div>
                {f.ptype !== 'terreno' && (
                  <><label className={labelCls}>{t.area}</label>
                    <input value={f.area} onChange={(e) => set('area', e.target.value)} inputMode="numeric" placeholder="120" className={`${inputCls} mb-3`} /></>
                )}
                <label className={labelCls}>{t.desc}</label>
                <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder={t.descPh} className={`${inputCls} resize-y`} />
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="text-[22px] font-bold tracking-head mb-4">{t.q5}</h2>
                <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}
                  className="border-[1.5px] border-dashed border-ink/35 rounded-[18px] p-8 text-center bg-card cursor-pointer hover:border-ink">
                  <div className="text-[15px] font-semibold">{photos.length ? t.chosen(photos.length) : t.q5}</div>
                  <div className="font-mono text-[12px] text-ink/45 mt-1">{t.photosHint}</div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {photos.map((p, i) => (
                      <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden border border-ink/15">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                        <button onClick={(e) => { e.stopPropagation(); setPhotos((ps) => ps.filter((_, idx) => idx !== i)); }} className="absolute top-1 right-1 w-5 h-5 rounded-pill bg-ink text-paper text-[11px] flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div>
                <h2 className="text-[22px] font-bold tracking-head mb-4">{t.q6}</h2>
                <label className={labelCls}>{t.name}</label>
                <input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder={t.namePh} className={`${inputCls} mb-3`} autoComplete="name" />
                <label className={labelCls}>{t.phone}</label>
                <input value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder={t.phonePh} className={inputCls} autoComplete="tel" />
              </div>
            )}

            {step === 6 && (
              <div className="text-center py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mascot.png" alt="" className="w-[110px] object-contain mx-auto mb-3" />
                <h2 className="text-[24px] font-bold tracking-head mb-2">{t.finishTitle}</h2>
                <p className="text-[14px] text-ink/55 mb-5">{t.finishSub}</p>
                <button onClick={goPublish} disabled={busy} className="w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] shadow-hard-soft disabled:opacity-60">{busy ? t.publishing : t.finishBtn}</button>
              </div>
            )}

            {err && <div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3.5 py-2.5">{err}</div>}

            {/* nav */}
            {step > 0 && step < 6 && (
              <div className="flex items-center justify-between mt-6">
                <button onClick={back} className="text-[13px] font-medium text-ink/55 hover:text-ink">{t.back}</button>
                <button onClick={next} className="px-7 py-3 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft">{t.next}</button>
              </div>
            )}
            {step === 6 && (
              <button onClick={back} className="block mx-auto mt-4 text-[13px] font-medium text-ink/55 hover:text-ink">{t.back}</button>
            )}
          </div>
        </div>
      )}
    </SellFlowContext.Provider>
  );
}
