'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import ProfilePhotoCard from '@/components/account/ProfilePhotoCard';
import { ERRORS as PRO_ERRORS, normalizeWebsite, websiteLabel } from '@/lib/sellerProfile';

const T = {
  es: {
    title: 'Ajustes', profile: 'Perfil', name: 'Nombre completo', phone: 'WhatsApp / teléfono', save: 'Guardar', saved: 'Guardado ✓', saving: 'Guardando…',
    pro: 'Perfil profesional', proIntro: 'Los compradores ven estos datos junto a tu foto en cada una de tus publicaciones. Un perfil completo genera más confianza y más consultas.',
    firstName: 'Nombre', lastName: 'Apellido', jobTitle: 'Cargo', jobTitlePh: 'Ej.: Agente inmobiliario', company: 'Empresa / inmobiliaria', companyPh: 'Ej.: Inmobiliaria Asunción', website: 'Sitio web de la empresa', websitePh: 'www.tuinmobiliaria.com.py', optional: 'opcional',
    waConfirmed: 'WhatsApp confirmado', waNone: 'Todavía no confirmaste tu WhatsApp. Confirmalo para que los compradores te escriban con confianza.',
    proSaved: 'Perfil guardado ✓ Ya se muestra en tus publicaciones.', proPending: 'Guardamos tu nombre. El cargo, la empresa y el sitio web se van a poder guardar muy pronto (pendiente de migración).', proFix: 'Revisá los campos marcados.',
    preview: 'Así te ven los compradores', listedBy: 'Publicado por',
    emailSec: 'Cambiar email', currentEmail: 'Email actual', newEmail: 'Nuevo email', sendCode: 'Enviar código', code: 'Código', verify: 'Verificar y cambiar', codeSent: 'Enviamos un código al nuevo email.', emailChanged: 'Email actualizado ✓',
    signSec: 'Cómo ingresás', signText: 'Ingresás con un código que te enviamos por email o por WhatsApp, o con Google / Apple. No necesitás contraseña.',
    emailRow: 'Email', waRow: 'WhatsApp', confirmed: 'Confirmado', notConfirmed: 'Sin confirmar', resend: 'Reenviar confirmación', resent: 'Te enviamos el enlace. Revisá tu email.',
    confirmedNow: '¡Listo! Tu email quedó confirmado.', confirmBad: 'El enlace no es válido o venció. Pedí uno nuevo.',
    addWa: 'Agregar WhatsApp', waHint: 'Así entrás también con tu número, en la misma cuenta.', waPh: '+595 981 123 456', waSend: 'Enviar código', waCode: 'Código de WhatsApp', waVerify: 'Verificar', waAdded: 'WhatsApp agregado ✓',
    waTaken: 'Ese número ya está verificado en otra cuenta. Entrá con ese número o escribinos.', waBad: 'Número inválido.', waCodeBad: 'Código incorrecto o vencido.', waLocked: 'Es tu WhatsApp verificado: para cambiarlo usá "Cambiar WhatsApp" en Cómo ingresás.',
    changeWa: 'Cambiar WhatsApp', changeHint: 'Te enviamos un código al número nuevo. Cuando lo verifiques, reemplaza al anterior.', waChanged: 'WhatsApp cambiado ✓', cancel: 'Cancelar',
    err: 'Algo salió mal. Intentá de nuevo.', errEmail: 'Ingresá un email válido', errTaken: 'Ese email ya está en uso.', errCode: 'Código incorrecto o vencido.',
    delSec: 'Eliminar cuenta', delText: 'Elimina tu cuenta y tus datos personales. No se puede deshacer.', delBtn: 'Eliminar mi cuenta',
  },
  en: {
    title: 'Settings', profile: 'Profile', name: 'Full name', phone: 'WhatsApp / phone', save: 'Save', saved: 'Saved ✓', saving: 'Saving…',
    pro: 'Professional profile', proIntro: 'Buyers see this next to your photo on every one of your listings. A complete profile builds trust and brings more enquiries.',
    firstName: 'First name', lastName: 'Last name', jobTitle: 'Title', jobTitlePh: 'E.g. Real estate agent', company: 'Company / agency', companyPh: 'E.g. Asunción Realty', website: 'Company website', websitePh: 'www.youragency.com', optional: 'optional',
    waConfirmed: 'Confirmed WhatsApp', waNone: "You haven't confirmed your WhatsApp yet. Confirm it so buyers can message you with confidence.",
    proSaved: 'Profile saved ✓ It now shows on your listings.', proPending: 'We saved your name. Title, company and website can be saved very soon (migration pending).', proFix: 'Check the highlighted fields.',
    preview: 'How buyers see you', listedBy: 'Listed by',
    emailSec: 'Change email', currentEmail: 'Current email', newEmail: 'New email', sendCode: 'Send code', code: 'Code', verify: 'Verify & change', codeSent: 'We sent a code to the new email.', emailChanged: 'Email updated ✓',
    signSec: 'How you sign in', signText: 'You sign in with a code we send by email or WhatsApp, or with Google / Apple. No password needed.',
    emailRow: 'Email', waRow: 'WhatsApp', confirmed: 'Confirmed', notConfirmed: 'Not confirmed', resend: 'Resend confirmation', resent: 'We sent the link. Check your email.',
    confirmedNow: 'Done! Your email is confirmed.', confirmBad: 'The link is invalid or expired. Ask for a new one.',
    addWa: 'Add WhatsApp', waHint: 'Then you can also sign in with your number, in this same account.', waPh: '+595 981 123 456', waSend: 'Send code', waCode: 'WhatsApp code', waVerify: 'Verify', waAdded: 'WhatsApp added ✓',
    waTaken: 'That number is already verified on another account. Sign in with that number or contact us.', waBad: 'Invalid number.', waCodeBad: 'Wrong or expired code.', waLocked: 'This is your verified WhatsApp: to change it use "Change WhatsApp" under How you sign in.',
    changeWa: 'Change WhatsApp', changeHint: 'We send a code to the new number. Once verified, it replaces the old one.', waChanged: 'WhatsApp changed ✓', cancel: 'Cancel',
    err: 'Something went wrong. Try again.', errEmail: 'Enter a valid email', errTaken: 'That email is already in use.', errCode: 'Wrong or expired code.',
    delSec: 'Delete account', delText: 'Deletes your account and your personal data. This cannot be undone.', delBtn: 'Delete my account',
  },
  pt: {
    title: 'Configurações', profile: 'Perfil', name: 'Nome completo', phone: 'WhatsApp / telefone', save: 'Salvar', saved: 'Salvo ✓', saving: 'Salvando…',
    emailSec: 'Alterar e‑mail', currentEmail: 'E‑mail atual', newEmail: 'Novo e‑mail', sendCode: 'Enviar código', code: 'Código', verify: 'Verificar e mudar', codeSent: 'Enviamos um código para o novo e‑mail.', emailChanged: 'E‑mail atualizado ✓',
    signSec: 'Como você entra', signText: 'Você entra com um código que enviamos por e‑mail ou WhatsApp, ou com Google / Apple. Não precisa de senha.',
    emailRow: 'E‑mail', waRow: 'WhatsApp', confirmed: 'Confirmado', notConfirmed: 'Não confirmado', resend: 'Reenviar confirmação', resent: 'Enviamos o link. Verifique seu e‑mail.',
    confirmedNow: 'Pronto! Seu e‑mail foi confirmado.', confirmBad: 'O link é inválido ou expirou. Solicite um novo.',
    addWa: 'Adicionar WhatsApp', waHint: 'Assim você também pode entrar com seu número, nesta mesma conta.', waPh: '+595 981 123 456', waSend: 'Enviar código', waCode: 'Código do WhatsApp', waVerify: 'Verificar', waAdded: 'WhatsApp adicionado ✓',
    waTaken: 'Esse número já está verificado em outra conta. Entre com esse número ou entre em contato.', waBad: 'Número inválido.', waCodeBad: 'Código errado ou expirado.', waLocked: 'Este é seu WhatsApp verificado: para alterá‑lo use "Alterar WhatsApp" em Como você entra.',
    changeWa: 'Alterar WhatsApp', changeHint: 'Enviamos um código para o novo número. Depois de verificado, ele substitui o anterior.', waChanged: 'WhatsApp alterado ✓', cancel: 'Cancelar',
    err: 'Algo deu errado. Tente novamente.', errEmail: 'Informe um e‑mail válido', errTaken: 'Esse e‑mail já está em uso.', errCode: 'Código errado ou expirado.',
    delSec: 'Excluir conta', delText: 'Exclui sua conta e seus dados pessoais. Não há como desfazer.', delBtn: 'Excluir minha conta',
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

function Field({ id, label, hint, error, ...input }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}{hint && <span className="font-normal text-ink/45"> ({hint})</span>}</label>
      <input id={id} {...input} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} className={`${inputCls} ${error ? '!border-red-600' : ''}`} />
      {error && <p id={`${id}-err`} className="text-[12.5px] font-medium text-red-700 mt-1">{error}</p>}
    </div>
  );
}

