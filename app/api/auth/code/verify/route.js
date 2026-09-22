// Passwordless sign-in, step 2: confirm the code and start the session.
//
// Works for both cases the send step reports:
//   · 'login'  — an existing verified account: the code proves the email, we sign in
//   · 'signup' — a new or unverified email: the code confirms it and the account is
//                created without a password (Google or another code signs in later)
// No password is asked for, or set, at any point.
import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { findUserByEmail, createUser, verifyExistingUser, touchLogin, publicUser } from '@/lib/users';
import { setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { email, code, fullName } = body;
  if (!email || !code) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const existing = await findUserByEmail(email).catch(() => null);
  const isLogin = !!(existing && existing.verified);

  const result = await verifyOtp(email, isLogin ? 'login' : 'signup', String(code));
  if (!result.valid) {
    return NextResponse.json({ error: result.error, attemptsLeft: result.attemptsLeft }, { status: 400 });
  }

  let user;
  if (isLogin) {
    if (existing.blocked || existing.suspended || existing.active === false) {
      return NextResponse.json({ error: 'account_unavailable' }, { status: 403 });
    }
    user = existing;
    await touchLogin(user.id, ip).catch(() => {});
  } else if (existing) {
    // placeholder row from the send step (or an abandoned signup) → confirm it
    user = await verifyExistingUser(existing.id, { fullName: fullName || existing.full_name || null });
  } else {
    user = await createUser({ email, password: null, fullName: fullName || null, phone: null, ip });
  }

  if (!user) return NextResponse.json({ error: 'create_failed' }, { status: 500 });

  setSessionCookie(user);
  return NextResponse.json({ ok: true, mode: isLogin ? 'login' : 'signup', user: publicUser(user) });
}
