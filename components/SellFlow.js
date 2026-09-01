'use client';
// Sell flow. openSell() decides:
//   - logged in  -> go straight to /publicar (the sell form)
//   - logged out -> open a step-by-step POPUP wizard that collects the essentials
//     as a guest (operation -> owner/agent + name + contact -> address), THEN logs
//     the user in (via openAuth). Login is the LAST step. The collected info is
//     saved to the device BEFORE login, so it survives the Google OAuth redirect
//     AND is not lost even if the user never logs in. After login the user is
//     routed to /publicar, PRE-FILLED, to finish (price, area, description, photos).
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import { track } from '@/lib/analytics';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { savePendingSell, loadPendingSell } from '@/lib/pendingSell';

const SellFlowContext = createContext({ openSell: () => {} });
export const useSellFlow = () => useContext(SellFlowContext);

const DICT = {
  es: {
    steps: ['Operación', 'Vendedor', 'Ubicación'],
    q1: '¿Qué querés hacer?', sell: 'Vender', rent: 'Alquilar',
    q2: '¿Sos el propietario o un agente?', owner: 'Propietario', agent: 'Agente',
    name: 'Tu nombre', namePh: 'Ana Giménez', phone: 'WhatsApp / teléfono', phonePh: '0981 123 456',
    q3: '¿Dónde está la propiedad?', addrPh: 'Escribí la dirección…', addrHint: 'Elegí una dirección de la lista para estandarizarla.',
    barrio: 'Barrio', ciudad: 'Ciudad',
    next: 'Siguiente', back: '← Atrás', close: 'Cerrar',
    finishTitle: '¡Casi listo!', finishSub: 'Ingresá o creá tu cuenta para continuar. Ya guardamos tus datos — completá los últimos detalles (precio, superficie y fotos) y publicá.',
    finishBtn: 'Ingresar y continuar', saving: 'Guardando…',
    errSeller: 'Elegí propietario o agente', errName: 'Ingresá tu nombre', errPhone: 'Ingresá un teléfono válido', errAddr: 'Elegí una dirección', errSave: 'No se pudo guardar. Intentá de nuevo.',
  },
  en: {
    steps: ['Operation', 'Seller', 'Location'],
    q1: 'What do you want to do?', sell: 'Sell', rent: 'Rent out',
    q2: 'Are you the owner or an agent?', owner: 'Owner', agent: 'Agent',
    name: 'Your name', namePh: 'Ana Giménez', phone: 'WhatsApp / phone', phonePh: '0981 123 456',
    q3: 'Where is the property?', addrPh: 'Type the address…', addrHint: 'Pick an address from the list to standardize it.',
    barrio: 'Neighborhood', ciudad: 'City',
    next: 'Next', back: '← Back', close: 'Close',
    finishTitle: 'Almost done!', finishSub: 'Log in or create your account to continue. We already saved your details — add the last bits (price, area and photos) and publish.',
    finishBtn: 'Log in & continue', saving: 'Saving…',
    errSeller: 'Choose owner or agent', errName: 'Enter your name', errPhone: 'Enter a valid phone', errAddr: 'Choose an address', errSave: 'Could not save. Please try again.',
  },
};

