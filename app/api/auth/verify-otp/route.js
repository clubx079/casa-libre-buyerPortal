// Verifies the signup OTP, then creates the account and logs the user in.
import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { findUserByEmail, createUser, publicUser } from '@/lib/users';
import { setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { email, code, password } = body;
  if (!email || !code) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (!password || String(password).length < 6) return NextResponse.json({ error: 'weak_password' }, { status: 400 });

  const result = await verifyOtp(email, 'signup', code);
  if (!result.valid) return NextResponse.json({ error: result.error, attemptsLeft: result.attemptsLeft }, { status: 400 });

  // Guard against a race: if the account now exists, don't duplicate.
  const already = await findUserByEmail(email).catch(() => null);
  if (already) return NextResponse.json({ error: 'email_taken' }, { status: 409 });

  const fullName = body.fullName || result.meta?.fullName || null;
  const phone = body.phone || result.meta?.phone || null;

  let user;
  try {
    user = await createUser({ email, password, fullName, phone });
  } catch (e) {
    return NextResponse.json({ error: 'create_failed', detail: e?.message || String(e) }, { status: 500 });
  }
  setSessionCookie(user);
  return NextResponse.json({ ok: true, user: publicUser(user) });
}
