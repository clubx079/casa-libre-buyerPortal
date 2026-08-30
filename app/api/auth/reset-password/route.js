// Final step of the password reset: re-verify + consume the code, set the new
// bcrypt-hashed password, and log the user in (they just proved email ownership).
import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { findUserByEmail, updatePassword, touchLogin, publicUser } from '@/lib/users';
import { setSessionCookie } from '@/lib/auth';
import { getClientIP } from '@/lib/ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { email, code, password } = await req.json().catch(() => ({}));
  if (!email || !code) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (!password || String(password).length < 6) return NextResponse.json({ error: 'weak_password' }, { status: 400 });

  const result = await verifyOtp(email, 'password_reset', code, { consume: true });
  if (!result.valid) return NextResponse.json({ error: result.error, attemptsLeft: result.attemptsLeft }, { status: 400 });

  const user = await findUserByEmail(email).catch(() => null);
  if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  if (user.blocked || user.suspended) return NextResponse.json({ error: 'account_blocked' }, { status: 403 });

  try {
    await updatePassword(user.id, password);
  } catch (e) {
    return NextResponse.json({ error: 'update_failed', detail: e?.message || String(e) }, { status: 500 });
  }

  await touchLogin(user.id, getClientIP(req));
  setSessionCookie(user);
  return NextResponse.json({ ok: true, user: publicUser(user) });
}
