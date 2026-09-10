'use client';
// Sell flow — a 4-step popup wizard that a logged-out visitor completes end to end
// WITHOUT leaving the popup:
//   1) Operation (sell / rent)
//   2) Seller (owner/agent) + name + EMAIL
//   3) Location (address)
//   -> we email a confirmation code; the user verifies it inline (their account is
//      created + they're logged in on the spot — no password screen)
//   4) Details (type, price, area, phone, photos) -> Publish
// The listing is posted from step 4; we never route to /publicar. (A logged-in
// user still goes straight to /publicar via openSell.)
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import { track } from '@/lib/analytics';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import HighlightModal from '@/components/HighlightModal';
import RecommendedTag from '@/components/RecommendedTag';
import PlanBox from '@/components/PlanBox';
import { VerifiedIcon } from '@/components/VerifiedTag';
import { savePendingSell } from '@/lib/pendingSell';

const SellFlowContext = createContext({ openSell: () => {} });
export const useSellFlow = () => useContext(SellFlowContext);

const DICT = {
  es: {
    steps: ['Operación', 'Vendedor', 'Ubicación', 'Detalles'],
    q1: '¿Qué querés hacer?', sell: 'Vender', rent: 'Alquilar',
    q2: '¿Sos el propietario o un agente?', owner: 'Propietario', agent: 'Agente',
    name: 'Tu nombre', namePh: 'Ana Giménez', email: 'Tu correo electrónico', emailPh: 'ana@correo.com',
    q3: '¿Dónde está la propiedad?', addrPh: 'Escribí la dirección…', addrHint: 'Elegí una dirección de la lista para estandarizarla.',
    barrio: 'Barrio', ciudad: 'Ciudad',
    otpTitle: 'Código de confirmación enviado', otpSub: (e) => `Ingresá el código que enviamos a ${e} para verificar tu correo.`,
    codePh: 'Código de 6 dígitos', verify: 'Verificar', verifying: 'Verificando…', resend: 'Reenviar código', resent: 'Código reenviado',
    haveAccount: 'Ya tenés una cuenta', haveAccountSub: (e) => `Ingresá tu contraseña para continuar como ${e}.`, googleBtn: 'Continuar con Google', orText: 'o', password: 'Contraseña', passwordPh: '••••••••', login: 'Ingresar', forgot: '¿Olvidaste tu contraseña?', errCreds: 'Contraseña incorrecta', errGeneric: 'Algo salió mal. Intentá de nuevo.', doneDash: 'Ir a mi panel',
    d4Title: 'Últimos detalles', d4Sub: 'Completá los datos de tu propiedad y publicá — se publica al instante.',
    fType: 'Tipo de propiedad', types: [['casa', 'Casa'], ['departamento', 'Departamento'], ['duplex', 'Dúplex'], ['terreno', 'Terreno']],
    fPrice: (m) => (m === 'venta' ? 'Precio' : 'Alquiler mensual'), fPricePh: (m) => (m === 'venta' ? '145.000' : '4.500.000'),
    fArea: 'Superficie (m²)', fDesc: 'Descripción', fDescPh: 'Depto luminoso con balcón, a 2 cuadras del Shopping del Sol…',
    fPhone: 'WhatsApp / teléfono (para compradores)', fPhonePh: '0981 123 456',
    fPhotos: 'Arrastrá o elegí tus fotos', fPhotosSub: 'mín. 1 foto · JPG o PNG', photosChosen: (n) => `${n} foto${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}`,
    publishBtn: 'Publicar gratis', publishing: 'Publicando…',
    doneTitle: '¡Tu propiedad está publicada!', doneSub: 'Ya aparece en el marketplace de Casa Libre.', doneView: 'Ver mi propiedad', doneBrowse: 'Ver propiedades',
    // Promotion plans (optional paid visibility at publish) — two boxes, pick one.
    planTitle: 'Sumá visibilidad (opcional)',
    v5Title: 'Insignia Verificada en el marketplace', v5Price: 'US$5 · 30 días',
    v20Title: 'Mostrá tu propiedad en la portada con la insignia Verificada', v20Price: 'US$20 · 30 días',
    publishVerified: 'Publicar por US$5', publishHome: 'Publicar por US$20',
    usTitle: 'Sumá visibilidad a tu propiedad', usSub: 'Elegí un plan y destacá tu aviso por 30 días.',
    usVerify: 'Verificar · US$5', usHome: 'En la portada · US$20',
    hiDoneVerified: '¡Tu propiedad está verificada por 30 días!', hiDoneHome: '¡Tu propiedad está en la portada por 30 días!',
    next: 'Siguiente', back: '← Atrás', close: 'Cerrar', sending: 'Enviando…',
    errSeller: 'Elegí propietario o agente', errName: 'Ingresá tu nombre', errEmail: 'Ingresá un correo válido', errAddr: 'Elegí una dirección',
    errSendOtp: 'No se pudo enviar el código. Intentá de nuevo.', emailTaken: 'Este correo ya tiene una cuenta.', loginInstead: 'Iniciar sesión para continuar',
    errCode: 'Código inválido o vencido', errType: 'Elegí un tipo', errPrice: 'Ingresá un precio válido',
    errPriceFloorSale: 'El precio de venta debe ser de al menos US$ 5.000', errPriceFloorRent: 'El alquiler mensual debe ser de al menos ₲ 300.000',
    errArea: 'Ingresá la superficie', errAreaRange: 'La superficie debe estar entre 5 y 2.000 m²', errPhone: 'Ingresá un teléfono válido', errPhotos: 'Agregá al menos una foto',
    errSubmit: 'No se pudo publicar. Intentá de nuevo.',
  },
  en: {
    steps: ['Operation', 'Seller', 'Location', 'Details'],
    q1: 'What do you want to do?', sell: 'Sell', rent: 'Rent out',
    q2: 'Are you the owner or an agent?', owner: 'Owner', agent: 'Agent',
    name: 'Your name', namePh: 'Ana Giménez', email: 'Your email', emailPh: 'ana@email.com',
    q3: 'Where is the property?', addrPh: 'Type the address…', addrHint: 'Pick an address from the list to standardize it.',
    barrio: 'Neighborhood', ciudad: 'City',
    otpTitle: 'Confirmation code sent', otpSub: (e) => `Enter the code we emailed to ${e} to verify your email.`,
    codePh: '6-digit code', verify: 'Verify', verifying: 'Verifying…', resend: 'Resend code', resent: 'Code resent',
    haveAccount: 'You already have an account', haveAccountSub: (e) => `Enter your password to continue as ${e}.`, googleBtn: 'Continue with Google', orText: 'or', password: 'Password', passwordPh: '••••••••', login: 'Log in', forgot: 'Forgot your password?', errCreds: 'Wrong password', errGeneric: 'Something went wrong. Try again.', doneDash: 'Go to my dashboard',
    d4Title: 'Last details', d4Sub: 'Fill in your property and publish — it goes live instantly.',
    fType: 'Property type', types: [['casa', 'House'], ['departamento', 'Apartment'], ['duplex', 'Duplex'], ['terreno', 'Lot']],
    fPrice: (m) => (m === 'venta' ? 'Price' : 'Monthly rent'), fPricePh: (m) => (m === 'venta' ? '145,000' : '4,500,000'),
    fArea: 'Area (m²)', fDesc: 'Description', fDescPh: 'Bright apartment with balcony, 2 blocks from Shopping del Sol…',
    fPhone: 'WhatsApp / phone (for buyers)', fPhonePh: '0981 123 456',
    fPhotos: 'Drag or choose your photos', fPhotosSub: 'min. 1 photo · JPG or PNG', photosChosen: (n) => `${n} photo${n === 1 ? '' : 's'} selected`,
    publishBtn: 'Publish for free', publishing: 'Publishing…',
    doneTitle: 'Your listing is live!', doneSub: 'It already shows in the Casa Libre marketplace.', doneView: 'View my listing', doneBrowse: 'Browse listings',
    // Promotion plans (optional paid visibility at publish) — two boxes, pick one.
    planTitle: 'Add visibility (optional)',
    v5Title: 'Verified badge on marketplace', v5Price: 'US$5 · 30 days',
    v20Title: 'Display your property on the Landing page with the Verified badge', v20Price: 'US$20 · 30 days',
    publishVerified: 'Publish for US$5', publishHome: 'Publish for US$20',
    usTitle: 'Add visibility to your listing', usSub: 'Pick a plan to feature your listing for 30 days.',
    usVerify: 'Verify · US$5', usHome: 'On the landing page · US$20',
    hiDoneVerified: 'Your listing is verified for 30 days!', hiDoneHome: 'Your listing is on the landing page for 30 days!',
    next: 'Next', back: '← Back', close: 'Close', sending: 'Sending…',
    errSeller: 'Choose owner or agent', errName: 'Enter your name', errEmail: 'Enter a valid email', errAddr: 'Choose an address',
    errSendOtp: 'Could not send the code. Please try again.', emailTaken: 'This email already has an account.', loginInstead: 'Log in to continue',
    errCode: 'Invalid or expired code', errType: 'Choose a type', errPrice: 'Enter a valid price',
    errPriceFloorSale: 'Sale price must be at least US$ 5,000', errPriceFloorRent: 'Monthly rent must be at least ₲ 300,000',
    errArea: 'Enter the area', errAreaRange: 'Area must be between 5 and 2,000 m²', errPhone: 'Enter a valid phone', errPhotos: 'Add at least one photo',
    errSubmit: 'Could not publish. Please try again.',
  },
};

