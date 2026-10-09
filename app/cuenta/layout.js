'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import AccountShell from '@/components/account/AccountShell';
import { safeReturnPath } from '@/lib/returnPath';

// The whole account area requires login. While auth resolves we show a spinner;
// once resolved without a user we open the auth modal and bounce home — and after
// signing in (code or Google) we come back to the page that was asked for, so a link
// like the draft reminder email's "Continuar mi publicación"
// (/cuenta/publicaciones?tab=borradores&draft=<id>) still opens that draft.
export default function CuentaLayout({ children }) {
  const { user, loading, openAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      let back = null;
      try { back = safeReturnPath(window.location.pathname + window.location.search) || safeReturnPath(window.location.pathname); } catch {}
      if (back) openAuth(() => router.replace(back), { next: back });
      else openAuth();
      router.replace('/');
    }
  }, [loading, user, openAuth, router]);

  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink/40 font-mono text-[13px]">…</div>;
  if (!user) return null;
  return <AccountShell>{children}</AccountShell>;
}
