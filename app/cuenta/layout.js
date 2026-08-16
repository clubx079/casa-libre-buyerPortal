'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import AccountShell from '@/components/account/AccountShell';

// The whole account area requires login. While auth resolves we show a spinner;
// once resolved without a user we open the auth modal and bounce home.
export default function CuentaLayout({ children }) {
  const { user, loading, openAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) { openAuth(); router.replace('/'); }
  }, [loading, user, openAuth, router]);

  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink/40 font-mono text-[13px]">…</div>;
  if (!user) return null;
  return <AccountShell>{children}</AccountShell>;
}
