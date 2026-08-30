// Sends a password-reset email-OTP. To avoid email enumeration we always return
// ok:true, and only actually send a code when the account exists.
import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/users';
import { saveOtp } from '@/lib/otp';
import { sendPasswordResetEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

export async function POST(req) {
  const { email } = await req.json().catch(() => ({}));
  if (!emailOk(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const user = await findUserByEmail(email).catch(() => null);
  // Only send when the account exists and is usable. Don't reveal existence.
  if (user && user.active !== false && !user.blocked && !user.suspended) {
    let saved;
    try {
      saved = await saveOtp(email, 'password_reset', 15);
    } catch {
      return NextResponse.json({ ok: true }); // fail closed, still generic
    }
    if (!saved.ok) {
      // Surface rate limiting so the UI can tell the user to wait.
      if (saved.error === 'cooldown' || saved.error === 'rate_limited') {
        return NextResponse.json({ error: saved.error, retryInMs: saved.retryInMs }, { status: 429 });
      }
      return NextResponse.json({ ok: true });
    }
    await sendPasswordResetEmail(email, saved.code).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
