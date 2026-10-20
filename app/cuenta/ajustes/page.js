'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';

const T = {
  es: {
    title: 'Ajustes', profile: 'Perfil', name: 'Nombre completo', phone: 'WhatsApp / teléfono', save: 'Guardar', saved: 'Guardado ✓', saving: 'Guardando…',
    emailSec: 'Cambiar email', currentEmail: 'Email actual', newEmail: 'Nuevo email', sendCode: 'Enviar código', code: 'Código', verify: 'Verificar y cambiar', codeSent: 'Enviamos un código al nuevo email.', emailChanged: 'Email actualizado ✓',
    signSec: 'Cómo ingresás', signText: 'Ingresás con un código que te enviamos por email o por WhatsApp, o con Google / Apple. No necesitás contraseña.',
    emailRow: 'Email', waRow: 'WhatsApp', confirmed: 'Confirmado', notConfirmed: 'Sin confirmar', resend: 'Reenviar confirmación', resent: 'Te enviamos el enlace. Revisá tu email.',
    confirmedNow: '¡Listo! Tu email quedó confirmado.', confirmBad: 'El enlace no es válido o venció. Pedí uno nuevo.',
    addWa: 'Agregar WhatsApp', waHint: 'Así entrás también con tu número, en la misma cuenta.', waPh: '+595 981 123 456', waSend: 'Enviar código', waCode: 'Código de WhatsApp', waVerify: 'Verificar', waAdded: 'WhatsApp agregado ✓',
    waTaken: 'Ese número ya está verificado en otra cuenta. Entrá con ese número o escribinos.', waBad: 'Número inválido.', waCodeBad: 'Código incorrecto o vencido.', waLocked: 'Tu WhatsApp verificado es tu forma de entrar: no se cambia acá.',
    err: 'Algo salió mal. Intentá de nuevo.', errEmail: 'Ingresá un email válido', errTaken: 'Ese email ya está en uso.', errCode: 'Código incorrecto o vencido.',
    delSec: 'Eliminar cuenta', delText: 'Elimina tu cuenta y tus datos personales. No se puede deshacer.', delBtn: 'Eliminar mi cuenta',
  },
  en: {
    title: 'Settings', profile: 'Profile', name: 'Full name', phone: 'WhatsApp / phone', save: 'Save', saved: 'Saved ✓', saving: 'Saving…',
    emailSec: 'Change email', currentEmail: 'Current email', newEmail: 'New email', sendCode: 'Send code', code: 'Code', verify: 'Verify & change', codeSent: 'We sent a code to the new email.', emailChanged: 'Email updated ✓',
    signSec: 'How you sign in', signText: 'You sign in with a code we send by email or WhatsApp, or with Google / Apple. No password needed.',
    emailRow: 'Email', waRow: 'WhatsApp', confirmed: 'Confirmed', notConfirmed: 'Not confirmed', resend: 'Resend confirmation', resent: 'We sent the link. Check your email.',
    confirmedNow: 'Done! Your email is confirmed.', confirmBad: 'The link is invalid or expired. Ask for a new one.',
    addWa: 'Add WhatsApp', waHint: 'Then you can also sign in with your number, in this same account.', waPh: '+595 981 123 456', waSend: 'Send code', waCode: 'WhatsApp code', waVerify: 'Verify', waAdded: 'WhatsApp added ✓',
    waTaken: 'That number is already verified on another account. Sign in with that number or contact us.', waBad: 'Invalid number.', waCodeBad: 'Wrong or expired code.', waLocked: 'Your verified WhatsApp is how you sign in: it is not changed here.',
    err: 'Something went wrong. Try again.', errEmail: 'Enter a valid email', errTaken: 'That email is already in use.', errCode: 'Wrong or expired code.',
    delSec: 'Delete account', delText: 'Deletes your account and your personal data. This cannot be undone.', delBtn: 'Delete my account',
  },
};

const inputCls = 'w-full px-4 py-[12px] border-[1.5px] border-ink/30 rounded-input bg-card font-medium text-[15px] outline-none focus:border-ink';
const labelCls = 'block text-[13px] font-semibold mb-1.5';
const btn = 'px-6 py-3 rounded-pill bg-ink text-paper font-bold text-[14px] shadow-hard-soft disabled:opacity-60';

