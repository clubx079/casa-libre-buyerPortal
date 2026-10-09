'use client';
// Sign in / sign up with an emailed 6-digit code — no passwords (same as the mobile
// app). /api/auth/code/send emails the code and says whether it will sign in an
// existing account ('login') or create one ('signup'); /api/auth/code/verify checks
// it and starts the session. New people also give their name (+ optional phone) and
// accept the Terms. Google sign-in stays.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { track } from '@/lib/analytics';
import { COUNTRY } from '@/lib/country';

const DICT = {
  es: {
    emailTitle: 'Ingresá o creá tu cuenta', emailSub: 'Te enviamos un código a tu email. Sin contraseñas.',
    email: 'Email', emailPh: 'tu@email.com', continue: 'Enviar código', googleBtn: 'Continuar con Google', orText: 'o',
    loginTitle: 'Ingresá el código', signupTitle: 'Creá tu cuenta',
    codeSub: (e) => `Enviamos un código de 6 dígitos a ${e}.`,
    name: 'Nombre completo', namePh: 'Ana Giménez', phone: 'WhatsApp / teléfono (opcional)', phonePh: '0981 123 456',
    code: 'Código', login: 'Ingresar', create: 'Crear cuenta', resend: 'Reenviar código', resent: 'Código reenviado ✓',
    changeEmail: '← Cambiar email', close: 'Cerrar',
    errEmail: 'Ingresá un email válido', errName: 'Ingresá tu nombre',
    googleTerms: 'Al continuar con Google aceptás los ', termsPre: 'Acepto los ', termsLink: 'Términos y Condiciones', termsMid: ' y la ', privacyLink: 'Política de Privacidad', errTerms: 'Para continuar, aceptá los Términos y Condiciones.',
    errCode: 'Código incorrecto o vencido', errSend: 'No se pudo enviar el código. Intentá de nuevo.',
    errRate: 'Demasiados intentos. Esperá un momento e intentá de nuevo.',
    errBlocked: 'Esta cuenta no está disponible. Escribinos desde la página de contacto.',
    errGeneric: 'Algo salió mal. Intentá de nuevo.',
    sending: 'Enviando…', verifying: 'Verificando…',
  },
  en: {
    emailTitle: 'Log in or sign up', emailSub: "We'll email you a code. No passwords.",
    email: 'Email', emailPh: 'you@email.com', continue: 'Send code', googleBtn: 'Continue with Google', orText: 'or',
    loginTitle: 'Enter the code', signupTitle: 'Create your account',
    codeSub: (e) => `We sent a 6-digit code to ${e}.`,
    name: 'Full name', namePh: 'Ana Giménez', phone: 'WhatsApp / phone (optional)', phonePh: '0981 123 456',
    code: 'Code', login: 'Log in', create: 'Create account', resend: 'Resend code', resent: 'Code resent ✓',
    changeEmail: '← Change email', close: 'Close',
    errEmail: 'Enter a valid email', errName: 'Enter your name',
    googleTerms: 'By continuing with Google you agree to the ', termsPre: 'I agree to the ', termsLink: 'Terms of Service', termsMid: ' and the ', privacyLink: 'Privacy Policy', errTerms: 'To continue, please accept the Terms of Service.',
    errCode: 'Wrong or expired code', errSend: 'Could not send the code. Try again.',
    errRate: 'Too many attempts. Please wait a moment and try again.',
    errBlocked: 'This account is unavailable. Write to us from the contact page.',
    errGeneric: 'Something went wrong. Try again.',
    sending: 'Sending…', verifying: 'Verifying…',
  },
};

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const inputCls = 'w-full px-4 py-[13px] border-[1.5px] border-ink/30 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink';
const btnCls = 'w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] shadow-hard-soft disabled:opacity-60';

