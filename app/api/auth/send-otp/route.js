// Sends a signup email-OTP. Rejects if the email is already registered.
import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/users';
import { saveOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

export async function POST(req) {
  const { email, fullName, phone } = await req.json().catch(() => ({}));
  if (!emailOk(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const existing = await findUserByEmail(email).catch(() => null);
  if (existing) return NextResponse.json({ error: 'email_taken' }, { status: 409 });

  let saved;
  try {
    saved = await saveOtp(email, 'signup', 10, { fullName: fullName || null, phone: phone || null });
  } catch (e) {
    return NextResponse.json({ error: 'otp_store_error', detail: e?.message || String(e) }, { status: 500 });
  }
  if (!saved.ok) {
    const status = saved.error === 'cooldown' || saved.error === 'rate_limited' ? 429 : 500;
    return NextResponse.json({ error: saved.error, retryInMs: saved.retryInMs }, { status });
  }

  const sent = await sendOtpEmail(email, saved.code);
  if (!sent.ok) return NextResponse.json({ error: 'email_send_failed', detail: sent.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
