'use client';
// Sell flow — a 5-step popup wizard that a logged-out visitor completes end to end
// WITHOUT leaving the popup:
//   1) Operation (sell / rent)
//   2) Seller (owner/agent) + name + EMAIL
//   3) Location (address) + property type
//   4) Details (price, area, phone, description, photos)
//   -> we confirm the email (Google, or a code verified inline: the account is
//      created + they're logged in on the spot — no password screen)
//   5) Confirm: a short summary + "I confirm my details are correct" + optional
//      visibility plan -> Publish (then Stripe, or the saved card, for a plan)
// The listing is posted from step 5; we never route to /publicar. A LOGGED-IN user
// gets the same wizard, minus the parts we already know: their name and email are
// taken from the session and the confirmation step is skipped entirely.
import { typeOptions, normalizeTypeKey, areaRange } from '@/lib/propertyTypeOptions';
import { createContext, useContext, useState, useCallback, useRef, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import { track } from '@/lib/analytics';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import HighlightModal from '@/components/HighlightModal';
import RecommendedTag from '@/components/RecommendedTag';
import PlanBox from '@/components/PlanBox';
import { VerifiedIcon } from '@/components/VerifiedTag';
import { savePendingSell, loadPendingSell, clearPendingSell, saveProgressPhotos, loadProgressPhotos, clearProgressPhotos } from '@/lib/pendingSell';
import { cleanDraftData, draftReady } from '@/lib/drafts';
import { isSellLinkClick } from '@/lib/sellLink';
import { COUNTRY } from '@/lib/country';

const SellFlowContext = createContext({ openSell: () => {} });
export const useSellFlow = () => useContext(SellFlowContext);

const DICT = {
  es: {
    steps: ['Operación', 'Vendedor', 'Ubicación', 'Detalles', 'Confirmar'],
    q1: '¿Qué querés hacer?', sell: 'Vender', rent: 'Alquilar',
    q2: '¿Sos el propietario o un agente?', owner: 'Propietario', agent: 'Agente',
    name: 'Tu nombre', namePh: 'Ana Giménez', email: 'Tu correo electrónico', emailPh: 'ana@correo.com',
    termsPre: 'Acepto los ', termsLink: 'Términos y Condiciones', termsMid: ' y la ', privacyLink: 'Política de Privacidad', errTerms: 'Para continuar, aceptá los Términos y Condiciones.',
    q3: '¿Dónde está la propiedad?', addrPh: 'Escribí la dirección…', addrHint: 'Elegí una dirección de la lista para estandarizarla.',
    barrio: 'Barrio', ciudad: 'Ciudad',
    verifyTitle: 'Confirmá tu email', verifySub: (e) => `Para publicar, continuá con Google o te enviamos un código de 6 dígitos a ${e}.`, sendCode: 'Enviar código',
    otpTitle: 'Código de confirmación enviado', otpSub: (e) => `Ingresá el código que enviamos a ${e} para verificar tu correo.`,
    codePh: 'Código de 6 dígitos', verify: 'Verificar', verifying: 'Verificando…', resend: 'Reenviar código', resent: 'Código reenviado',
    haveAccount: 'Ya existe una cuenta', existsSub: (e) => `${e} ya tiene una cuenta en Casa Libre. Ingresá con Google o te enviamos un código de 6 dígitos.`, haveAccountSub: (e) => `Te enviamos un código a ${e}. Ingresalo para continuar.`, googleBtn: 'Continuar con Google', orText: 'o', login: 'Ingresar', errGeneric: 'Algo salió mal. Intentá de nuevo.', doneDash: 'Ir a mi panel',
    d4Title: 'Detalles de la propiedad', d4Sub: 'Completá los datos de tu propiedad.',
    cTitle: 'Confirmá los datos', cSub: 'Revisá tu propiedad antes de publicarla.', cCheck: 'Confirmo que los datos son correctos', errConfirm: 'Confirmá que los datos son correctos para publicar.',
    cOp: 'Operación', cAddr: 'Dirección', cPhone: 'WhatsApp', cContact: 'Contacto', cPhotos: (n) => `${n} foto${n === 1 ? '' : 's'}`,
    fType: 'Tipo de propiedad', typePh: 'Seleccioná el tipo', types: typeOptions('es'),
    fPrice: (m) => (m === 'venta' ? 'Precio' : 'Alquiler mensual'), fPricePh: (m) => (m === 'venta' ? '145.000' : '4.500.000'),
    fArea: 'Superficie (m²)', fDesc: 'Descripción', fDescPh: 'Depto luminoso con balcón, a 2 cuadras del Shopping del Sol…',
    fPhone: 'WhatsApp / teléfono (para compradores)', fPhonePh: '0981 123 456',
    fPhotos: 'Arrastrá o elegí tus fotos', fPhotosSub: 'mín. 1 foto · JPG o PNG', photosChosen: (n) => `${n} foto${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}`,
    publishBtn: 'Publicar gratis', publishing: 'Publicando…',
    backToApp: 'Volver a la app',
    doneTitle: '¡Tu propiedad está publicada!', doneSub: 'Ya aparece en el marketplace de Casa Libre.', doneView: 'Ver mi propiedad', doneBrowse: 'Ver propiedades',
    // Promotion plans (optional paid visibility at publish) — two boxes, pick one.
    planTitle: 'Sumá visibilidad',
    v5Title: 'Insignia Verificada en el marketplace', v5Price: 'US$5 · 30 días',
    v20Title: 'Mostrá tu propiedad en la portada con la insignia Verificada', v20Price: 'US$20 · 30 días',
    publishVerified: 'Publicar por US$5', publishHome: 'Publicar por US$20',
    usTitle: 'Sumá visibilidad a tu propiedad', usSub: 'Elegí un plan y destacá tu aviso por 30 días.',
    usVerify: 'Verificar · US$5', usHome: 'En la portada · US$20', payingMsg: 'Procesando pago…',
    hiDoneVerified: '¡Tu propiedad está verificada por 30 días!', hiDoneHome: '¡Tu propiedad está en la portada por 30 días!',
    next: 'Siguiente', back: '← Atrás', close: 'Cerrar', sending: 'Enviando…',
    errSeller: 'Elegí propietario o agente', errName: 'Ingresá tu nombre', errEmail: 'Ingresá un correo válido', errAddr: 'Elegí una dirección',
    errSendOtp: 'No se pudo enviar el código. Intentá de nuevo.', emailTaken: 'Este correo ya tiene una cuenta.', loginInstead: 'Iniciar sesión para continuar',
    errCode: 'Código inválido o vencido', errType: 'Seleccioná el tipo de propiedad', errPrice: 'Ingresá un precio válido',
    errPriceFloorSale: 'El precio de venta debe ser de al menos US$ 5.000', errPriceFloorRent: `El alquiler mensual debe ser de al menos ${COUNTRY.currencySymbol} ${COUNTRY.rentFloorLocal.toLocaleString('es-PY')}`,
    currencyPh: 'Moneda', errCurrency: 'Elegí la moneda', extraNote: 'Se publica en US$, convertido al cambio del día.',
    resumedNote: 'Seguimos donde lo dejaste.', startOver: 'Empezar de nuevo',
    errArea: 'Ingresá la superficie', errAreaRange: (max) => `La superficie debe estar entre 5 y ${max.toLocaleString('es-PY')} m²`, errPhone: 'Ingresá un teléfono válido', errPhotos: 'Agregá al menos una foto',
    errSubmit: 'No se pudo publicar. Intentá de nuevo.',
  },
  en: {
    steps: ['Operation', 'Seller', 'Location', 'Details', 'Confirm'],
    q1: 'What do you want to do?', sell: 'Sell', rent: 'Rent out',
    q2: 'Are you the owner or an agent?', owner: 'Owner', agent: 'Agent',
    name: 'Your name', namePh: 'Ana Giménez', email: 'Your email', emailPh: 'ana@email.com',
    termsPre: 'I agree to the ', termsLink: 'Terms of Service', termsMid: ' and the ', privacyLink: 'Privacy Policy', errTerms: 'To continue, please accept the Terms of Service.',
    q3: 'Where is the property?', addrPh: 'Type the address…', addrHint: 'Pick an address from the list to standardize it.',
    barrio: 'Neighborhood', ciudad: 'City',
    verifyTitle: 'Confirm your email', verifySub: (e) => `To publish, continue with Google or we'll email a 6-digit code to ${e}.`, sendCode: 'Send code',
    otpTitle: 'Confirmation code sent', otpSub: (e) => `Enter the code we emailed to ${e} to verify your email.`,
    codePh: '6-digit code', verify: 'Verify', verifying: 'Verifying…', resend: 'Resend code', resent: 'Code resent',
    haveAccount: 'Account already exists', existsSub: (e) => `${e} already has a Casa Libre account. Log in with Google or we'll email you a 6-digit code.`, haveAccountSub: (e) => `We sent a code to ${e}. Enter it to continue.`, googleBtn: 'Continue with Google', orText: 'or', login: 'Log in', errGeneric: 'Something went wrong. Try again.', doneDash: 'Go to my dashboard',
    d4Title: 'Property details', d4Sub: 'Fill in your property\'s details.',
    cTitle: 'Confirm the details', cSub: 'Check your property before you publish it.', cCheck: 'I confirm my details are correct', errConfirm: 'Please confirm your details are correct to publish.',
    cOp: 'Operation', cAddr: 'Address', cPhone: 'WhatsApp', cContact: 'Contact', cPhotos: (n) => `${n} photo${n === 1 ? '' : 's'}`,
    fType: 'Property type', typePh: 'Select the type', types: typeOptions('en'),
    fPrice: (m) => (m === 'venta' ? 'Price' : 'Monthly rent'), fPricePh: (m) => (m === 'venta' ? '145,000' : '4,500,000'),
    fArea: 'Area (m²)', fDesc: 'Description', fDescPh: 'Bright apartment with balcony, 2 blocks from Shopping del Sol…',
    fPhone: 'WhatsApp / phone (for buyers)', fPhonePh: '0981 123 456',
    fPhotos: 'Drag or choose your photos', fPhotosSub: 'min. 1 photo · JPG or PNG', photosChosen: (n) => `${n} photo${n === 1 ? '' : 's'} selected`,
    publishBtn: 'Publish for free', publishing: 'Publishing…',
    backToApp: 'Back to the app',
    doneTitle: 'Your listing is live!', doneSub: 'It already shows in the Casa Libre marketplace.', doneView: 'View my listing', doneBrowse: 'Browse listings',
    // Promotion plans (optional paid visibility at publish) — two boxes, pick one.
    planTitle: 'Add visibility',
    v5Title: 'Verified badge on marketplace', v5Price: 'US$5 · 30 days',
    v20Title: 'Display your property on the Home page with the Verified badge', v20Price: 'US$20 · 30 days',
    publishVerified: 'Publish for US$5', publishHome: 'Publish for US$20',
    usTitle: 'Add visibility to your listing', usSub: 'Pick a plan to feature your listing for 30 days.',
    usVerify: 'Verify · US$5', usHome: 'On the home page · US$20', payingMsg: 'Processing payment…',
    hiDoneVerified: 'Your listing is verified for 30 days!', hiDoneHome: 'Your listing is on the home page for 30 days!',
    next: 'Next', back: '← Back', close: 'Close', sending: 'Sending…',
    errSeller: 'Choose owner or agent', errName: 'Enter your name', errEmail: 'Enter a valid email', errAddr: 'Choose an address',
    errSendOtp: 'Could not send the code. Please try again.', emailTaken: 'This email already has an account.', loginInstead: 'Log in to continue',
    errCode: 'Invalid or expired code', errType: 'Select the property type', errPrice: 'Enter a valid price',
    errPriceFloorSale: 'Sale price must be at least US$ 5,000', errPriceFloorRent: `Monthly rent must be at least ${COUNTRY.currencySymbol} ${COUNTRY.rentFloorLocal.toLocaleString('en-US')}`,
    currencyPh: 'Currency', errCurrency: 'Choose the currency', extraNote: "Published in US$, converted at today's rate.",
    resumedNote: 'Picking up where you left off.', startOver: 'Start over',
    errArea: 'Enter the area', errAreaRange: (max) => `Area must be between 5 and ${max.toLocaleString('en-US')} m²`, errPhone: 'Enter a valid phone', errPhotos: 'Add at least one photo',
    errSubmit: 'Could not publish. Please try again.',
  },
};

const inputCls = 'w-full px-4 py-[13px] border-[1.5px] border-ink/30 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink';
const labelCls = 'block text-[13px] font-semibold mb-1.5';
const pickCls = (on) => `flex-1 px-5 py-3.5 rounded-pill border-[1.5px] text-[15px] font-semibold transition-colors ${on ? 'bg-ink text-paper border-ink' : 'bg-card border-ink hover:bg-hatch2'}`;   // round pills — same shape as the Buy / Sell / Rent CTAs
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
// This country's currency per US$ (offline fallback; the server checks with the live rate).
const APPROX_RATE = COUNTRY.fxFallback || 7300;
const numOf = (v) => Number(String(v).replace(/[^\d.]/g, ''));

// Inline loading spinner — used on the Next / Log in buttons instead of a text label.
const Spinner = () => (
  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// The wizard's progress, kept in this browser while it's closed — from the first click,
// at every step — so reopening goes straight back to where the person was:
// { owner: account id | 'guest', step, f, draftId, termsOk, at, dismissed }. Photos are
// kept in IndexedDB (lib/pendingSell). Only shown to the same owner, so on a shared
// computer one person's listing never opens for someone else. `dismissed` = drafts they
// chose "Start over" on (not offered again automatically). Fail-soft.
const PROGRESS = 'cl_sell_progress';
const PROGRESS_DAYS = 30;
const readProgress = () => { try { return JSON.parse(localStorage.getItem(PROGRESS) || 'null') || {}; } catch { return {}; } };
const writeProgress = (v) => { try { localStorage.setItem(PROGRESS, JSON.stringify(v)); } catch { /* storage blocked */ } };
// This browser's random key for drafts saved while not signed in (lib/guestDrafts.js).
const GUEST_KEY = 'cl_guest_key';
const guestKey = () => {
  try {
    let key = localStorage.getItem(GUEST_KEY);
    if (!key && typeof crypto !== 'undefined' && crypto.randomUUID) { key = crypto.randomUUID(); localStorage.setItem(GUEST_KEY, key); }
    return key || null;
  } catch { return null; }
};

// Property-type picker: a small list that drops DOWN under the field and floats over
// the form, like the address suggestions (a native <select> opened upward when it sat
// low in the window). Positioned to the field on the screen, so the popup's scroll
// box never cuts it off; it follows the field when the page or popup scrolls.
function TypePicker({ value, onChange, options, placeholder, invalid }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width, maxHeight: Math.max(150, Math.min(280, window.innerHeight - r.bottom - 12)) });
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    place();
    const onDown = (e) => { if (!btnRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place]);
  const label = (options.find(([v]) => v === value) || [])[1];
  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} data-testid="sell-ptype"
        className={`w-full flex items-center justify-between gap-2 px-4 py-[13px] border-[1.5px] rounded-input bg-card font-medium text-[15px] text-left outline-none ${invalid ? 'border-red-500' : open ? 'border-ink' : 'border-ink/30 focus:border-ink'}`}>
        <span className={label ? 'text-ink' : 'text-ink/45'}>{label || placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-ink/60 transition-transform ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && pos && (
        <ul ref={listRef} role="listbox" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, zIndex: 1100 }}
          className="overflow-y-auto cl-scroll bg-white border border-ink/15 rounded-[10px] shadow-[0_6px_20px_rgba(17,17,17,.14)] py-1">
          {options.map(([v, l]) => (
            <li key={v} role="option" aria-selected={v === value}>
              <button type="button" onClick={() => { onChange(v); setOpen(false); }} data-testid={`sell-ptype-${v}`}
                className={`w-full text-left px-4 py-2 text-[14px] ${v === value ? 'font-semibold bg-ink/[.06]' : 'hover:bg-ink/[.04]'}`}>{l}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function SellFlowProvider({ children }) {
  const [lang] = useLang();
  const t = DICT[lang];
  const router = useRouter();
  const { user, loading: authLoading, openAuth, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);          // 0 op · 1 seller · 2 location + type · 3 details · 4 confirm
  const [phase, setPhase] = useState('');        // '' | 'otp' — email-confirm overlay between step 3 and 4
  const [confirmOk, setConfirmOk] = useState(false);   // "I confirm my details are correct" (step 4)
  const [resumed, setResumed] = useState(false);       // reopened a draft saved while not signed in
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [termsOk, setTermsOk] = useState(false);   // Terms of Service opt-in (step 1)
  const [errs, setErrs] = useState({});
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [loginCode, setLoginCode] = useState('');   // sign-in code for an email that already has an account
  const [codeSent, setCodeSent] = useState(false);  // the visitor clicked "Send code" on the confirm-email screen
  const [photos, setPhotos] = useState([]);      // {file,url}
  const [result, setResult] = useState(null);    // {id, ref}
  const [showHi, setShowHi] = useState(false);    // promotion payment modal (only when a card must be entered / 3DS)
  const [highlighted, setHighlighted] = useState(false);
  const [paying, setPaying] = useState(false);    // silently charging a saved card (no modal)
  const [plan, setPlan] = useState(null);         // selected promo plan: null | 'verified' | 'home'
  const fileRef = useRef(null);
  const openedLoggedInRef = useRef(false);        // wizard was opened by a signed-in user
  const [fromApp, setFromApp] = useState(false);  // arrived from the mobile app (?app=1)
  const [appReturn, setAppReturn] = useState('');  // the app's own deep-link URL (?ret=…)
  const BLANK = { mode: '', seller_type: '', neighborhood: '', city: '', addressText: '', contact_name: '', email: '', ptype: '', price: '', currency: '', area: '', description: '', contact_phone: '' };
  const [f, setF] = useState(BLANK);
  // Draft ("Borrador"): created once a signed-in user has picked the address, then
  // autosaved on every change until the listing is published (the server deletes it).
  const [draftId, setDraftId] = useState(null);
  const creatingDraftRef = useRef(false);

  const reset = () => {
    setStep(0); setPhase(''); setErr(''); setErrs({}); setBusy(false); setCode(''); setVerified(false); setEmailTaken(false); setLoginCode(''); setCodeSent(false); setPhotos([]); setResult(null); setShowHi(false); setHighlighted(false); setPaying(false); setPlan(null); setConfirmOk(false); setResumed(false);
    setF(BLANK); setDraftId(null); creatingDraftRef.current = false;
  };
  const close = () => { setOpen(false); reset(); };

  // Photos stashed before the Google redirect come back as File objects.
  const restorePhotos = (files) => setPhotos((files || []).filter(Boolean).map((file) => ({ file, url: URL.createObjectURL(file) })));

  // Resume with everything we already have — a saved draft (details step; the type
  // is asked with the address, so a draft without it opens there) or the way back
  // from Google sign-in (toConfirm: the details were filled before signing in).
  const openAtDetails = (fields, id = null, { photos: files = null, toConfirm = false } = {}) => {
    reset();
    openedLoggedInRef.current = true;
    setVerified(true);
    setF({ ...BLANK, ...fields, ptype: normalizeTypeKey(fields.ptype), contact_name: fields.contact_name || user?.full_name || user?.name || '', email: user?.email || '' });
    if (files) restorePhotos(files);
    if (id) { setDraftId(id); creatingDraftRef.current = true; }
    setStep(!draftReady(fields) ? 0 : !fields.ptype ? 2 : toConfirm ? 4 : 3);
    setOpen(true);
  };

  // Back from Google WITHOUT signing in: same wizard, on the confirm-email screen
  // (Google / Send code), with what they had entered. Terms were accepted in step 1.
  const reopenAtConfirm = async (fields, files = null) => {
    reset();
    openedLoggedInRef.current = false;
    setF({ ...BLANK, ...fields });
    if (files) restorePhotos(files);
    setTermsOk(true);
    if (!fields.email || !fields.neighborhood) { setStep(fields.seller_type ? 1 : 0); setOpen(true); return; }
    setStep(3);
    setOpen(true);
    setEmailTaken(await emailExists(fields.email));
    setPhase('otp');
  };

  const me = user?.id || 'guest';

  // A fresh wizard (signed in: name/email prefilled, no email-confirm step).
  const freshStart = () => {
    reset();
    openedLoggedInRef.current = !!user;
    if (user) {
      setVerified(true);
      setF((s0) => ({ ...s0, contact_name: user.full_name || user.name || '', email: user.email || '' }));
    }
  };

  // Reopen what this browser was in the middle of — the same step, fields, draft and
  // photos — instantly (no step-1 flash). A guest draft the server no longer has
  // (published, or moved into an account) is checked in the background; the next
  // autosave then starts a fresh one. → true when something was restored.
  const resumeProgress = () => {
    const pr = readProgress();
    if (pr.owner !== me || !pr.f || (!pr.step && !pr.f.mode) || Date.now() - (pr.at || 0) > PROGRESS_DAYS * 86400000) return false;
    setF({ ...BLANK, ...pr.f, ptype: normalizeTypeKey(pr.f.ptype), ...(user ? { email: user.email || pr.f.email, contact_name: pr.f.contact_name || user.full_name || user.name || '' } : {}) });
    setStep(Math.min(pr.step || 0, user ? 4 : 3));
    setDraftId(pr.draftId || null);
    if (user && pr.draftId) creatingDraftRef.current = true;
    setTermsOk(!!pr.termsOk);
    setResumed(true);
    loadProgressPhotos().then((x) => { if (x?.owner === me && x.files?.length) restorePhotos(x.files); }).catch(() => {});
    if (!user && pr.draftId && pr.f.email) {
      const key = guestKey();
      if (key) fetch(`/api/drafts/guest?${new URLSearchParams({ email: pr.f.email, key, id: pr.draftId })}`).then((r) => { if (r.status === 404) setDraftId((cur) => (cur === pr.draftId ? null : cur)); }).catch(() => {});
    }
    return true;
  };

  // Signed in with nothing in progress on this browser → their latest draft (saved on
  // another device, or before), unless they chose "Start over" on it.
  const latestDraft = async () => {
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 2500);
    try {
      const r = await fetch('/api/drafts', { signal: ctrl.signal });
      const j = await r.json().catch(() => ({}));
      const dismissed = readProgress().dismissed || [];
      return (j.drafts || []).find((d) => !dismissed.includes(d.id)) || null;
    } catch { return null; } finally { clearTimeout(tm); }
  };

  // "Start over": forget this browser's progress (the draft itself stays in My
  // listings → Drafts) and begin a new listing.
  const startOver = () => {
    const pr = readProgress();
    writeProgress({ owner: me, dismissed: [...new Set([...(pr.dismissed || []), draftId].filter(Boolean))].slice(-20) });
    clearProgressPhotos();
    freshStart();
    setOpen(true);
  };

  // Logged in or not, everyone gets the wizard, back where they left it when they
  // closed it. When we already know the person we prefill their name/email and skip
  // the email-verification step.
  // openSell({ draft }) resumes one of the user's drafts at the details step.
  // (Also used directly as an onClick handler, so ignore anything that isn't options.)
  const openSell = useCallback(async (opts) => {
    const draft = opts && typeof opts === 'object' && opts.draft ? opts.draft : null;
    if (draft && user) {
      openAtDetails(draft.data || {}, draft.id);
      track('sell_draft_resumed', {});
      return;
    }
    freshStart();
    const resumedLocal = resumeProgress();
    if (!resumedLocal && user) {
      const d = await latestDraft();
      if (d) { openAtDetails(d.data || {}, d.id); setResumed(true); track('sell_draft_resumed', { auto: true }); return; }
    }
    setOpen(true);
    track('sell_wizard_opened', { signed_in: !!user, resumed: resumedLocal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Remember the progress on every change while the wizard is open (until published)…
  useEffect(() => {
    if (!open || result || (step === 0 && !f.mode)) return;
    writeProgress({ owner: me, step, f, draftId, termsOk, at: Date.now(), dismissed: readProgress().dismissed || [] });
  }, [open, result, step, f, draftId, termsOk, me]);
  // …and its photos (IndexedDB — files don't fit in localStorage).
  useEffect(() => {
    if (!open || result) return;
    saveProgressPhotos({ owner: me, files: photos.map((p) => p.file) });
  }, [open, result, photos, me]);

  // The mobile app opens the site at /?sell=1&app=1 — open the wizard straight away
  // so the person never lands on a page that just talks about listing.
  // ?sell=resume = back from Google sign-in mid-wizard: reopen it at the details
  // step with what they had entered (stashed in IndexedDB before the redirect).
  // ?sell=back (browser Back from Google's page) or ?auth_error (Cancel on Google's
  // page) while not signed in: reopen it on the confirm-email screen instead.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || autoOpenedRef.current || authLoading) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('app') === '1') setFromApp(true);
    if (q.get('ret')) setAppReturn(q.get('ret'));
    const sell = q.get('sell');
    const authErr = q.get('auth_error');
    if (sell === '1' || sell === 'resume' || sell === 'back' || authErr || q.get('publicar') === '1') {
      autoOpenedRef.current = true;
      // drop the params so a refresh doesn't reopen the wizard over the listing
      const url = new URL(window.location.href);
      url.searchParams.delete('sell'); url.searchParams.delete('publicar'); url.searchParams.delete('auth_error');
      window.history.replaceState(window.history.state, '', url.toString());
      if (sell === '1' || q.get('publicar') === '1') { openSell(); return; }
      (async () => {
        const pending = await loadPendingSell();
        // Cancel on Google lands on /?auth_error — only ours if the stash is recent.
        if (authErr && !(pending?.savedAt && Date.now() - pending.savedAt < 60 * 60 * 1000)) return;
        await clearPendingSell();
        if (!user) {                              // sign-in didn't complete → back to the confirm screen
          if (pending?.fields) { if (pending.fromApp) setFromApp(true); if (pending.appReturn) setAppReturn(pending.appReturn); reopenAtConfirm(pending.fields, pending.photos); track('sell_google_abandoned', {}); }
          return;
        }
        if (!pending && sell !== 'resume') return;   // signed in and nothing stashed: leave the page as is
        const x = pending?.fields || {};
        if (pending?.fromApp) setFromApp(true);
        if (pending?.appReturn) setAppReturn(pending.appReturn);
        openAtDetails(x, pending?.draftId || null, { photos: pending?.photos, toConfirm: !!pending });
        track('sell_google_resumed', {});
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSell, authLoading]);

  // Restored from the back/forward cache (Back from Google's page): the wizard is
  // still open as it was, so just drop the ?sell=back marker.
  useEffect(() => {
    const onShow = (e) => {
      if (!e.persisted) return;
      const u = new URL(window.location.href);
      if (u.searchParams.get('sell') !== 'back') return;
      u.searchParams.delete('sell');
      window.history.replaceState(window.history.state, '', u.toString());
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  // A signed-out visitor who clicks any "List for free" / "Sell" link (they all point
  // at /publicar) gets the wizard right here, over the page they're on — not the
  // "You need an account to post" screen. Capture phase on window runs before Next's
  // <Link>, which skips navigating once the click is defaultPrevented.
  useEffect(() => {
    if (authLoading || user) return undefined;
    const onClick = (e) => {
      const a = e.target?.closest?.('a[href]');
      if (!a || !isSellLinkClick({
        href: a.href, origin: window.location.origin, button: e.button,
        metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey,
        target: a.getAttribute('target'), download: a.hasAttribute('download'), defaultPrevented: e.defaultPrevented,
      })) return;
      e.preventDefault();
      openSell();
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [authLoading, user, openSell]);

  // Create the draft as soon as a signed-in user has chosen the address…
  useEffect(() => {
    if (!open || !user || result || draftId || creatingDraftRef.current || !draftReady(f)) return;
    creatingDraftRef.current = true;
    (async () => {
      try {
        const r = await fetch('/api/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: cleanDraftData(f) }) });
        const j = await r.json().catch(() => ({}));
        if (j.draft?.id) { setDraftId(j.draft.id); window.dispatchEvent(new Event('cl:listings-changed')); } else creatingDraftRef.current = false;
      } catch { creatingDraftRef.current = false; }
    })();
  }, [open, user, result, draftId, f]);

  // …and keep it in sync while they fill the rest (debounced).
  const draftJson = JSON.stringify(cleanDraftData(f));
  useEffect(() => {
    if (!open || !user || !draftId || result) return undefined;
    const id = setTimeout(() => {
      fetch(`/api/drafts/${draftId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: JSON.parse(draftJson) }) })
        .then((r) => { if (r.status === 404) { creatingDraftRef.current = false; setDraftId(null); } })   // deleted / published elsewhere → start a new one
        .catch(() => {});
    }, 700);
    return () => clearTimeout(id);
  }, [open, user, draftId, result, draftJson]);

  // Not signed in: the same draft, saved under their email + this browser's key
  // (lib/guestDrafts.js) once the address is picked — closing the wizard loses
  // nothing, and signing in later puts it in My listings → Drafts. When they confirm
  // their email mid-wizard, the signed-in autosave above carries on with this draft.
  const guestDraftIdRef = useRef(null);
  useEffect(() => { guestDraftIdRef.current = draftId; }, [draftId]);
  useEffect(() => {
    if (!open || user || authLoading || result || !emailOk(f.email) || !draftReady(f)) return undefined;
    const id = setTimeout(async () => {
      const key = guestKey();
      if (!key) return;
      try {
        const r = await fetch('/api/drafts/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email, key, id: guestDraftIdRef.current, data: JSON.parse(draftJson) }) });
        const j = await r.json().catch(() => ({}));
        if (!j.draft?.id) return;
        if (j.draft.id !== guestDraftIdRef.current) setDraftId(j.draft.id);
      } catch { /* offline: try again on the next change */ }
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, authLoading, result, f.email, draftJson]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setField = (k) => (e) => { const v = e.target.value; setF((s) => ({ ...s, [k]: v })); setErrs((er) => (er[k] ? { ...er, [k]: undefined } : er)); };
  // No default: the seller chooses US$ or this country's currency (Venezuela's site is US$ only).
  // Venezuela's form also offers bolívars (COUNTRY.extraCurrency), converted to US$ on publish.
  const priceCurrency = f.currency === 'USD' || f.currency === COUNTRY.currencyCode || f.currency === COUNTRY.extraCurrency?.code ? f.currency : '';
  const curSymbol = (c) => (c === 'USD' ? 'US$' : c === COUNTRY.extraCurrency?.code ? COUNTRY.extraCurrency.symbol : COUNTRY.currencySymbol);

  // If a returning user logs in via the fallback auth modal while the wizard is
  // open (e.g. their email was already registered), jump them straight to confirm.
  // Not when the wizard was opened by someone already signed in — they still have
  // to choose the operation, say whether they're the owner, and fill everything in.
  const advancedRef = useRef(false);
  useEffect(() => {
    if (openedLoggedInRef.current) return;
    const cameFromLoginOverlay = phase === 'otp' || emailTaken;
    if (user && open && cameFromLoginOverlay && step < 4 && !advancedRef.current) { advancedRef.current = true; setPhase(''); setStep(4); }
    if (!user) advancedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, open, phase, emailTaken]);

  // ---- step navigation ----
  const collectValid = () => {
    if (step === 1) return !!f.seller_type && (!!user || (f.contact_name.trim() && emailOk(f.email))) && termsOk;
    if (step === 2) return !!f.neighborhood && !!f.ptype;
    return true;
  };
  const collectErr = () => (step === 1
    ? (!f.seller_type ? t.errSeller : !user && !f.contact_name.trim() ? t.errName : !user && !emailOk(f.email) ? t.errEmail : t.errTerms)
    : !f.neighborhood ? t.errAddr : t.errType);
  // A signed-in visitor never sees the email-confirm step: their email is already verified.
  const next = async () => {
    // after the details → confirm the email (Google / code), then the confirm screen
    if (step === 3) {
      const e = validateDetails();
      if (e.ptype) { setErrs({ ptype: e.ptype }); setErr(''); setStep(2); return; }   // the type is asked with the address
      if (Object.keys(e).length) { setErrs(e); setErr(''); return; }
      setErrs({}); setErr('');
      if (verified) { setStep(4); return; }
      setCodeSent(false); setCode(''); setLoginCode('');
      setBusy(true); const exists = await emailExists(); setBusy(false);
      setEmailTaken(exists); setPhase('otp'); return;
    }
    if (!collectValid()) {
      setErr(collectErr());
      if (step === 2 && f.neighborhood && !f.ptype) setErrs((er) => ({ ...er, ptype: t.errType }));
      return;
    }
    setErr('');
    setStep((s) => s + 1);
  };
  const back = () => { setErr(''); setEmailTaken(false); setCodeSent(false); if (phase === 'otp') { setPhase(''); return; } setStep((s) => Math.max(s - 1, 0)); };

  // Does the email already have an account? Only decides what the confirm screen says
  // (nothing is sent). Unknown / slow → treated as new; Send code still finds out.
  const emailExists = async (email = f.email) => {
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch('/api/auth/email-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }), signal: ctrl.signal });
      const j = await res.json().catch(() => ({}));
      return !!j.exists;
    } catch { return false; } finally { clearTimeout(tm); }
  };
  // "Send code" for an email we already know has an account → the login code.
  const sendExistingCode = async () => {
    setBusy(true);
    try { if (await sendLoginCode()) { setLoginCode(''); setCodeSent(true); } } finally { setBusy(false); }
  };

  // ---- email OTP (inline, no password screen) ----
  // Runs only when the visitor clicks "Send code" (or "Resend code").
  const sendOtp = async () => {
    setBusy(true); setErr(''); setEmailTaken(false);
    try {
      const res = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email, fullName: f.contact_name, mode: f.mode, seller_type: f.seller_type, neighborhood: f.neighborhood, city: f.city, address: f.addressText }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 || j.error === 'email_taken') { setEmailTaken(true); setLoginCode(''); setPhase('otp'); if (await sendLoginCode()) setCodeSent(true); return; }
      if (!res.ok || !j.ok) { setErr(t.errSendOtp); return; }
      setPhase('otp'); setCode(''); setCodeSent(true);
      track('sell_otp_sent', {});
    } catch { setErr(t.errSendOtp); } finally { setBusy(false); }
  };
  const verifyOtp = async () => {
    if (String(code).replace(/\D/g, '').length < 4) { setErr(t.errCode); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email, code: String(code).trim(), fullName: f.contact_name }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { setErr(t.errCode); return; }
      track('sell_otp_verified', {});
      setVerified(true); setPhase(''); setStep(4);   // account created + logged in → confirm screen
      refreshUser?.();                                // reflect the new session in the header/app immediately (was showing "not logged in")
    } catch { setErr(t.errCode); } finally { setBusy(false); }
  };

  // ---- returning user (email already registered): inline Google / code login ----
  // Instead of showing "email taken" and opening the full auth modal, we keep the
  // user in the wizard: we email them a sign-in code (their email is known from
  // step 1) or they use Google. On success we jump straight to confirm (step 4).
  const googleSignIn = async () => {
    setErr('');
    try {
      // Stash what the guest entered (details + photo files), then come back to THIS
      // page with ?sell=resume: the wizard reopens at confirm, signed in — same as the
      // code path.
      await savePendingSell({ fields: { mode: f.mode, seller_type: f.seller_type, contact_name: f.contact_name, email: f.email, neighborhood: f.neighborhood, city: f.city, addressText: f.addressText, ptype: f.ptype, price: f.price, currency: f.currency, area: f.area, description: f.description, contact_phone: f.contact_phone }, photos: photos.map((p) => p.file), fromApp, appReturn, savedAt: Date.now() });
      const here = /^\/[A-Za-z0-9/_-]*$/.test(window.location.pathname) ? window.location.pathname : '/';
      const r = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next: `${here}?sell=resume` }) });
      const j = await r.json().catch(() => ({}));
      if (!j.url) { setErr(t.errGeneric); return; }
      // If they press Back on Google's page, this page reloads with ?sell=back and the
      // wizard reopens where they were.
      try { const back = new URL(window.location.href); back.searchParams.set('sell', 'back'); window.history.replaceState(window.history.state, '', back.toString()); } catch {}
      window.location.href = j.url;
    } catch { setErr(t.errGeneric); }
  };
  // Email a sign-in code to the registered address (same endpoint as the app).
  // true = a code is on its way (429 = one was sent a moment ago, still valid).
  const sendLoginCode = async () => {
    setErr('');
    try {
      const res = await fetch('/api/auth/code/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 429) return true;
      if (!res.ok || !j.ok) { setErr(t.errSendOtp); return false; }
      return true;
    } catch { setErr(t.errSendOtp); return false; }
  };
  const doLogin = async () => {
    if (String(loginCode).length !== 6) { setErr(t.errCode); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/auth/code/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email, code: loginCode }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { setErr(t.errCode); return; }
      track('user_logged_in', { method: 'email_otp' });
      setVerified(true); setEmailTaken(false); setPhase(''); setStep(4);   // logged in → confirm screen
      refreshUser?.();                                                      // update header/user app-wide
    } catch { setErr(t.errCode); } finally { setBusy(false); }
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
    if (!priceCurrency) e.currency = t.errCurrency;   // no default: the seller picks US$ or the local currency
    if (!Number.isFinite(p) || p <= 0) e.price = t.errPrice;
    else if (!priceCurrency || priceCurrency === COUNTRY.extraCurrency?.code) { /* floors need the currency; bolívars are checked by the server after conversion */ }
    else if (f.mode === 'venta') { const usd = priceCurrency === 'USD' ? p : p / APPROX_RATE; if (usd < 5000) e.price = t.errPriceFloorSale; }
    else { const local = priceCurrency === COUNTRY.currencyCode ? p : p * APPROX_RATE; if (local < COUNTRY.rentFloorLocal) e.price = t.errPriceFloorRent; }
    const a = numOf(f.area); const range = areaRange(f.ptype);   // land: any size
    if (!Number.isFinite(a) || a <= 0) e.area = t.errArea; else if (range && (a < range[0] || a > range[1])) e.area = t.errAreaRange(range[1]);
    if (String(f.contact_phone).replace(/\D/g, '').length < 6) e.contact_phone = t.errPhone;
    if (photos.length < 1) e.photos = t.errPhotos;
    return e;
  };
  // Pay for a promotion. If the user already has a saved card, charge it silently
  // (NO modal). Only open the payment modal when there's no card yet, or a 3DS/decline
  // needs finishing — this kills the ugly open/close flash for returning users.
  const payWithPlan = async (pl, propertyId) => {
    setPlan(pl);
    let hasCard = false;
    try { const pr = await fetch('/api/account/payments'); const pj = await pr.json(); hasCard = !!(pj?.card?.last4); } catch {}
    if (!hasCard) { setShowHi(true); return; }        // first-time → enter a card in the modal
    setPaying(true);
    try {
      const r = await fetch('/api/highlight/create-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, plan: pl, useSavedCard: true }) });
      const j = await r.json().catch(() => ({}));
      if (j.status === 'succeeded') { setHighlighted(true); setPaying(false); return; }
      setPaying(false); setShowHi(true);              // 3DS / declined → finish in the modal
    } catch { setPaying(false); setShowHi(true); }
  };

  const publish = async (openHighlightAfter = false) => {
    const e = validateDetails();
    if (Object.keys(e).length) { setErrs(e); setErr(''); setStep(e.ptype ? 2 : 3); return; }
    if (!confirmOk) { setErr(t.errConfirm); return; }
    setErrs({}); setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.set('mode', f.mode); fd.set('ptype', f.ptype); fd.set('neighborhood', f.neighborhood); fd.set('city', f.city);
      fd.set('price', f.price); fd.set('currency', priceCurrency); fd.set('area', f.area); fd.set('description', f.description);
      fd.set('contact_name', f.contact_name); fd.set('contact_phone', f.contact_phone); fd.set('seller_type', f.seller_type);
      photos.forEach((p) => fd.append('photos', p.file));
      if (draftId) fd.set('draft_id', draftId);   // the server removes the draft once published
      const res = await fetch('/api/publish', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
      setDraftId(null);
      writeProgress({ owner: me, dismissed: readProgress().dismissed || [] }); clearProgressPhotos();   // published: nothing in progress any more
      window.dispatchEvent(new Event('cl:listings-changed'));   // My listings refreshes its tabs
      track('listing_created', { property_id: j.id, slug: j.slug, ref: j.ref, operation: f.mode, property_type: f.ptype, city: f.city, neighborhood: f.neighborhood, price: f.price ? Number(f.price) : null, currency: priceCurrency, photos: photos.length });
      setResult({ id: j.id, ref: j.ref });
      if (openHighlightAfter) await payWithPlan(openHighlightAfter, j.id);
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

            {/* 5-step stepper */}
            <div className="flex items-center gap-1.5 mb-5 mt-1 pr-9">
              {t.steps.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-pill ${i <= step ? 'bg-ink' : 'bg-ink/15'}`} />
              ))}
            </div>

            {resumed && !result && phase !== 'otp' && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-[12px] bg-card border border-ink/15 px-3.5 py-2.5 text-[12.5px]" data-testid="sell-resumed">
                <span className="text-ink/70">{t.resumedNote}</span>
                <button type="button" onClick={startOver} className="font-semibold underline shrink-0">{t.startOver}</button>
              </div>
            )}

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
                ) : paying ? (
                  <div className="mb-5 rounded-[16px] border-[1.5px] border-ink bg-card px-4 py-3 text-[13px] font-bold text-ink flex items-center justify-center gap-2"><Spinner />{t.payingMsg}</div>
                ) : (
                  <div className="mb-5 rounded-[16px] border-[1.5px] border-ink bg-card px-4 py-4 text-left shadow-hard-sm">
                    <div className="text-[15px] font-bold tracking-head mb-1">{t.usTitle}</div>
                    <p className="text-[12.5px] text-ink/60 mb-3">{t.usSub}</p>
                    {/* Same size, same border; stacked full-width on phones, side by side from sm up. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button onClick={() => payWithPlan('verified', result.id)} className="min-h-[46px] px-4 flex items-center justify-center text-center leading-tight rounded-pill border-[1.5px] border-ink font-bold text-[13px] hover:bg-ink hover:text-paper transition-colors">{t.usVerify}</button>
                      <button onClick={() => payWithPlan('home', result.id)} className="min-h-[46px] px-4 flex items-center justify-center text-center leading-tight rounded-pill border-[1.5px] border-ink bg-ink text-paper font-bold text-[13px] hover:bg-ink/90">{t.usHome}</button>
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
                {!codeSent ? (
                  <>
                    <h2 className="text-[22px] font-bold tracking-head mb-1" data-testid="sell-verify-title">{emailTaken ? t.haveAccount : t.verifyTitle}</h2>
                    <p className="text-[14px] text-ink/55 mb-4">{emailTaken ? t.existsSub(f.email) : t.verifySub(f.email)}</p>
                    <button type="button" onClick={googleSignIn} className="w-full flex items-center justify-center gap-2.5 py-3 border-[1.5px] border-ink/25 rounded-pill font-semibold text-[14px] bg-card hover:border-ink transition-colors">
                      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.1C12.2 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.4z"/><path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.5 10.6l7.9-6.3z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.3-5.7c-2 1.4-4.6 2.3-8 2.3-6.4 0-11.8-3.7-13.6-9.1l-7.9 6.3C6.4 42.6 14.6 48 24 48z"/></svg>
                      {t.googleBtn}
                    </button>
                    <div className="flex items-center gap-3 my-4">
                      <span className="flex-1 h-px bg-ink/12" /><span className="text-[12px] text-ink/40 font-mono">{t.orText}</span><span className="flex-1 h-px bg-ink/12" />
                    </div>
                    <button onClick={emailTaken ? sendExistingCode : sendOtp} disabled={busy} className="w-full px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60 inline-flex items-center justify-center min-h-[48px]" data-testid="sell-send-code">{busy ? <Spinner /> : t.sendCode}</button>
                    {err && <div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3.5 py-2.5">{err}</div>}
                  </>
                ) : emailTaken ? (
                  <>
                    <h2 className="text-[22px] font-bold tracking-head mb-1">{t.haveAccount}</h2>
                    <p className="text-[14px] text-ink/55 mb-4">{t.haveAccountSub(f.email)}</p>
                    <input value={loginCode} onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t.codePh} inputMode="numeric" autoComplete="one-time-code" className={`${inputCls} text-center tracking-[0.3em] text-[18px] font-semibold`} onKeyDown={(e) => { if (e.key === 'Enter') doLogin(); }} data-testid="sell-login-code" autoFocus />
                    <button onClick={doLogin} disabled={busy} className="w-full mt-4 px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60 inline-flex items-center justify-center min-h-[48px]">{busy ? <Spinner /> : t.login}</button>
                    <button type="button" onClick={sendLoginCode} disabled={busy} className="w-full mt-2 text-[13px] font-medium text-ink/55 hover:text-ink">{t.resend}</button>
                    {err && <div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3.5 py-2.5">{err}</div>}
                  </>
                ) : (
                  <>
                    <h2 className="text-[22px] font-bold tracking-head mb-2">{t.otpTitle}</h2>
                    <p className="text-[14px] text-ink/55 mb-4">{t.otpSub(f.email)}</p>
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.codePh} inputMode="numeric" autoComplete="one-time-code" className={`${inputCls} text-center tracking-[0.3em] text-[18px] font-semibold`} onKeyDown={(e) => { if (e.key === 'Enter') verifyOtp(); }} data-testid="sell-otp-code" autoFocus />
                    <button onClick={verifyOtp} disabled={busy} className="w-full mt-4 px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60">{busy ? t.verifying : t.verify}</button>
                    <button onClick={sendOtp} disabled={busy} className="w-full mt-2 text-[13px] font-medium text-ink/55 hover:text-ink">{t.resend}</button>
                  </>
                )}
                <button type="button" onClick={back} className="mt-5 text-[13px] font-medium text-ink/55 hover:text-ink" data-testid="sell-otp-back">{t.back}</button>
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
                    {f.seller_type && !user && (
                      <div className="mt-5">
                        <label className={labelCls}>{t.name}</label>
                        <input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder={t.namePh} className={`${inputCls} mb-3`} autoComplete="name" />
                        <label className={labelCls}>{t.email}</label>
                        <input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder={t.emailPh} className={inputCls} autoComplete="email" inputMode="email" type="email" />
                      </div>
                    )}
                    {/* Terms of Service opt-in — required to continue (consent before we store anything). */}
                    {f.seller_type && (
                      <label className="mt-4 flex items-start gap-2.5 text-[13px] leading-snug text-ink/75 cursor-pointer select-none">
                        <input type="checkbox" checked={termsOk} onChange={(e) => { setTermsOk(e.target.checked); if (e.target.checked && err === t.errTerms) setErr(''); }} className="mt-[2px] w-4 h-4 accent-ink shrink-0 cursor-pointer" data-testid="sell-terms" />
                        <span>{t.termsPre}<a href="/terminos" target="_blank" rel="noopener" className="underline font-semibold text-ink">{t.termsLink}</a>{t.termsMid}<a href="/privacidad" target="_blank" rel="noopener" className="underline font-semibold text-ink">{t.privacyLink}</a></span>
                      </label>
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
                    <div className="mt-4"><span className={labelCls}>{t.fType}</span>
                      <TypePicker value={f.ptype} options={t.types} placeholder={t.typePh} invalid={!!errs.ptype}
                        onChange={(v) => { set('ptype', v); setErrs((er) => (er.ptype ? { ...er, ptype: undefined } : er)); if (err === t.errType) setErr(''); }} />
                      <FErr k="ptype" />
                    </div>
                  </div>
                )}

                {/* ---- STEP 3 · Details ---- */}
                {step === 3 && (
                  <div>
                    <h2 className="text-[22px] font-bold tracking-head mb-1">{t.d4Title}</h2>
                    <p className="text-[13px] text-ink/50 mb-4">{t.d4Sub}</p>
                    <div className="grid grid-cols-1 gap-3">
                      {/* price (long) + area (small) on one row — price is fluid so it
                          gets the width; area + currency stay compact. Fits down to ~360px. */}
                      <div className="flex gap-3">
                        <label className="flex-1 min-w-0"><span className={labelCls}>{t.fPrice(f.mode)}</span>
                          <div className="flex gap-2">
                            <input value={f.price} onChange={setField('price')} inputMode="numeric" placeholder={t.fPricePh(f.mode)} className={`${fieldCls('price')} flex-1 min-w-0`} />
                            <select value={priceCurrency} onChange={setField('currency')} data-testid="sell-currency"
                              className={`px-2.5 py-[13px] border-[1.5px] rounded-input bg-card font-medium text-[15px] outline-none cursor-pointer w-[96px] sm:w-[104px] shrink-0 ${errs.currency ? 'border-red-500 focus:border-red-600' : 'border-ink/30 focus:border-ink'} ${priceCurrency ? '' : 'text-ink/45'}`}>
                              <option value="" disabled>{t.currencyPh}</option>
                              <option value="USD" className="text-ink">US$</option>
                              {COUNTRY.currencyCode !== 'USD' && <option value={COUNTRY.currencyCode} className="text-ink">{COUNTRY.currencySymbol}</option>}
                              {COUNTRY.extraCurrency && <option value={COUNTRY.extraCurrency.code} className="text-ink">{COUNTRY.extraCurrency.symbol}</option>}
                            </select>
                          </div>
                          <FErr k="price" />
                          <FErr k="currency" />
                          {COUNTRY.extraCurrency && priceCurrency === COUNTRY.extraCurrency.code && <span className="block mt-1 text-[12px] text-ink/55">{t.extraNote}</span>}
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
                  </div>
                )}

                {/* ---- STEP 4 · Confirm + visibility + publish ---- */}
                {step === 4 && (
                  <div>
                    <h2 className="text-[22px] font-bold tracking-head mb-1">{t.cTitle}</h2>
                    <p className="text-[13px] text-ink/50 mb-4">{t.cSub}</p>
                    <div className="rounded-[16px] border-[1.5px] border-ink/15 bg-card p-4" data-testid="sell-summary">
                      {photos.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-3">
                          {photos.slice(0, 5).map((p, i) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img key={i} src={p.url} alt="" className="w-12 h-12 rounded-[8px] object-cover border border-ink/10 shrink-0" />
                          ))}
                          <span className="ml-1 font-mono text-[11px] text-ink/50">{t.cPhotos(photos.length)}</span>
                        </div>
                      )}
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                        {[
                          [t.cOp, `${f.mode === 'venta' ? t.sell : t.rent} · ${(t.types.find(([v]) => v === f.ptype) || [])[1] || ''}`],
                          [t.cAddr, [f.addressText || f.neighborhood, f.city].filter(Boolean).join(' · ')],
                          [t.fPrice(f.mode), `${curSymbol(priceCurrency)} ${f.price}${f.area ? ` · ${f.area} m²` : ''}`],
                          [t.cPhone, f.contact_phone],
                          [t.cContact, [f.seller_type === 'agent' ? t.agent : t.owner, f.contact_name, f.email].filter(Boolean).join(' · ')],
                          ...(f.description.trim() ? [[t.fDesc, f.description.trim().length > 110 ? `${f.description.trim().slice(0, 110)}…` : f.description.trim()]] : []),
                        ].map(([k, v]) => (
                          <Fragment key={k}><dt className="text-ink/50 whitespace-nowrap">{k}</dt><dd className="font-semibold text-ink break-words min-w-0">{v}</dd></Fragment>
                        ))}
                      </dl>
                    </div>
                    <label className="mt-4 flex items-start gap-2.5 text-[14px] font-semibold leading-snug cursor-pointer select-none">
                      <input type="checkbox" checked={confirmOk} onChange={(e) => { setConfirmOk(e.target.checked); if (e.target.checked && err === t.errConfirm) setErr(''); }} className="mt-[2px] w-4 h-4 accent-ink shrink-0 cursor-pointer" data-testid="sell-confirm" />
                      <span>{t.cCheck}</span>
                    </label>

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
                    {step < 4 ? (
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
