// Validates a password-reset code WITHOUT consuming it — the reset-password step
// re-verifies and consumes it. Lets the UI confirm the code before asking for a
// new password.
import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { email, code } = await req.json().catch(() => ({}));
  if (!email || !code) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const result = await verifyOtp(email, 'password_reset', code, { consume: false });
  if (!result.valid) {
    return NextResponse.json({ error: result.error, attemptsLeft: result.attemptsLeft }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