const LAST = 2; // address is the final collection step — the login popup opens right after it (no extra screen)
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
  const [err, setErr] = useState('');
  const [f, setF] = useState({ mode: '', seller_type: '', neighborhood: '', city: '', addressText: '', contact_name: '', contact_phone: '' });

  const reset = () => { setStep(0); setErr(''); setBusy(false); setF({ mode: '', seller_type: '', neighborhood: '', city: '', addressText: '', contact_name: '', contact_phone: '' }); };
  const close = () => { setOpen(false); reset(); };

  const openSell = useCallback(() => {
    if (user) { router.push('/publicar'); return; }
    reset(); setOpen(true); track('sell_wizard_opened', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  // Per-step validation gate for the Next button.
  const phoneOk = (v) => String(v).replace(/\D/g, '').length >= 6;
  const stepValid = () => {
    switch (step) {
      case 0: return !!f.mode;
      case 1: return !!f.seller_type && f.contact_name.trim() && phoneOk(f.contact_phone);
      case 2: return !!f.neighborhood;
      default: return true;
    }
  };
  const stepErr = () => {
    if (step === 1) return !f.seller_type ? t.errSeller : !f.contact_name.trim() ? t.errName : t.errPhone;
    if (step === 2) return t.errAddr;
    return '';
  };
  const next = () => { if (!stepValid()) { setErr(stepErr()); return; } setErr(''); setStep((s) => Math.min(s + 1, LAST)); };
  const back = () => { setErr(''); setStep((s) => Math.max(s - 1, 0)); };
  // Address step's primary action: validate, save, then open the login popup
  // directly — no intermediate "Almost done!" screen.
  const submit = async () => { if (!stepValid()) { setErr(stepErr()); return; } await goLogin(); };

  // After login (email/OTP stays on page; Google OAuth redirects back), if a
  // pending sell exists, route the user to /publicar — PRE-FILLED there, where
  // they finish and publish. We do NOT clear the pending here: PublicarClient
  // consumes it. Guarded so it routes only once.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!user || resumedRef.current) return;
    (async () => {
      const payload = await loadPendingSell();
      if (!payload) return;                 // normal login (no sell in progress) → no-op
      resumedRef.current = true;
      setOpen(false); reset();
      router.push('/publicar');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Login step: persist everything collected (so it survives the Google redirect
  // and isn't lost even if the user abandons login), then open the auth modal.
  const goLogin = async () => {
    setBusy(true); setErr('');
    const ok = await savePendingSell({
      fields: { mode: f.mode, seller_type: f.seller_type, neighborhood: f.neighborhood, city: f.city, addressText: f.addressText, contact_name: f.contact_name, contact_phone: f.contact_phone },
    });
    if (!ok) { setErr(t.errSave); setBusy(false); return; }
    setBusy(false);
    openAuth();
  };

  return (
    <SellFlowContext.Provider value={{ openSell }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-[480px] bg-paper border-[1.5px] border-ink rounded-[24px] shadow-hard p-6 md:p-7 max-h-[92vh] overflow-y-auto">
            <button onClick={close} aria-label={t.close} className="absolute top-4 right-4 w-8 h-8 rounded-pill border border-ink/25 flex items-center justify-center text-ink/60 hover:text-ink">×</button>

            {/* stepper — pr-9 keeps the bar clear of the × close button */}
            <div className="flex items-center gap-1.5 mb-5 mt-1 pr-9">
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
                  <button onClick={() => set('seller_type', 'owner')} className={pickCls(f.seller_type === 'owner')}>{t.owner}</button>
                  <button onClick={() => set('seller_type', 'agent')} className={pickCls(f.seller_type === 'agent')}>{t.agent}</button>
                </div>
                {/* Name + contact appear only AFTER owner/agent is picked. */}
                {f.seller_type && (
                  <div className="mt-5">
                    <label className={labelCls}>{t.name}</label>
                    <input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder={t.namePh} className={`${inputCls} mb-3`} autoComplete="name" />
                    <label className={labelCls}>{t.phone}</label>
                    <input value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder={t.phonePh} className={inputCls} autoComplete="tel" inputMode="tel" />
                  </div>
                )}
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

            {err &&<div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3.5 py-2.5">{err}</div>}

            {/* nav — step 0 auto-advances; step 1 → Next; step 2 (address) → open login directly. */}
            {step > 0 && (
              <div className="flex items-center justify-between mt-6">
                <button onClick={back} className="text-[13px] font-medium text-ink/55 hover:text-ink">{t.back}</button>
                {step < LAST ? (
                  <button onClick={next} className="px-7 py-3 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft">{t.next}</button>
                ) : (
                  <button onClick={submit} disabled={busy} className="px-7 py-3 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60">{busy ? t.saving : t.finishBtn}</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </SellFlowContext.Provider>
  );
}
