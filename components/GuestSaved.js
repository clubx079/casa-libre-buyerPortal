'use client';
// /guardadas — saves for people who are NOT logged in (this browser's saves). A signed-in
// person is sent to /cuenta/guardadas: one Guardadas page, never two. The banner invites
// them to create an account; when they do, their saves move into it (/api/account/saved).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/lib/useLang';
import SavedList from '@/components/SavedList';

const T = {
  es: { title: 'No pierdas tus guardadas', body: 'Por ahora quedan guardadas en este navegador. Creá tu cuenta gratis y las vas a tener siempre, en tu celular y en tu compu.', cta: 'Crear cuenta gratis' },
  en: { title: "Don't lose your saved homes", body: "For now they're saved in this browser. Create your free account and you'll always have them, on your phone and your computer.", cta: 'Create a free account' },
};

export default function GuestSaved() {
  const { user, loading, openAuth } = useAuth();
  const router = useRouter();
  const [lang] = useLang();
  const t = T[lang] || T.es;

  useEffect(() => { if (!loading && user) router.replace('/cuenta/guardadas'); }, [loading, user, router]);
  if (loading || user) return <div className="min-h-[40vh]" />;

  const banner = (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 bg-card border-[1.5px] border-ink rounded-card p-5" data-testid="guest-saved-banner">
      <div className="flex-1">
        <p className="text-[15px] font-bold">{t.title}</p>
        <p className="text-[13.5px] text-ink/65 mt-1 max-w-[60ch]">{t.body}</p>
      </div>
      <button type="button" onClick={() => openAuth(() => router.replace('/cuenta/guardadas'), { next: '/cuenta/guardadas' })}
        className="shrink-0 px-5 py-3 rounded-pill bg-ink text-paper font-semibold text-[14px]">{t.cta}</button>
    </div>
  );
  return <SavedList banner={banner} />;
}
