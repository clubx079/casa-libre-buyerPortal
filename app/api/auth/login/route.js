// Email + password login for existing (email-verified) accounts.
import { NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword, touchLogin, publicUser } from '@/lib/users';
import { setSessionCookie } from '@/lib/auth';
import { getClientIP } from '@/lib/ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const user = await findUserByEmail(email).catch(() => null);
  if (!user || user.active === false) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  const ok = await verifyPassword(user, password);
  if (!ok) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  if (user.blocked || user.suspended) return NextResponse.json({ error: 'account_blocked' }, { status: 403 });

  await touchLogin(user.id, getClientIP(req));
  setSessionCookie(user);
  return NextResponse.json({ ok: true, user: publicUser(user) });
}
