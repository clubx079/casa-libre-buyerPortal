'use client';
// Asks a signed-in NEW account "¿Sos vendedor o comprador?" when the log-in modal could
// not (Google sign-up = a full-page redirect). Mounted once by AuthProvider.
//   · a pick made on the log-in screen before the redirect (localStorage, UserTypePick
//     savePick) is sent silently — also fills an empty type of an older account;
//   · otherwise, when /api/auth/me says ask_user_type (no type, account < 3 days old,
//     lib/userType.js shouldAskUserType), a small dialog with the two pills;
//   · "Ahora no" / × → not again in this browser session.
import { useEffect, useState } from 'react';
import UserTypePick, { TYPE_DICT, readPick, savePick, postUserType, LATER_KEY } from './UserTypePick';
import { useLang } from '@/lib/useLang';
import { track } from '@/lib/analytics';

export default function UserTypePrompt({ user, blocked = false, onSaved }) {
  const [lang] = useLang();
  const t = TYPE_DICT[lang] || TYPE_DICT.es;
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || blocked || user.user_type) { setShow(false); return; }
    const pick = readPick();
    if (pick) {
      savePick(null);
      postUserType(pick, 'login_choice').then((ok) => {
        if (ok) { track('user_type_chosen', { type: pick, where: 'login_screen' }); onSaved?.(pick); }
      });
      return;
    }
    if (!user.ask_user_type) return;
    let later = false;
    try { later = sessionStorage.getItem(LATER_KEY) === '1'; } catch {}
    if (!later) setShow(true);
  }, [user?.id, user?.user_type, user?.ask_user_type, blocked]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;
  const dismiss = () => { try { sessionStorage.setItem(LATER_KEY, '1'); } catch {} setShow(false); };
  const choose = async (v) => {
    setBusy(true);
    const ok = await postUserType(v, 'signup_choice');
    setBusy(false);
    setShow(false);
    if (ok) { track('user_type_chosen', { type: v, where: 'after_signup' }); onSaved?.(v); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true" data-testid="user-type-prompt">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative w-full max-w-[420px] bg-paper border-[1.5px] border-ink rounded-[24px] shadow-hard p-7 md:p-8">
        <button onClick={dismiss} aria-label="×" className="absolute top-4 right-4 w-8 h-8 rounded-pill border border-ink/25 flex items-center justify-center text-ink/60 hover:border-ink hover:text-ink">×</button>
        <UserTypePick value={null} onPick={choose} disabled={busy} />
        <p className="text-[13px] text-ink/55 mt-3">{busy ? t.saving : t.sub}</p>
        <button type="button" onClick={dismiss} className="mt-4 text-[13px] font-medium text-ink/55 hover:text-ink">{t.later}</button>
      </div>
    </div>
  );
}
