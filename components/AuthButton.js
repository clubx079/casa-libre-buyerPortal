'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { useLang } from '@/lib/useLang';
import ConfirmModal from './ConfirmModal';

const T = {
  es: { login: 'Ingresar', logout: 'Salir', account: 'Mi panel', saved: 'Guardadas', mine: 'Mis publicaciones', settings: 'Ajustes', logoutT: 'Cerrar sesión', logoutMsg: '¿Querés cerrar tu sesión?', cancel: 'Cancelar' },
  en: { login: 'Log in', logout: 'Log out', account: 'Dashboard', saved: 'Saved', mine: 'My listings', settings: 'Settings', logoutT: 'Log out', logoutMsg: 'Are you sure you want to log out?', cancel: 'Cancel' },
};

export default function AuthButton({ variant = 'light' }) {
  const { user, loading, openAuth, logout } = useAuth();
  const [lang] = useLang();
  const [menu, setMenu] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const t = T[lang];

  if (loading) return <span className="w-[80px] h-[40px] rounded-pill bg-ink/5 animate-pulse" />;

  if (!user) {
    return (
      <button onClick={() => openAuth()} className={`inline-flex items-center h-[40px] px-[18px] rounded-pill text-[14px] font-medium border ${variant === 'dark' ? 'border-paper text-paper' : 'border-ink text-ink'}`}>
        {t.login}
      </button>
    );
  }

  const initials = (user.full_name || user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="relative">
      <button onClick={() => setMenu((m) => !m)} className="flex items-center h-[40px] gap-2 pl-1 pr-1 sm:pr-3 rounded-pill border border-ink/25 hover:border-ink">
        <span className="w-7 h-7 rounded-pill bg-ink text-paper flex items-center justify-center text-[13px] font-bold">{initials}</span>
        <span className="hidden sm:inline text-[13px] font-semibold max-w-[120px] truncate">{user.full_name || user.email}</span>
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-[1190]" onClick={() => setMenu(false)} />
          <div className="absolute right-0 mt-2 w-[200px] bg-card border border-ink/15 rounded-[14px] shadow-hard-sm p-1.5 z-[1200]">
            <div className="px-3 py-2 text-[12px] text-ink/55 font-mono truncate border-b border-ink/10 mb-1">{user.email}</div>
            {[[t.account, '/cuenta'], [t.saved, '/cuenta/guardadas'], [t.mine, '/cuenta/publicaciones'], [t.settings, '/cuenta/ajustes']].map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setMenu(false)} className="block px-3 py-2 rounded-[10px] text-[14px] font-medium hover:bg-ink/5">{label}</Link>
            ))}
            <button onClick={() => { setMenu(false); setShowLogout(true); }} className="w-full text-left px-3 py-2 rounded-[10px] text-[14px] font-medium text-ink/70 hover:bg-ink/5 border-t border-ink/10 mt-1">{t.logout}</button>
          </div>
        </>
      )}
      <ConfirmModal
        open={showLogout}
        title={t.logoutT}
        message={t.logoutMsg}
        confirmLabel={t.logout}
        cancelLabel={t.cancel}
        onConfirm={() => { setShowLogout(false); logout(); }}
        onCancel={() => setShowLogout(false)}
      />
    </div>
  );
}