function Card({ title, children }) {
  return (
    <section className="bg-card border border-ink/15 rounded-card p-6 mb-5">
      <h2 className="text-[17px] font-bold tracking-head mb-4">{title}</h2>
      {children}
    </section>
  );
}
function Msg({ text, ok }) {
  if (!text) return null;
  return <div className={`mt-3 text-[13px] font-medium rounded-[10px] px-3.5 py-2.5 ${ok ? 'text-green-800 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{text}</div>;
}

export default function SettingsPage() {
  const [lang] = useLang();
  const t = T[lang];

  const [prof, setProf] = useState({ full_name: '', phone: '', email: '', has_password: true, auth_provider: 'email', phone_verified: false, email_confirmed: true });
  // ?email=confirmed|invalid from the confirm-email link (lib/emailConfirm.js)
  const [notice, setNotice] = useState(null);
  const [cBusy, setCBusy] = useState(false); const [cMsg, setCMsg] = useState(null);
  const [wa, setWa] = useState({ open: false, phone: '', code: '', stage: 'phone', busy: false, msg: null, dev: '' });
  useEffect(() => {
    try {
      const st = new URLSearchParams(window.location.search).get('email');
      if (st) { setNotice(st); const u = new URL(window.location.href); u.searchParams.delete('email'); window.history.replaceState(null, '', u.toString()); }
    } catch {}
  }, []);
  const [pBusy, setPBusy] = useState(false); const [pMsg, setPMsg] = useState(null);
  const [newEmail, setNewEmail] = useState(''); const [emCode, setEmCode] = useState(''); const [emStage, setEmStage] = useState('idle'); const [emBusy, setEmBusy] = useState(false); const [emMsg, setEmMsg] = useState(null);

  useEffect(() => { fetch('/api/account/profile').then((r) => r.json()).then((j) => { if (!j.error) setProf(j); }).catch(() => {}); }, []);
  const post = (url, body, method = 'POST') => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const saveProfile = async (e) => {
    e.preventDefault(); setPBusy(true); setPMsg(null);
    try {
      const r = await post('/api/account/profile', { full_name: prof.full_name, phone: prof.phone }, 'PATCH');
      setPMsg(r.ok ? { text: t.saved, ok: true } : { text: t.err });
    } catch { setPMsg({ text: t.err }); } finally { setPBusy(false); }
  };

  const resendConfirm = async () => {
    setCBusy(true); setCMsg(null);
    try { const r = await post('/api/account/confirm-email', {}); setCMsg(r.ok ? { text: t.resent, ok: true } : { text: t.err }); }
    catch { setCMsg({ text: t.err }); } finally { setCBusy(false); }
  };

  const waStep = async (e) => {
    e.preventDefault();
    setWa((w) => ({ ...w, busy: true, msg: null }));
    try {
      const r = await post('/api/account/whatsapp', wa.stage === 'code' ? { phone: wa.phone, code: wa.code } : { phone: wa.phone });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { setWa((w) => ({ ...w, busy: false, msg: { text: t.waTaken } })); return; }
      if (!r.ok) { setWa((w) => ({ ...w, busy: false, msg: { text: j.error === 'invalid_phone' ? t.waBad : wa.stage === 'code' ? t.waCodeBad : t.err } })); return; }
      if (wa.stage === 'code' || j.already) {
        setProf((p) => ({ ...p, phone: j.phone || p.phone, phone_verified: true }));
        setWa({ open: false, phone: '', code: '', stage: 'phone', busy: false, msg: { text: t.waAdded, ok: true }, dev: '' });
        return;
      }
      setWa((w) => ({ ...w, busy: false, stage: 'code', phone: j.phone || w.phone, dev: j.devCode || '' }));
    } catch { setWa((w) => ({ ...w, busy: false, msg: { text: t.err } })); }
  };

  const emailStep = async (e) => {
    e.preventDefault(); setEmBusy(true); setEmMsg(null);
    try {
      if (emStage !== 'code') {
        const r = await post('/api/account/change-email', { newEmail });
        const j = await r.json();
        if (r.status === 409) { setEmMsg({ text: t.errTaken }); return; }
        if (!r.ok) { setEmMsg({ text: t.err }); return; }
        setEmStage('code'); setEmMsg({ text: t.codeSent, ok: true });
      } else {
        const r = await post('/api/account/change-email', { newEmail, code: emCode });
        const j = await r.json();
        if (!r.ok || !j.ok) { setEmMsg({ text: t.errCode }); return; }
        setProf((p) => ({ ...p, email: newEmail })); setEmStage('idle'); setNewEmail(''); setEmCode(''); setEmMsg({ text: t.emailChanged, ok: true });
      }
    } catch { setEmMsg({ text: t.err }); } finally { setEmBusy(false); }
  };

  return (
    <div className="max-w-[560px]">
      <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-display leading-tight mb-6">{t.title}</h1>

      <Card title={t.profile}>
        <form onSubmit={saveProfile} className="flex flex-col gap-3.5">
          <div><label className={labelCls}>{t.name}</label><input value={prof.full_name} onChange={(e) => setProf({ ...prof, full_name: e.target.value })} className={inputCls} /></div>
          <div>
            <label className={labelCls}>{t.phone}</label>
            <input value={prof.phone} onChange={(e) => setProf({ ...prof, phone: e.target.value })} className={`${inputCls} ${prof.phone_verified ? 'opacity-60' : ''}`} readOnly={prof.phone_verified} />
            {prof.phone_verified && <p className="text-[12px] text-ink/50 mt-1">{t.waLocked}</p>}
          </div>
          <div><button type="submit" disabled={pBusy} className={btn}>{pBusy ? t.saving : t.save}</button></div>
          <Msg {...(pMsg || {})} text={pMsg?.text} />
        </form>
      </Card>

      <Card title={t.emailSec}>
        <form onSubmit={emailStep} className="flex flex-col gap-3.5">
          <div><label className={labelCls}>{t.currentEmail}</label><div className="font-mono text-[13px] text-ink/55 px-1">{prof.email}</div></div>
          <div><label className={labelCls}>{t.newEmail}</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} disabled={emStage === 'code'} /></div>
          {emStage === 'code' && <div><label className={labelCls}>{t.code}</label><input value={emCode} onChange={(e) => setEmCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" className={`${inputCls} tracking-[6px] font-mono text-center`} /></div>}
          <div><button type="submit" disabled={emBusy} className={btn}>{emStage === 'code' ? t.verify : t.sendCode}</button></div>
          <Msg {...(emMsg || {})} text={emMsg?.text} />
        </form>
      </Card>

      <Card title={t.signSec}>
        <p className="text-[14px] text-ink/70 mb-4">{t.signText}</p>
        {notice && <Msg text={notice === 'confirmed' ? t.confirmedNow : t.confirmBad} ok={notice === 'confirmed'} />}
        <div className="flex flex-col divide-y divide-ink/10 mt-2" data-testid="sign-in-methods">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{t.emailRow}</div>
              <div className="font-mono text-[12.5px] text-ink/55 truncate">{prof.email}</div>
            </div>
            {prof.email_confirmed
              ? <span className="shrink-0 text-[12px] font-bold text-green-800 bg-green-50 border border-green-200 rounded-pill px-3 py-1">✓ {t.confirmed}</span>
              : <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[12px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-pill px-3 py-1">{t.notConfirmed}</span>
                  <button type="button" onClick={resendConfirm} disabled={cBusy} className="text-[12.5px] font-semibold underline disabled:opacity-50">{t.resend}</button>
                </div>}
          </div>
          <div className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">{t.waRow}</div>
                <div className="font-mono text-[12.5px] text-ink/55">{prof.phone_verified ? prof.phone : '—'}</div>
              </div>
              {prof.phone_verified
                ? <span className="shrink-0 text-[12px] font-bold text-green-800 bg-green-50 border border-green-200 rounded-pill px-3 py-1">✓ {t.confirmed}</span>
                : !wa.open && <button type="button" onClick={() => setWa((w) => ({ ...w, open: true, phone: prof.phone || '', msg: null }))} className="shrink-0 px-4 py-2 rounded-pill border-[1.5px] border-ink text-[13px] font-bold hover:bg-ink hover:text-paper">{t.addWa}</button>}
            </div>
            {!prof.phone_verified && wa.open && (
              <form onSubmit={waStep} className="flex flex-col gap-3 mt-3" data-testid="add-whatsapp">
                <p className="text-[12.5px] text-ink/55">{t.waHint}</p>
                <input value={wa.phone} onChange={(e) => setWa((w) => ({ ...w, phone: e.target.value }))} placeholder={t.waPh} inputMode="tel" className={inputCls} disabled={wa.stage === 'code'} />
                {wa.stage === 'code' && (
                  <div>
                    <label className={labelCls}>{t.waCode}</label>
                    <input value={wa.code} onChange={(e) => setWa((w) => ({ ...w, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" placeholder="000000" className={`${inputCls} tracking-[6px] font-mono text-center`} />
                    {wa.dev && <p className="text-[11px] text-ink/40 mt-1 font-mono">test: {wa.dev}</p>}
                  </div>
                )}
                <div><button type="submit" disabled={wa.busy} className={btn}>{wa.stage === 'code' ? t.waVerify : t.waSend}</button></div>
              </form>
            )}
            <Msg {...(wa.msg || {})} text={wa.msg?.text} />
          </div>
        </div>
        <Msg {...(cMsg || {})} text={cMsg?.text} />
      </Card>

      <Card title={t.delSec}>
        <p className="text-[14px] text-ink/70 mb-4">{t.delText}</p>
        <Link href="/eliminar-cuenta" className="inline-block px-6 py-3 rounded-pill border-[1.5px] border-red-700 text-red-700 font-bold text-[14px] hover:bg-red-50">{t.delBtn}</Link>
      </Card>
    </div>
  );
}
