'use client';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useLang } from '@/lib/useLang';

const T = {
  es: { login: 'Ingresar', logout: 'Salir', account: 'Mi cuenta' },
  en: { login: 'Log in', logout: 'Log out', account: 'My account' },
};

export default function AuthButton({ variant = 'light' }) {
  const { user, loading, openAuth, logout } = useAuth();
  const [lang] = useLang();
  const [menu, setMenu] = useState(false);
  const t = T[lang];

  if (loading) return <span className="w-[72px] h-[38px] rounded-pill bg-ink/5 animate-pulse" />;

  if (!user) {
    return (
      <button onClick={() => openAuth()} className={`px-[18px] py-2.5 rounded-pill text-[14px] font-medium border ${variant === 'dark' ? 'border-paper text-paper' : 'border-ink text-ink'}`}>
        {t.login}
      </button>
    );
  }

  const initials = (user.full_name || user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="relative">
      <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-pill border border-ink/25 hover:border-ink">
        <span className="w-7 h-7 rounded-pill bg-ink text-paper flex items-center justify-center text-[13px] font-bold">{initials}</span>
        <span className="text-[13px] font-semibold max-w-[120px] truncate">{user.full_name || user.email}</span>
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setMenu(false)} />
          <div className="absolute right-0 mt-2 w-[180px] bg-card border border-ink/15 rounded-[14px] shadow-hard-sm p-1.5 z-[50]">
            <div className="px-3 py-2 text-[12px] text-ink/55 font-mono truncate">{user.email}</div>
            <button onClick={() => { setMenu(false); logout(); }} className="w-full text-left px-3 py-2 rounded-[10px] text-[14px] font-medium hover:bg-ink/5">{t.logout}</button>
          </div>
        </>
      )}
    </div>
  );
}
