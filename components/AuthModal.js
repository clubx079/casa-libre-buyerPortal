'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/useLang';

const DICT = {
  es: {
    emailTitle: 'Ingresá o creá tu cuenta', emailSub: 'Publicá y gestioná tus propiedades con Casa Libre.',
    email: 'Email', emailPh: 'tu@email.com', continue: 'Continuar', googleBtn: 'Continuar con Google', orText: 'o',
    loginTitle: 'Bienvenido de nuevo', password: 'Contraseña', passwordPh: '••••••••', login: 'Ingresar',
    signupTitle: 'Creá tu cuenta', signupSub: 'Un paso más para empezar a publicar.',
    name: 'Nombre completo', namePh: 'Ana Giménez', phone: 'WhatsApp / teléfono', phonePh: '0981 123 456',
    newPassword: 'Contraseña', newPasswordPh: 'mínimo 6 caracteres', sendCode: 'Enviar código',
    otpTitle: 'Verificá tu email', otpSub: (e) => `Enviamos un código de 6 dígitos a ${e}.`,
    code: 'Código', verify: 'Verificar y crear cuenta', resend: 'Reenviar código', resent: 'Código reenviado ✓',
    changeEmail: '← Cambiar email', back: '← Atrás', close: 'Cerrar',
    errEmail: 'Ingresá un email válido', errPw: 'La contraseña debe tener al menos 6 caracteres',
    errCreds: 'Email o contraseña incorrectos', errCode: 'Código incorrecto o vencido',
    errTaken: 'Ese email ya tiene una cuenta. Ingresá con tu contraseña.',
    errSend: 'No se pudo enviar el código. Intentá de nuevo.', errGeneric: 'Algo salió mal. Intentá de nuevo.',
    sending: 'Enviando…', verifying: 'Verificando…', checking: 'Verificando…',
  },
  en: {
    emailTitle: 'Log in or sign up', emailSub: 'Post and manage your properties with Casa Libre.',
    email: 'Email', emailPh: 'you@email.com', continue: 'Continue', googleBtn: 'Continue with Google', orText: 'or',
    loginTitle: 'Welcome back', password: 'Password', passwordPh: '••••••••', login: 'Log in',
    signupTitle: 'Create your account', signupSub: 'One more step to start posting.',
    name: 'Full name', namePh: 'Ana Giménez', phone: 'WhatsApp / phone', phonePh: '0981 123 456',
    newPassword: 'Password', newPasswordPh: 'at least 6 characters', sendCode: 'Send code',
    otpTitle: 'Verify your email', otpSub: (e) => `We sent a 6-digit code to ${e}.`,
    code: 'Code', verify: 'Verify & create account', resend: 'Resend code', resent: 'Code resent ✓',
    changeEmail: '← Change email', back: '← Back', close: 'Close',
    errEmail: 'Enter a valid email', errPw: 'Password must be at least 6 characters',
    errCreds: 'Wrong email or password', errCode: 'Wrong or expired code',
    errTaken: 'That email already has an account. Log in with your password.',
    errSend: 'Could not send the code. Try again.', errGeneric: 'Something went wrong. Try again.',
    sending: 'Sending…', verifying: 'Verifying…', checking: 'Checking…',
  },
};

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
const inputCls = 'w-full px-4 py-[13px] border-[1.5px] border-ink/30 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink';
const btnCls = 'w-full py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] shadow-hard-soft disabled:opacity-60';

