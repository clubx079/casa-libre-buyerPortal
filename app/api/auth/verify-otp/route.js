// Verifies the signup OTP, then creates the account and logs the user in.
import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { findUserByEmail, createUser, verifyExistingUser, publicUser } from '@/lib/users';
import { setSessionCookie } from '@/lib/auth';
import { getClientIP } from '@/lib/ip';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { email, code, password } = body;
  if (!email || !code) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (!password || String(password).length < 6) return NextResponse.json({ error: 'weak_password' }, { status: 400 });

  const result = await verifyOtp(email, 'signup', code);
  if (!result.valid) return NextResponse.json({ error: result.error, attemptsLeft: result.attemptsLeft }, { status: 400 });

  const fullName = body.fullName || result.meta?.fullName || null;
  const phone = body.phone || result.meta?.phone || null;

  // A VERIFIED account here is a real collision (race → tell them to log in).
  // An UNVERIFIED lead (saved when they entered their address) is CLAIMED: set
  // its password + mark verified. No prior row → create fresh.
  const already = await findUserByEmail(email).catch(() => null);
  if (already && already.verified) return NextResponse.json({ error: 'email_taken' }, { status: 409 });

  let user;
  try {
    user = already && !already.verified
      ? await verifyExistingUser(already.id, { password, fullName, phone })
      : await createUser({ email, password, fullName, phone, ip: getClientIP(req) });
  } catch (e) {
    return NextResponse.json({ error: 'create_failed', detail: e?.message || String(e) }, { status: 500 });
  }
  // Welcome email — awaited (serverless freezes the function after the response,
  // which would kill a fire-and-forget send). Wrapped so it never blocks signup.
  await sendWelcomeEmail(email, fullName).catch(() => {});
  setSessionCookie(user);
  return NextResponse.json({ ok: true, user: publicUser(user) });
}