// next = where "Continue with Google" comes back to (lib/returnPath.js); default /cuenta.
export default function AuthModal({ onAuthed, onClose, next = null }) {
  const [lang] = useLang();
  const t = DICT[lang];
  const [step, setStep] = useState('email'); // email | code
  const [mode, setMode] = useState('login'); // what the code will do: login | signup
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsOk, setTermsOk] = useState(false);   // Terms of Service opt-in (sign-up)
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [resent, setResent] = useState(false);
  const firstField = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { firstField.current?.focus(); }, [step, mode]);

  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const googleSignIn = async () => {
    setErr('');
    track('oauth_login_clicked', { provider: 'google' });
    try {
      const r = next ? await post('/api/auth/google', { next }) : await fetch('/api/auth/google', { method: 'POST' });
      const j = await r.json();
      if (j.url) window.location.href = j.url;
      else setErr(t.errGeneric);
    } catch { setErr(t.errGeneric); }
  };

  const googleBtn = (
    <>
      <button type="button" onClick={googleSignIn} className="w-full flex items-center justify-center gap-2.5 py-3 border-[1.5px] border-ink/25 rounded-pill font-semibold text-[14px] bg-card hover:border-ink transition-colors">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.1C12.2 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.4z"/><path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.5 10.6l7.9-6.3z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.3-5.7c-2 1.4-4.6 2.3-8 2.3-6.4 0-11.8-3.7-13.6-9.1l-7.9 6.3C6.4 42.6 14.6 48 24 48z"/></svg>
        {t.googleBtn}
      </button>
      <p className="mt-2 text-center text-[11.5px] leading-snug text-ink/50">{t.googleTerms}<a href="/terminos" target="_blank" rel="noopener" className="underline">{t.termsLink}</a>{t.termsMid}<a href="/privacidad" target="_blank" rel="noopener" className="underline">{t.privacyLink}</a>.</p>
      <div className="flex items-center gap-3 my-4">
        <span className="flex-1 h-px bg-ink/12" /><span className="text-[12px] text-ink/40 font-mono">{t.orText}</span><span className="flex-1 h-px bg-ink/12" />
      </div>
    </>
  );

  // Email the code. The reply says whether it signs in or creates the account.
  const sendCode = async () => {
    const r = await post('/api/auth/code/send', { email: email.trim() });
    const j = await r.json().catch(() => ({}));
    if (r.status === 429 || j.error === 'rate_limited' || j.error === 'cooldown') return { error: t.errRate };
    if (!r.ok || !j.ok) return { error: t.errSend };
    return { mode: j.mode === 'signup' ? 'signup' : 'login' };
  };

  const submitEmail = async (e) => {
    e.preventDefault(); setErr('');
    if (!emailOk(email)) { setErr(t.errEmail); return; }
    setBusy(true);
    try {
      const res = await sendCode();
      if (res.error) { setErr(res.error); return; }
      setMode(res.mode); setCode(''); setStep('code');
      track(res.mode === 'signup' ? 'sign_up_code_sent' : 'login_code_sent', {});
    } catch { setErr(t.errSend); } finally { setBusy(false); }
  };

  const submitCode = async (e) => {
    e.preventDefault(); setErr('');
    if (mode === 'signup') {
      if (!fullName.trim()) { setErr(t.errName); return; }
      if (!termsOk) { setErr(t.errTerms); return; }
    }
    setBusy(true);
    try {
      const r = await post('/api/auth/code/verify', {
        email: email.trim(), code,
        ...(mode === 'signup' ? { fullName: fullName.trim(), phone: phone.trim() || undefined } : {}),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403) { setErr(t.errBlocked); return; }
      if (!r.ok || !j.ok) { setErr(j.error === 'too_many_attempts' ? t.errRate : t.errCode); return; }
      if (j.mode === 'signup') track('user_signed_up', { method: 'email_otp' });   // value agreed with the ads agency
      else track('user_logged_in', { method: 'email_otp' });
      onAuthed(j.user);
    } catch { setErr(t.errGeneric); } finally { setBusy(false); }
  };

  const resend = async () => {
    setErr(''); setResent(false);
    try {
      const res = await sendCode();
      if (res.error) { setErr(res.error); return; }
      setResent(true); setTimeout(() => setResent(false), 3000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[420px] max-h-[92vh] overflow-y-auto bg-paper border-[1.5px] border-ink rounded-[24px] shadow-hard p-7 md:p-8">
        <button onClick={onClose} aria-label={t.close} className="absolute top-4 right-4 w-8 h-8 rounded-pill border border-ink/25 flex items-center justify-center text-ink/60 hover:border-ink hover:text-ink">×</button>
        <div className="text-[22px] font-bold tracking-head mb-5">casa-libre<em className="font-serif italic font-normal">{COUNTRY.tld}</em></div>

        {step === 'email' && (
          <form onSubmit={submitEmail}>
            <h2 className="text-[24px] font-bold tracking-head leading-tight">{t.emailTitle}</h2>
            <p className="text-[14px] text-ink/55 mt-1 mb-5">{t.emailSub}</p>
            {googleBtn}
            <label className="block text-[13px] font-semibold mb-1.5">{t.email}</label>
            <input ref={firstField} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} className={inputCls} autoComplete="email" />
            <button type="submit" disabled={busy} className={`${btnCls} mt-5`}>{busy ? t.sending : t.continue}</button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={submitCode}>
            <h2 className="text-[24px] font-bold tracking-head leading-tight">{mode === 'signup' ? t.signupTitle : t.loginTitle}</h2>
            <p className="text-[14px] text-ink/55 mt-1 mb-5">{t.codeSub(email.trim())}</p>
            {mode === 'signup' && (
              <div className="flex flex-col gap-3 mb-3">
                <div>
                  <label className="block text-[13px] font-semibold mb-1.5">{t.name}</label>
                  <input ref={firstField} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.namePh} className={inputCls} autoComplete="name" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold mb-1.5">{t.phone}</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePh} className={inputCls} autoComplete="tel" />
                </div>
              </div>
            )}
            <label className="block text-[13px] font-semibold mb-1.5">{t.code}</label>
            <input ref={mode === 'signup' ? undefined : firstField} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className={`${inputCls} tracking-[8px] text-center font-mono text-[20px]`} data-testid="auth-code" />
            {mode === 'signup' && (
              <label className="mt-4 flex items-start gap-2.5 text-[13px] leading-snug text-ink/75 cursor-pointer select-none">
                <input type="checkbox" checked={termsOk} onChange={(e) => { setTermsOk(e.target.checked); if (e.target.checked && err === t.errTerms) setErr(''); }} className="mt-[2px] w-4 h-4 accent-ink shrink-0 cursor-pointer" data-testid="signup-terms" />
                <span>{t.termsPre}<a href="/terminos" target="_blank" rel="noopener" className="underline font-semibold text-ink">{t.termsLink}</a>{t.termsMid}<a href="/privacidad" target="_blank" rel="noopener" className="underline font-semibold text-ink">{t.privacyLink}</a></span>
              </label>
            )}
            <button type="submit" disabled={busy || code.length !== 6} className={`${btnCls} mt-5`}>{busy ? t.verifying : (mode === 'signup' ? t.create : t.login)}</button>
            <div className="flex items-center justify-between mt-4">
              <button type="button" onClick={() => { setStep('email'); setErr(''); setCode(''); }} className="text-[13px] font-medium text-ink/55 hover:text-ink">{t.changeEmail}</button>
              <button type="button" onClick={resend} className="text-[13px] font-medium text-ink/55 hover:text-ink">{resent ? t.resent : t.resend}</button>
            </div>
          </form>
        )}

        {err && <div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3.5 py-2.5">{err}</div>}
      </div>
    </div>
  );
}