export default function AuthModal({ onAuthed, onClose }) {
  const [lang] = useLang();
  const t = DICT[lang];
  const [step, setStep] = useState('email'); // email | login-password | signup | otp
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
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
  useEffect(() => { firstField.current?.focus(); }, [step]);

  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const googleSignIn = async () => {
    setErr('');
    try {
      const r = await fetch('/api/auth/google', { method: 'POST' });
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
      <div className="flex items-center gap-3 my-4">
        <span className="flex-1 h-px bg-ink/12" /><span className="text-[12px] text-ink/40 font-mono">{t.orText}</span><span className="flex-1 h-px bg-ink/12" />
      </div>
    </>
  );

  const submitEmail = async (e) => {
    e.preventDefault(); setErr('');
    if (!emailOk(email)) { setErr(t.errEmail); return; }
    setBusy(true);
    try {
      const r = await post('/api/auth/check-email', { email });
      const j = await r.json();
      setStep(j.exists ? 'login-password' : 'signup');
    } catch { setErr(t.errGeneric); } finally { setBusy(false); }
  };

  const submitLogin = async (e) => {
    e.preventDefault(); setErr('');
    setBusy(true);
    try {
      const r = await post('/api/auth/login', { email, password });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErr(t.errCreds); return; }
      onAuthed(j.user);
    } catch { setErr(t.errGeneric); } finally { setBusy(false); }
  };

  const submitSignup = async (e) => {
    e.preventDefault(); setErr('');
    if (!password || password.length < 6) { setErr(t.errPw); return; }
    setBusy(true);
    try {
      const r = await post('/api/auth/send-otp', { email, fullName, phone });
      const j = await r.json();
      if (r.status === 409) { setErr(t.errTaken); setStep('login-password'); return; }
      if (!r.ok || !j.ok) { setErr(t.errSend); return; }
      setStep('otp');
    } catch { setErr(t.errSend); } finally { setBusy(false); }
  };

  const submitOtp = async (e) => {
    e.preventDefault(); setErr('');
    setBusy(true);
    try {
      const r = await post('/api/auth/verify-otp', { email, code, password, fullName, phone });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErr(t.errCode); return; }
      onAuthed(j.user);
    } catch { setErr(t.errGeneric); } finally { setBusy(false); }
  };

  const resend = async () => {
    setErr(''); setResent(false);
    try {
      const r = await post('/api/auth/send-otp', { email, fullName, phone });
      if (r.ok) { setResent(true); setTimeout(() => setResent(false), 3000); }
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-paper border-[1.5px] border-ink rounded-[24px] shadow-hard p-7 md:p-8">
        <button onClick={onClose} aria-label={t.close} className="absolute top-4 right-4 w-8 h-8 rounded-pill border border-ink/25 flex items-center justify-center text-ink/60 hover:border-ink hover:text-ink">×</button>
        <div className="text-[22px] font-bold tracking-head mb-5">casa-libre<em className="font-serif not-italic italic font-normal">.py</em></div>

        {step === 'email' && (
          <form onSubmit={submitEmail}>
            <h2 className="text-[24px] font-bold tracking-head leading-tight">{t.emailTitle}</h2>
            <p className="text-[14px] text-ink/55 mt-1 mb-5">{t.emailSub}</p>
            {googleBtn}
            <label className="block text-[13px] font-semibold mb-1.5">{t.email}</label>
            <input ref={firstField} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} className={inputCls} autoComplete="email" />
            <button type="submit" disabled={busy} className={`${btnCls} mt-5`}>{busy ? t.checking : t.continue}</button>
          </form>
        )}

        {step === 'login-password' && (
          <form onSubmit={submitLogin}>
            <h2 className="text-[24px] font-bold tracking-head leading-tight">{t.loginTitle}</h2>
            <p className="text-[14px] text-ink/55 mt-1 mb-5">{email}</p>
            <label className="block text-[13px] font-semibold mb-1.5">{t.password}</label>
            <input ref={firstField} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPh} className={inputCls} autoComplete="current-password" />
            <button type="submit" disabled={busy} className={`${btnCls} mt-5`}>{busy ? t.verifying : t.login}</button>
            <button type="button" onClick={() => { setStep('email'); setErr(''); }} className="block mx-auto mt-4 text-[13px] font-medium text-ink/55 hover:text-ink">{t.changeEmail}</button>
          </form>
        )}

        {step === 'signup' && (
          <form onSubmit={submitSignup}>
            <h2 className="text-[24px] font-bold tracking-head leading-tight">{t.signupTitle}</h2>
            <p className="text-[14px] text-ink/55 mt-1 mb-5">{t.signupSub}</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">{t.name}</label>
                <input ref={firstField} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.namePh} className={inputCls} autoComplete="name" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">{t.phone}</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePh} className={inputCls} autoComplete="tel" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">{t.newPassword}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.newPasswordPh} className={inputCls} autoComplete="new-password" />
              </div>
            </div>
            <button type="submit" disabled={busy} className={`${btnCls} mt-5`}>{busy ? t.sending : t.sendCode}</button>
            <button type="button" onClick={() => { setStep('email'); setErr(''); }} className="block mx-auto mt-4 text-[13px] font-medium text-ink/55 hover:text-ink">{t.changeEmail}</button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={submitOtp}>
            <h2 className="text-[24px] font-bold tracking-head leading-tight">{t.otpTitle}</h2>
            <p className="text-[14px] text-ink/55 mt-1 mb-5">{t.otpSub(email)}</p>
            <label className="block text-[13px] font-semibold mb-1.5">{t.code}</label>
            <input ref={firstField} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" className={`${inputCls} tracking-[8px] text-center font-mono text-[20px]`} />
            <button type="submit" disabled={busy || code.length !== 6} className={`${btnCls} mt-5`}>{busy ? t.verifying : t.verify}</button>
            <div className="flex items-center justify-between mt-4">
              <button type="button" onClick={() => { setStep('signup'); setErr(''); }} className="text-[13px] font-medium text-ink/55 hover:text-ink">{t.back}</button>
              <button type="button" onClick={resend} className="text-[13px] font-medium text-ink/55 hover:text-ink">{resent ? t.resent : t.resend}</button>
            </div>
          </form>
        )}

        {err && <div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-3.5 py-2.5">{err}</div>}
      </div>
    </div>
  );
}