const inputCls = 'w-full px-4 py-[13px] border-[1.5px] border-ink/30 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink';
const labelCls = 'block text-[13px] font-semibold mb-1.5';
const pickCls = (on) => `flex-1 px-5 py-4 rounded-[14px] border-[1.5px] text-[15px] font-semibold ${on ? 'bg-ink text-paper border-ink' : 'bg-card border-ink/30'}`;
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
const APPROX_RATE = 7300;
const numOf = (v) => Number(String(v).replace(/[^\d.]/g, ''));
const randomPw = () => 'Cl' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!' + Math.floor(Math.random() * 90 + 10);

// Inline loading spinner — used on the Next / Log in buttons instead of a text label.
const Spinner = () => (
  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export default function SellFlowProvider({ children }) {
  const [lang] = useLang();
  const t = DICT[lang];
  const router = useRouter();
  const { user, openAuth, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);          // 0 op · 1 seller · 2 location · 3 details
  const [phase, setPhase] = useState('');        // '' | 'otp' — code-verify overlay between step 2 and 3
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [errs, setErrs] = useState({});
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [loginPw, setLoginPw] = useState('');
  const [photos, setPhotos] = useState([]);      // {file,url}
  const [result, setResult] = useState(null);    // {id, ref}
  const [showHi, setShowHi] = useState(false);    // promotion payment modal (post-publish upsell)
  const [highlighted, setHighlighted] = useState(false);
  const [plan, setPlan] = useState(null);         // selected promo plan: null | 'verified' | 'home'
  const fileRef = useRef(null);
  const [f, setF] = useState({ mode: '', seller_type: '', neighborhood: '', city: '', addressText: '', contact_name: '', email: '', ptype: 'casa', price: '', currency: '', area: '', description: '', contact_phone: '' });

  const reset = () => {
    setStep(0); setPhase(''); setErr(''); setErrs({}); setBusy(false); setCode(''); setVerified(false); setEmailTaken(false); setLoginPw(''); setPhotos([]); setResult(null); setShowHi(false); setHighlighted(false); setPlan(null);
    setF({ mode: '', seller_type: '', neighborhood: '', city: '', addressText: '', contact_name: '', email: '', ptype: 'casa', price: '', currency: '', area: '', description: '', contact_phone: '' });
  };
  const close = () => { setOpen(false); reset(); };

  const openSell = useCallback(() => {
    if (user) { router.push('/publicar'); return; }
    reset(); setOpen(true); track('sell_wizard_opened', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setField = (k) => (e) => { const v = e.target.value; setF((s) => ({ ...s, [k]: v })); setErrs((er) => (er[k] ? { ...er, [k]: undefined } : er)); };
  const priceCurrency = f.currency || (f.mode === 'alquiler' ? 'PYG' : 'USD');

  // If a returning user logs in via the fallback auth modal while the wizard is
  // open (e.g. their email was already registered), jump them straight to details.
  const advancedRef = useRef(false);
  useEffect(() => {
    if (user && open && step < 3 && !advancedRef.current) { advancedRef.current = true; setPhase(''); setStep(3); }
    if (!user) advancedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, open]);

  // ---- step navigation (collection steps 0..2) ----
  const collectValid = () => {
    if (step === 1) return !!f.seller_type && f.contact_name.trim() && emailOk(f.email);
    if (step === 2) return !!f.neighborhood;
    return true;
  };
  const collectErr = () => (step === 1 ? (!f.seller_type ? t.errSeller : !f.contact_name.trim() ? t.errName : t.errEmail) : t.errAddr);
  const next = async () => {
    if (!collectValid()) { setErr(collectErr()); return; }
    setErr('');
    // after address → email the code + open verify overlay (skip if already verified this session)
    if (step === 2) { if (verified) { setStep(3); return; } await sendOtp(); return; }
    setStep((s) => s + 1);
  };
  const back = () => { setErr(''); setEmailTaken(false); if (phase === 'otp') { setPhase(''); return; } setStep((s) => Math.max(s - 1, 0)); };

  // ---- email OTP (inline, no password screen) ----
  const sendOtp = async () => {
    setBusy(true); setErr(''); setEmailTaken(false);
    try {
      const res = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email, fullName: f.contact_name, mode: f.mode, seller_type: f.seller_type, neighborhood: f.neighborhood, city: f.city, address: f.addressText }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 || j.error === 'email_taken') { setEmailTaken(true); setPhase('otp'); return; }
      if (!res.ok || !j.ok) { setErr(t.errSendOtp); return; }
      setPhase('otp'); setCode('');
      track('sell_otp_sent', {});
    } catch { setErr(t.errSendOtp); } finally { setBusy(false); }
  };
  const verifyOtp = async () => {
    if (String(code).replace(/\D/g, '').length < 4) { setErr(t.errCode); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email, code: String(code).trim(), password: randomPw(), fullName: f.contact_name }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { setErr(t.errCode); return; }
      track('sell_otp_verified', {});
      setVerified(true); setPhase(''); setStep(3);   // account created + logged in → go to details (step 4)
      refreshUser?.();                                // reflect the new session in the header/app immediately (was showing "not logged in")
    } catch { setErr(t.errCode); } finally { setBusy(false); }
  };

  // ---- returning user (email already registered): inline Google / password login ----
  // Instead of showing "email taken" and opening the full auth modal, we keep the
  // user in the wizard: offer Google, or just a password field (their email is
  // already known from step 2). On success we jump straight to details (step 3).
  const googleSignIn = async () => {
    setErr('');
    try {
      // Stash what the guest collected so /publicar resumes (prefilled) after the
      // OAuth full-page redirect — instead of dropping the user on the dashboard.
      await savePendingSell({ fields: { mode: f.mode, seller_type: f.seller_type, contact_name: f.contact_name, email: f.email, neighborhood: f.neighborhood, city: f.city, addressText: f.addressText } });
      const r = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next: '/publicar' }) });
      const j = await r.json().catch(() => ({}));
      if (j.url) window.location.href = j.url; else setErr(t.errGeneric);
    } catch { setErr(t.errGeneric); }
  };
  const doLogin = async () => {
    if (!loginPw) { setErr(t.errCreds); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email, password: loginPw }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { setErr(t.errCreds); return; }
      track('user_logged_in', { method: 'password' });
      setVerified(true); setEmailTaken(false); setPhase(''); setStep(3);   // logged in → straight to details
      refreshUser?.();                                                      // update header/user app-wide
    } catch { setErr(t.errCreds); } finally { setBusy(false); }
  };

  // ---- details + publish (step 3) ----
  const addPhotos = (list) => {
    const files = Array.from(list || []).filter((x) => x.type.startsWith('image/'));
    setPhotos((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 20));
    setErrs((er) => (er.photos ? { ...er, photos: undefined } : er));
  };
  const removePhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));
  const validateDetails = () => {
    const e = {};
    if (!f.ptype) e.ptype = t.errType;
    const p = numOf(f.price);
    if (!Number.isFinite(p) || p <= 0) e.price = t.errPrice;
    else if (f.mode === 'venta') { const usd = priceCurrency === 'USD' ? p : p / APPROX_RATE; if (usd < 5000) e.price = t.errPriceFloorSale; }
    else { const pyg = priceCurrency === 'PYG' ? p : p * APPROX_RATE; if (pyg < 300000) e.price = t.errPriceFloorRent; }
    const a = numOf(f.area); const isLand = f.ptype === 'terreno';
    if (!Number.isFinite(a) || a <= 0) e.area = t.errArea; else if (!isLand && (a < 5 || a > 2000)) e.area = t.errAreaRange;
    if (String(f.contact_phone).replace(/\D/g, '').length < 6) e.contact_phone = t.errPhone;
    if (photos.length < 1) e.photos = t.errPhotos;
    return e;
  };
  const publish = async (openHighlightAfter = false) => {
    const e = validateDetails();
    if (Object.keys(e).length) { setErrs(e); setErr(''); return; }
    setErrs({}); setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.set('mode', f.mode); fd.set('ptype', f.ptype); fd.set('neighborhood', f.neighborhood); fd.set('city', f.city);
      fd.set('price', f.price); fd.set('currency', priceCurrency); fd.set('area', f.area); fd.set('description', f.description);
      fd.set('contact_name', f.contact_name); fd.set('contact_phone', f.contact_phone); fd.set('seller_type', f.seller_type);
      photos.forEach((p) => fd.append('photos', p.file));
      const res = await fetch('/api/publish', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
      track('listing_created', { property_id: j.id, slug: j.slug, ref: j.ref, operation: f.mode, property_type: f.ptype, city: f.city, neighborhood: f.neighborhood, price: f.price ? Number(f.price) : null, currency: priceCurrency, photos: photos.length });
      setResult({ id: j.id, ref: j.ref });
      if (openHighlightAfter) setShowHi(true);
    } catch { setErr(t.errSubmit); } finally { setBusy(false); }
  };

  const fieldCls = (k) => `w-full px-4 py-[13px] border-[1.5px] rounded-input bg-card font-medium text-[15px] outline-none ${errs[k] ? 'border-red-500 focus:border-red-600' : 'border-ink/30 focus:border-ink'}`;
  const FErr = ({ k }) => (errs[k] ? <span className="block mt-1 text-[12.5px] font-medium text-red-600">{errs[k]}</span> : null);

  return (
    <SellFlowContext.Provider value={{ openSell }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-[480px] bg-paper border-[1.5px] border-ink rounded-[20px] sm:rounded-[24px] shadow-hard p-5 sm:p-6 md:p-7 max-h-[92vh] overflow-y-auto cl-scroll">
            <button onClick={close} aria-label={t.close} className="absolute top-4 right-4 w-8 h-8 rounded-pill border border-ink/25 flex items-center justify-center text-ink/60 hover:text-ink">×</button>

            {/* 4-step stepper */}
            <div className="flex items-center gap-1.5 mb-5 mt-1 pr-9">
              {t.steps.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-pill ${i <= step ? 'bg-ink' : 'bg-ink/15'}`} />
              ))}
            </div>

            {/* ---- SUCCESS ---- */}
            {result ? (
              <div className="text-center py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mascot.png" alt="" className="w-[120px] object-contain mx-auto mb-2" />
                <h2 className="text-[24px] font-bold tracking-head mb-1.5">{t.doneTitle}</h2>
                <p className="text-[14px] text-ink/55 mb-1">{t.doneSub}</p>
                <div className="font-mono text-[11px] text-ink/45 mb-5">REF: {result.ref}</div>

                {/* Promotion upsell — publish is already done (free); this is optional. */}
                {highlighted ? (
                  <div className="mb-5 rounded-[16px] border-[1.5px] border-ink bg-card px-4 py-3 text-[13px] font-bold text-ink">{plan === 'home' ? t.hiDoneHome : t.hiDoneVerified}</div>
                ) : (
                  <div className="mb-5 rounded-[16px] border-[1.5px] border-ink bg-card px-4 py-4 text-left shadow-hard-sm">
                    <div className="text-[15px] font-bold tracking-head mb-1">{t.usTitle}</div>
                    <p className="text-[12.5px] text-ink/60 mb-3">{t.usSub}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setPlan('verified'); setShowHi(true); }} className="py-2.5 rounded-pill border-[1.5px] border-ink font-bold text-[13px] hover:bg-ink hover:text-paper transition-colors">{t.usVerify}</button>
                      <button onClick={() => { setPlan('home'); setShowHi(true); }} className="py-2.5 rounded-pill bg-ink text-paper font-bold text-[13px] hover:bg-ink/90">{t.usHome}</button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2.5 justify-center flex-wrap">
                  <button onClick={() => { close(); router.push('/cuenta'); }} className="px-6 py-3 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft">{t.doneDash}</button>
                  <button onClick={() => { const id = result.id; close(); router.push(`/propiedad/${id}`); }} className="px-6 py-3 border-2 border-ink rounded-pill font-semibold text-[14px]">{t.doneView}</button>
                </div>

                {showHi && result?.id && (
                  <HighlightModal
                    propertyId={result.id}
                    plan={plan || 'verified'}
                    lang={lang}
                    propertyLabel={[(t.types.find(([v]) => v === f.ptype) || [])[1], f.neighborhood].filter(Boolean).join(' · ')}
                    onClose={() => setShowHi(false)}
                    onSuccess={() => { setHighlighted(true); setShowHi(false); }}
                  />
                )}
              </div>
            ) : phase === 'otp' ? (
              /* ---- OTP VERIFY overlay ---- */
              <div>
                {emailTaken ? (
                  <>
                    <h2 className="text-[22px] font-bold tracking-head mb-1">{t.haveAccount}</h2>
                    <p className="text-[14px] text-ink/55 mb-4">{t.haveAccountSub(f.email)}</p>
                    <button type="button" onClick={googleSignIn} className="w-full flex items-center justify-center gap-2.5 py-3 border-[1.5px] border-ink/25 rounded-pill font-semibold text-[14px] bg-card hover:border-ink transition-colors">
                      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.1C12.2 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.4z"/><path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.5 10.6l7.9-6.3z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.3-5.7c-2 1.4-4.6 2.3-8 2.3-6.4 0-11.8-3.7-13.6-9.1l-7.9 6.3C6.4 42.6 14.6 48 24 48z"/></svg>
                      {t.googleBtn}
                    </button>
                    <div className="flex items-center gap-3 my-4">
                      <span className="flex-1 h-px bg-ink/12" /><span className="text-[12px] text-ink/40 font-mono">{t.orText}</span><span className="flex-1 h-px bg-ink/12" />
                    </div>
                    <label className={labelCls}>{t.password}</label>
                    <input type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} placeholder={t.passwordPh} className={inputCls} autoComplete="current-password" onKeyDown={(e) => { if (e.key === 'Enter') doLogin(); }} />
                    <button onClick={doLogin} disabled={busy} className="w-full mt-4 px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60 inline-flex items-center justify-center min-h-[48px]">{busy ? <Spinner /> : t.login}</button>
                    <button type="button" onClick={() => openAuth()} className="w-full mt-2 text-[13px] font-medium text-ink/55 hover:text-ink">{t.forgot}</button>
                    {err && <div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3.5 py-2.5">{err}</div>}
                  </>
                ) : (
                  <>
                    <h2 className="text-[22px] font-bold tracking-head mb-2">{t.otpTitle}</h2>
                    <p className="text-[14px] text-ink/55 mb-4">{t.otpSub(f.email)}</p>
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.codePh} inputMode="numeric" autoComplete="one-time-code" className={`${inputCls} text-center tracking-[0.3em] text-[18px] font-semibold`} onKeyDown={(e) => { if (e.key === 'Enter') verifyOtp(); }} />
                    <button onClick={verifyOtp} disabled={busy} className="w-full mt-4 px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60">{busy ? t.verifying : t.verify}</button>
                    <button onClick={sendOtp} disabled={busy} className="w-full mt-2 text-[13px] font-medium text-ink/55 hover:text-ink">{t.resend}</button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* ---- STEP 0 · Operation ---- */}
                {step === 0 && (
                  <div>
                    <h2 className="text-[22px] font-bold tracking-head mb-4">{t.q1}</h2>
                    <div className="flex gap-3">
                      <button onClick={() => { set('mode', 'venta'); setStep(1); }} className={pickCls(f.mode === 'venta')}>{t.sell}</button>
                      <button onClick={() => { set('mode', 'alquiler'); setStep(1); }} className={pickCls(f.mode === 'alquiler')}>{t.rent}</button>
                    </div>
                  </div>
                )}

                {/* ---- STEP 1 · Seller + name + EMAIL ---- */}
                {step === 1 && (
                  <div>
                    <h2 className="text-[22px] font-bold tracking-head mb-4">{t.q2}</h2>
                    <div className="flex gap-3">
                      <button onClick={() => set('seller_type', 'owner')} className={pickCls(f.seller_type === 'owner')}>{t.owner}</button>
                      <button onClick={() => set('seller_type', 'agent')} className={pickCls(f.seller_type === 'agent')}>{t.agent}</button>
                    </div>
                    {f.seller_type && (
                      <div className="mt-5">
                        <label className={labelCls}>{t.name}</label>
                        <input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder={t.namePh} className={`${inputCls} mb-3`} autoComplete="name" />
                        <label className={labelCls}>{t.email}</label>
                        <input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder={t.emailPh} className={inputCls} autoComplete="email" inputMode="email" type="email" />
                      </div>
                    )}
                  </div>
                )}

                {/* ---- STEP 2 · Location ---- */}
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

                {/* ---- STEP 3 · Details + publish ---- */}
                {step === 3 && (
                  <div>
                    <h2 className="text-[22px] font-bold tracking-head mb-1">{t.d4Title}</h2>
                    <p className="text-[13px] text-ink/50 mb-4">{t.d4Sub}</p>
                    <div className="grid grid-cols-1 gap-3">
                      <label className="sm:col-span-2"><span className={labelCls}>{t.fType}</span>
                        <select value={f.ptype} onChange={setField('ptype')} className={`${inputCls} cursor-pointer`}>
                          {t.types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </label>
                      {/* price (long) + area (small) on one row — price is fluid so it
                          gets the width; area + currency stay compact. Fits down to ~360px. */}
                      <div className="flex gap-3">
                        <label className="flex-1 min-w-0"><span className={labelCls}>{t.fPrice(f.mode)}</span>
                          <div className="flex gap-2">
                            <input value={f.price} onChange={setField('price')} inputMode="numeric" placeholder={t.fPricePh(f.mode)} className={`${fieldCls('price')} flex-1 min-w-0`} />
                            <select value={priceCurrency} onChange={setField('currency')} className="px-2.5 py-[13px] border-[1.5px] border-ink/30 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink cursor-pointer w-[68px] sm:w-[80px] shrink-0"><option value="USD">US$</option><option value="PYG">₲</option></select>
                          </div>
                          <FErr k="price" />
                        </label>
                        <label className="w-[86px] sm:w-[116px] shrink-0"><span className={labelCls}>{t.fArea}</span>
                          <input value={f.area} onChange={setField('area')} inputMode="numeric" placeholder="120" className={fieldCls('area')} /><FErr k="area" />
                        </label>
                      </div>
                      <label className="sm:col-span-2"><span className={labelCls}>{t.fPhone}</span>
                        <input value={f.contact_phone} onChange={setField('contact_phone')} placeholder={t.fPhonePh} className={fieldCls('contact_phone')} inputMode="tel" autoComplete="tel" /><FErr k="contact_phone" />
                      </label>
                      <label className="sm:col-span-2"><span className={labelCls}>{t.fDesc}</span>
                        <textarea value={f.description} onChange={setField('description')} rows={3} placeholder={t.fDescPh} className={`${inputCls} resize-y`} />
                      </label>
                    </div>
                    <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}
                      className={`mt-3 border-[1.5px] border-dashed rounded-[16px] p-6 text-center bg-card cursor-pointer ${errs.photos ? 'border-red-500' : 'border-ink/35 hover:border-ink'}`}>
                      <div className="text-[14px] font-semibold mb-0.5">{t.fPhotos}</div>
                      <div className="font-mono text-[11px] text-ink/45">{photos.length ? t.photosChosen(photos.length) : t.fPhotosSub}</div>
                      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                    </div>
                    <FErr k="photos" />
                    {photos.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-3">
                        {photos.map((p, i) => (
                          <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden border border-ink/15">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt="" className="w-full h-full object-cover" />
                            <button onClick={(e) => { e.stopPropagation(); removePhoto(i); }} className="absolute top-1 right-1 w-5 h-5 rounded-pill bg-ink text-paper text-[11px] leading-none flex items-center justify-center">×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Promotion plans — two prominent, mutually-exclusive boxes. */}
                    <div className="mt-4">
                      <div className="text-[13px] font-semibold mb-2">{t.planTitle}</div>
                      <div className="grid gap-2.5">
                        <PlanBox on={plan === 'verified'} onClick={() => setPlan((p) => (p === 'verified' ? null : 'verified'))} title={t.v5Title} price={t.v5Price} benefits={[]} icon={<VerifiedIcon className="w-4 h-4" />} />
                        <PlanBox on={plan === 'home'} onClick={() => setPlan((p) => (p === 'home' ? null : 'home'))} title={t.v20Title} price={t.v20Price} benefits={[]} icon={<VerifiedIcon className="w-4 h-4" />} badge={<RecommendedTag lang={lang} className="text-[8px] px-1.5 py-0.5" />} />
                      </div>
                    </div>
                  </div>
                )}

                {err && <div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3.5 py-2.5">{err}</div>}

                {/* nav */}
                {step > 0 && (
                  <div className="flex items-center justify-between gap-2 mt-6">
                    <button onClick={back} className="text-[13px] font-medium text-ink/55 hover:text-ink shrink-0">{t.back}</button>
                    {step < 3 ? (
                      <button onClick={next} disabled={busy} className="px-7 py-3 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60 inline-flex items-center justify-center min-w-[108px]">{busy ? <Spinner /> : t.next}</button>
                    ) : (
                      <button onClick={() => publish(plan)} disabled={busy} className="px-7 py-3 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60">{busy ? t.publishing : (plan === 'home' ? t.publishHome : plan === 'verified' ? t.publishVerified : t.publishBtn)}</button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </SellFlowContext.Provider>
  );
}
