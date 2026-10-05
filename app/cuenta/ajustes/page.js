'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';

const T = {
  es: {
    title: 'Ajustes', profile: 'Perfil', name: 'Nombre completo', phone: 'WhatsApp / teléfono', save: 'Guardar', saved: 'Guardado ✓', saving: 'Guardando…',
    emailSec: 'Cambiar email', currentEmail: 'Email actual', newEmail: 'Nuevo email', sendCode: 'Enviar código', code: 'Código', verify: 'Verificar y cambiar', codeSent: 'Enviamos un código al nuevo email.', emailChanged: 'Email actualizado ✓',
    signSec: 'Cómo ingresás', signText: 'Ingresás con un código que te enviamos por email, o con Google. No necesitás contraseña.',
    err: 'Algo salió mal. Intentá de nuevo.', errEmail: 'Ingresá un email válido', errTaken: 'Ese email ya está en uso.', errCode: 'Código incorrecto o vencido.',
    delSec: 'Eliminar cuenta', delText: 'Elimina tu cuenta y tus datos personales. No se puede deshacer.', delBtn: 'Eliminar mi cuenta',
  },
  en: {
    title: 'Settings', profile: 'Profile', name: 'Full name', phone: 'WhatsApp / phone', save: 'Save', saved: 'Saved ✓', saving: 'Saving…',
    emailSec: 'Change email', currentEmail: 'Current email', newEmail: 'New email', sendCode: 'Send code', code: 'Code', verify: 'Verify & change', codeSent: 'We sent a code to the new email.', emailChanged: 'Email updated ✓',
    signSec: 'How you sign in', signText: 'You sign in with a code we email you, or with Google. No password needed.',
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

  const [prof, setProf] = useState({ full_name: '', phone: '', email: '', has_password: true, auth_provider: 'email' });
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
          <div><label className={labelCls}>{t.phone}</label><input value={prof.phone} onChange={(e) => setProf({ ...prof, phone: e.target.value })} className={inputCls} /></div>
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
        <p className="text-[14px] text-ink/70">{t.signText}</p>
      </Card>

      <Card title={t.delSec}>
        <p className="text-[14px] text-ink/70 mb-4">{t.delText}</p>
        <Link href="/eliminar-cuenta" className="inline-block px-6 py-3 rounded-pill border-[1.5px] border-red-700 text-red-700 font-bold text-[14px] hover:bg-red-50">{t.delBtn}</Link>
      </Card>
    </div>
  );
}
