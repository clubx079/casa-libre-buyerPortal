'use client';
// /eliminar-cuenta — how to delete a Casa Libre account, and the delete button for
// a signed-in visitor (POST /api/account/delete). Google Play asks for this page's
// URL; the mobile app has the same action under Account. What is removed / kept is
// decided in lib/accountDeletion.js — keep the copy below in step with it.
import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import { DELETE_WORD, deleteWordOk } from '@/lib/deleteConfirm';

const T = {
  es: {
    title: 'Eliminar tu cuenta',
    intro: 'Podés eliminar tu cuenta de Casa Libre en cualquier momento, desde la app o desde esta página.',
    howTitle: 'Cómo hacerlo',
    howApp: 'En la app: Cuenta → Eliminar cuenta.',
    howWeb: 'En la web: iniciá sesión y usá el botón de abajo.',
    whatTitle: 'Qué pasa con tus datos',
    deleted: 'Se eliminan de inmediato: tu nombre, email, teléfono, contraseña, inicio de sesión con Google, tarjeta guardada, propiedades guardadas, borradores y las notificaciones de tus dispositivos.',
    listings: 'Tus publicaciones: les quitamos tu nombre y tu teléfono y se desvinculan de tu cuenta, por lo que dejan de mostrarse en Casa Libre.',
    kept: 'Conservamos solo el registro de los pagos que hayas hecho (importe y fecha), porque la ley nos obliga a guardarlo para la contabilidad.',
    final: 'No se puede deshacer. Si querés volver, podés crear una cuenta nueva con el mismo email.',
    signedAs: 'Sesión iniciada como',
    danger: 'Zona de peligro',
    typeLabel: `Para confirmar, escribí ${DELETE_WORD.es}`,
    button: 'Eliminar mi cuenta',
    working: 'Eliminando…',
    signIn: 'Iniciar sesión para eliminar mi cuenta',
    done: 'Tu cuenta fue eliminada.',
    doneSub: 'Gracias por haber usado Casa Libre.',
    home: 'Ir al inicio',
    err: 'No pudimos eliminar tu cuenta. Intentá de nuevo en unos minutos.',
    help: '¿Problemas? Escribinos desde la',
    contact: 'página de contacto',
  },
  en: {
    title: 'Delete your account',
    intro: 'You can delete your Casa Libre account at any time, from the app or from this page.',
    howTitle: 'How',
    howApp: 'In the app: Account → Delete account.',
    howWeb: 'On the web: sign in and use the button below.',
    whatTitle: 'What happens to your data',
    deleted: 'Deleted straight away: your name, email, phone, password, Google sign-in, saved card, saved properties, drafts and your devices’ notifications.',
    listings: 'Your listings: we remove your name and phone and unlink them from your account, so they stop showing on Casa Libre.',
    kept: 'We keep only the record of payments you made (amount and date), because the law requires it for accounting.',
    final: 'This cannot be undone. If you come back, you can create a new account with the same email.',
    signedAs: 'Signed in as',
    danger: 'Danger zone',
    typeLabel: `To confirm, type ${DELETE_WORD.en}`,
    button: 'Delete my account',
    working: 'Deleting…',
    signIn: 'Sign in to delete my account',
    done: 'Your account has been deleted.',
    doneSub: 'Thank you for using Casa Libre.',
    home: 'Go to the home page',
    err: 'We couldn’t delete your account. Please try again in a few minutes.',
    help: 'Trouble? Write to us from the',
    contact: 'contact page',
  },
};

export default function DeleteAccountPanel() {
  const [lang] = useLang();
  const t = T[lang] || T.es;
  const { user, loading, openAuth, logout } = useAuth() || {};
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function onDelete() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
      if (!r.ok) throw new Error(String(r.status));
      setDone(true);
      try { await logout?.(); } catch {}
    } catch {
      setErr(t.err);
    }
    setBusy(false);
  }

  return (
    <div className="px-5 md:px-11 py-10 max-w-[680px] mx-auto">
      <h1 className="text-[34px] md:text-[42px] font-bold tracking-head leading-tight text-balance">{t.title}</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink/75">{t.intro}</p>

      <section className="mt-8">
        <h2 className="text-[19px] font-bold tracking-head mb-2">{t.howTitle}</h2>
        <ul className="list-disc pl-5 text-[15px] leading-relaxed text-ink/80 space-y-1">
          <li>{t.howApp}</li>
          <li>{t.howWeb}</li>
        </ul>
      </section>

      <section className="mt-7">
        <h2 className="text-[19px] font-bold tracking-head mb-2">{t.whatTitle}</h2>
        <div className="text-[15px] leading-relaxed text-ink/80 space-y-3">
          <p>{t.deleted}</p>
          <p>{t.listings}</p>
          <p>{t.kept}</p>
          <p className="font-semibold text-ink">{t.final}</p>
        </div>
      </section>

      <section className={`mt-8 bg-card border rounded-card p-6 ${user && !done ? 'border-red-700/40' : 'border-ink/15'}`}>
        {user && !done && !loading ? <p className="font-mono text-[11.5px] tracking-[0.12em] uppercase text-red-700 mb-3">{t.danger}</p> : null}
        {done ? (
          <div>
            <p className="text-[18px] font-bold">{t.done}</p>
            <p className="mt-1 text-[14px] text-ink/70">{t.doneSub}</p>
            <Link href="/" className="inline-block mt-5 px-6 py-3 rounded-pill bg-ink text-paper font-bold text-[14px]">{t.home}</Link>
          </div>
        ) : loading ? (
          <div className="h-[52px]" aria-busy="true" />
        ) : !user ? (
          <button type="button" onClick={() => openAuth?.()} className="px-6 py-3 rounded-pill bg-ink text-paper font-bold text-[14px] shadow-hard-soft">
            {t.signIn}
          </button>
        ) : (
          <div>
            <p className="text-[14px] text-ink/70">{t.signedAs} <span className="font-semibold text-ink">{user.email}</span></p>
            <label htmlFor="delete-confirm" className="mt-4 block text-[14px] font-semibold">{t.typeLabel}</label>
            <input
              id="delete-confirm"
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={DELETE_WORD[lang] || DELETE_WORD.es}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="mt-2 w-full max-w-[320px] px-4 py-3 border-[1.5px] border-ink/30 rounded-input bg-paper font-medium text-[15px] outline-none focus:border-red-700"
            />
            <button
              type="button"
              disabled={!deleteWordOk(word) || busy}
              onClick={onDelete}
              className="mt-5 px-6 py-3 rounded-pill bg-red-700 text-white font-bold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              {busy ? t.working : t.button}
            </button>
            {err ? <div className="mt-4 text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5">{err}</div> : null}
          </div>
        )}
      </section>

      <p className="mt-6 text-[13px] text-ink/60">
        {t.help} <Link href="/contacto" className="font-semibold underline decoration-ink/30 hover:decoration-ink">{t.contact}</Link>.
      </p>
    </div>
  );
}
