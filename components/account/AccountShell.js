'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/lib/useLang';
import ConfirmModal from '@/components/ConfirmModal';

const NAV = {
  es: [['/cuenta', 'Panel', 'dash'], ['/cuenta/guardadas', 'Guardadas', 'heart'], ['/cuenta/publicaciones', 'Mis publicaciones', 'home'], ['/cuenta/ajustes', 'Ajustes', 'gear']],
  en: [['/cuenta', 'Dashboard', 'dash'], ['/cuenta/guardadas', 'Saved', 'heart'], ['/cuenta/publicaciones', 'My listings', 'home'], ['/cuenta/ajustes', 'Settings', 'gear']],
};
const T = {
  es: { browse: 'Ver propiedades', publish: 'Publicar propiedad', logout: 'Cerrar sesión', logoutMsg: '¿Querés cerrar tu sesión?', cancel: 'Cancelar' },
  en: { browse: 'Browse listings', publish: 'List a property', logout: 'Log out', logoutMsg: 'Are you sure you want to log out?', cancel: 'Cancel' },
};

function Icon({ name }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'dash') return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (name === 'heart') return <svg {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.5 1.1-1a5.5 5.5 0 0 0 0-7.9z" /></svg>;
  if (name === 'home') return <svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>;
  // settings — clean sliders (the Lucide cog renders as a cluttered blob at 18px)
  return <svg {...p}><line x1="4" y1="6" x2="20" y2="6" /><circle cx="10" cy="6" r="2.3" /><line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2.3" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="18" r="2.3" /></svg>;
}

export default function AccountShell({ children }) {
  const { user, logout } = useAuth();
  const [lang, setLang] = useLang();
  const [open, setOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const path = usePathname();
  const nav = NAV[lang];
  const t = T[lang];
  const initials = (user?.full_name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-paper lg:flex">
      {open && <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-[90] lg:hidden" onClick={() => setOpen(false)} />}

      {/* LEFT SIDEBAR */}
      <aside className={`fixed lg:sticky top-0 left-0 z-[100] w-[248px] h-screen bg-card border-r border-ink/12 flex flex-col transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 h-[68px] border-b border-ink/10 shrink-0">
          <Link href="/" className="text-[20px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
          <button onClick={() => setOpen(false)} aria-label="Cerrar" className="lg:hidden w-8 h-8 rounded-pill flex items-center justify-center text-ink/60 hover:bg-ink/5">×</button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {nav.map(([href, label, ic]) => {
            const on = path === href;
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-input text-[14px] font-medium transition-colors ${on ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/5'}`}>
                <span className={on ? 'text-paper' : 'text-ink/55'}><Icon name={ic} /></span>{label}
              </Link>
            );
          })}
          <div className="my-2.5 border-t border-ink/10" />
          <Link href="/propiedades" className="px-3.5 py-2.5 rounded-input text-[14px] font-medium text-ink/70 hover:bg-ink/5">{t.browse}</Link>
          <Link href="/publicar" className="mt-1 px-3.5 py-2.5 rounded-pill bg-ink text-paper text-[14px] font-semibold text-center shadow-hard-soft">{t.publish}</Link>
        </nav>

        <div className="p-3 border-t border-ink/10 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="w-9 h-9 shrink-0 rounded-pill bg-ink text-paper flex items-center justify-center text-[14px] font-bold">{initials}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate">{user?.full_name || (lang === 'es' ? 'Mi cuenta' : 'My account')}</div>
              <div className="text-[11px] text-ink/50 font-mono truncate">{user?.email}</div>
            </div>
          </div>
          <button onClick={() => setShowLogout(true)} className="w-full mt-1 px-3.5 py-2.5 rounded-input text-[14px] font-medium text-ink/60 hover:bg-ink/5 text-left">{t.logout}</button>
        </div>
      </aside>

      {/* CONTENT */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 px-5 md:px-8 h-[68px] border-b border-ink/12">
          <button onClick={() => setOpen(true)} aria-label="Menú" className="lg:hidden w-9 h-9 rounded-pill border border-ink/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <span className="lg:hidden text-[18px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></span>
          <div className="hidden lg:block flex-1" />
          <div className="flex items-center border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((l) => <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-pill ${lang === l ? 'bg-ink text-paper' : 'text-ink/55'}`}>{l.toUpperCase()}</button>)}
          </div>
        </div>
        <main className="max-w-[1040px] mx-auto px-5 md:px-8 py-8">{children}</main>
      </div>

      <ConfirmModal open={showLogout} title={t.logout} message={t.logoutMsg} confirmLabel={t.logout} cancelLabel={t.cancel} onConfirm={() => { setShowLogout(false); logout(); }} onCancel={() => setShowLogout(false)} />
    </div>
  );
}
