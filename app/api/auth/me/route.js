import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth';
import { getUserById } from '@/lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ user: null });
  const u = await getUserById(s.uid).catch(() => null);
  if (!u || u.blocked || u.suspended || u.active === false) {
    try { clearSessionCookie(); } catch {}
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: { id: u.id, email: u.email, full_name: u.full_name || null } });
}