// A small live preview of the seller card buyers see on the listings (PropertyContactCard).
function ProPreview({ t, prof, photo }) {
  const name = [prof.first_name, prof.last_name].map((x) => (x || '').trim()).filter(Boolean).join(' ');
  const line = [prof.job_title, prof.company_name].map((x) => (x || '').trim()).filter(Boolean).join(' · ');
  const web = normalizeWebsite(prof.company_website);
  const label = web.ok && web.value ? websiteLabel(web.value) : '';
  if (!name) return null;
  return (
    <div className="rounded-[14px] border border-dashed border-ink/25 bg-paper/60 p-3.5" aria-live="polite">
      <div className="text-[11px] font-semibold uppercase tracking-label text-ink/45 mb-2">{t.preview}</div>
      <div className="flex items-start gap-3">
        {photo
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt="" width={44} height={44} className="w-11 h-11 rounded-full object-cover bg-white border-[1.5px] border-ink shrink-0" />
          : <div className="w-11 h-11 rounded-full bg-card border-[1.5px] border-ink shrink-0 flex items-center justify-center text-[17px] font-bold" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-label text-ink/45">{t.listedBy}</div>
          <div className="text-[15px] font-bold leading-tight truncate">{name}</div>
          {line && <div className="text-[12.5px] text-ink/65 leading-snug mt-0.5 break-words">{line}</div>}
          {label && <div className="text-[12.5px] font-semibold underline underline-offset-2 decoration-ink/30 mt-1 truncate">{label}</div>}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [lang] = useLang();
  const t = T[lang];

  const [prof, setProf] = useState({ full_name: '', phone: '', email: '', has_password: true, auth_provider: 'email', phone_verified: false, email_confirmed: true, first_name: '', last_name: '', job_title: '', company_name: '', company_website: '', profile_ready: true });
  const [proErr, setProErr] = useState({});   // field → error code (lib/sellerProfile.js ERRORS)
  // ?email=confirmed|invalid from the confirm-email link (lib/emailConfirm.js)
  const [notice, setNotice] = useState(null);
  const [cBusy, setCBusy] = useState(false); const [cMsg, setCMsg] = useState(null);
  // where: which card opened the WhatsApp form ('pro' = Perfil profesional, 'sign' = Cómo ingresás)
  const [wa, setWa] = useState({ open: false, where: null, phone: '', code: '', stage: 'phone', busy: false, msg: null, dev: '' });
  useEffect(() => {
    try {
      const st = new URLSearchParams(window.location.search).get('email');
      if (st) { setNotice(st); const u = new URL(window.location.href); u.searchParams.delete('email'); window.history.replaceState(null, '', u.toString()); }
    } catch {}
  }, []);
  const [pBusy, setPBusy] = useState(false); const [pMsg, setPMsg] = useState(null);
  const [newEmail, setNewEmail] = useState(''); const [emCode, setEmCode] = useState(''); const [emStage, setEmStage] = useState('idle'); const [emBusy, setEmBusy] = useState(false); const [emMsg, setEmMsg] = useState(null);

  useEffect(() => { fetch('/api/account/profile').then((r) => r.json()).then((j) => { if (!j.error) setProf((p) => ({ ...p, ...j })); }).catch(() => {}); }, []);
  // the approved photo / logo, for the seller-card preview
  const [photo, setPhoto] = useState(null);
  useEffect(() => { fetch('/api/account/profile-photo').then((r) => r.json()).then((j) => { if (j && !j.error) setPhoto(j.photo || null); }).catch(() => {}); }, []);
  const post = (url, body, method = 'POST') => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const proErrors = PRO_ERRORS[lang] || PRO_ERRORS.es;
  const setField = (k) => (e) => { const v = e.target.value; setProf((p) => ({ ...p, [k]: v })); if (proErr[k]) setProErr((x) => { const n = { ...x }; delete n[k]; return n; }); };

  // "Perfil profesional" → PATCH /api/account/profile (validated again on the server).
  const saveProfile = async (e) => {
    e.preventDefault(); setPMsg(null);
    const errs = {};
    if (!prof.first_name.trim()) errs.first_name = 'first_required';
    const web = normalizeWebsite(prof.company_website);
    if (!web.ok) errs.company_website = web.error;
    if (Object.keys(errs).length) { setProErr(errs); setPMsg({ text: t.proFix }); return; }
    setPBusy(true);
    try {
      const body = { first_name: prof.first_name, last_name: prof.last_name, job_title: prof.job_title, company_name: prof.company_name, company_website: prof.company_website };
      const r = await post('/api/account/profile', body, 'PATCH');
      const j = await r.json().catch(() => ({}));
      if (r.status === 400 && j.fields) { setProErr(j.fields); setPMsg({ text: t.proFix }); return; }
      if (!r.ok) { setPMsg({ text: t.err }); return; }
      setProErr({});
      if (j.profile) setProf((p) => ({ ...p, ...j.profile, ...(j.pending_migration ? { job_title: p.job_title, company_name: p.company_name, company_website: p.company_website } : {}) }));
      setPMsg(j.pending_migration ? { text: t.proPending, ok: true } : { text: t.proSaved, ok: true });
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
        const changed = prof.phone_verified;
        setProf((p) => ({ ...p, phone: j.phone || p.phone, phone_verified: true }));
        setWa((w) => ({ open: false, where: w.where, phone: '', code: '', stage: 'phone', busy: false, msg: { text: changed && !j.already ? t.waChanged : t.waAdded, ok: true }, dev: '' }));
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

  // The verified WhatsApp row + the existing add / change flow (/api/account/whatsapp), shown
  // in "Perfil profesional" and in "Cómo ingresás"; the form opens in the card it was asked from.
  const waBlock = (where) => (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{where === 'pro' ? t.waConfirmed : t.waRow}</div>
          <div className="font-mono text-[12.5px] text-ink/55">{prof.phone_verified ? prof.phone : '—'}</div>
        </div>
        {prof.phone_verified ? (
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[12px] font-bold text-green-800 bg-green-50 border border-green-200 rounded-pill px-3 py-1">✓ {t.confirmed}</span>
            {!wa.open && <button type="button" onClick={() => setWa((w) => ({ ...w, open: true, where, phone: '', code: '', stage: 'phone', msg: null }))} className="text-[12.5px] font-semibold underline">{t.changeWa}</button>}
          </div>
        ) : !wa.open && <button type="button" onClick={() => setWa((w) => ({ ...w, open: true, where, phone: prof.phone || '', msg: null }))} className="shrink-0 px-4 py-2 rounded-pill border-[1.5px] border-ink text-[13px] font-bold hover:bg-ink hover:text-paper">{t.addWa}</button>}
      </div>
      {where === 'pro' && !prof.phone_verified && !(wa.open && wa.where === where) && <p className="text-[12.5px] text-ink/55 mt-1.5">{t.waNone}</p>}
      {wa.open && wa.where === where && (
        <form onSubmit={waStep} className="flex flex-col gap-3 mt-3" data-testid={prof.phone_verified ? 'change-whatsapp' : 'add-whatsapp'}>
          <p className="text-[12.5px] text-ink/55">{prof.phone_verified ? t.changeHint : t.waHint}</p>
          <input value={wa.phone} onChange={(e) => setWa((w) => ({ ...w, phone: e.target.value }))} placeholder={t.waPh} inputMode="tel" className={inputCls} disabled={wa.stage === 'code'} />
          {wa.stage === 'code' && (
            <div>
              <label className={labelCls}>{t.waCode}</label>
              <input value={wa.code} onChange={(e) => setWa((w) => ({ ...w, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" placeholder="000000" className={`${inputCls} tracking-[6px] font-mono text-center`} />
              {wa.dev && <p className="text-[11px] text-ink/40 mt-1 font-mono">test: {wa.dev}</p>}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={wa.busy} className={btn}>{wa.stage === 'code' ? t.waVerify : t.waSend}</button>
            <button type="button" onClick={() => setWa({ open: false, where: null, phone: '', code: '', stage: 'phone', busy: false, msg: null, dev: '' })} className="text-[13px] font-semibold text-ink/60">{t.cancel}</button>
          </div>
        </form>
      )}
      {wa.where === where && <Msg {...(wa.msg || {})} text={wa.msg?.text} />}
    </div>
  );

  return (
    <div className="max-w-[560px]">
      <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-display leading-tight mb-6">{t.title}</h1>

      {/* The seller's photo or company logo on their listings (AI-checked): first thing in Settings */}
      <ProfilePhotoCard />

      <Card title={t.pro}>
        <p className="text-[14px] text-ink/70 -mt-1 mb-4">{t.proIntro}</p>
        <form onSubmit={saveProfile} noValidate className="flex flex-col gap-3.5" data-testid="pro-profile">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field id="pf-first" label={t.firstName} value={prof.first_name} onChange={setField('first_name')} error={proErr.first_name && proErrors[proErr.first_name]} autoComplete="given-name" maxLength={60} />
            <Field id="pf-last" label={t.lastName} value={prof.last_name} onChange={setField('last_name')} error={proErr.last_name && proErrors[proErr.last_name]} autoComplete="family-name" maxLength={60} />
            <Field id="pf-title" label={t.jobTitle} hint={t.optional} placeholder={t.jobTitlePh} value={prof.job_title} onChange={setField('job_title')} error={proErr.job_title && proErrors[proErr.job_title]} autoComplete="organization-title" maxLength={80} />
            <Field id="pf-company" label={t.company} hint={t.optional} placeholder={t.companyPh} value={prof.company_name} onChange={setField('company_name')} error={proErr.company_name && proErrors[proErr.company_name]} autoComplete="organization" maxLength={100} />
          </div>
          <Field id="pf-web" label={t.website} hint={t.optional} placeholder={t.websitePh} value={prof.company_website} onChange={setField('company_website')} error={proErr.company_website && proErrors[proErr.company_website]} type="url" inputMode="url" autoComplete="url" maxLength={200} />

          <div className="border-t border-ink/10 -mb-1">{waBlock('pro')}</div>

          <ProPreview t={t} prof={prof} photo={photo} />

          <div><button type="submit" disabled={pBusy} className={btn} data-testid="pro-save">{pBusy ? t.saving : t.save}</button></div>
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
          {waBlock('sign')}
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
