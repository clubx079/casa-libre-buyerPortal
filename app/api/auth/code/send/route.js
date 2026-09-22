// Passwordless sign-in, step 1: email a 6-digit code.
//
// The mobile app signs people in with a code instead of a password — people rarely
// log out of an app, and a code is one less thing to remember or leak. The same
// endpoint serves both cases and tells the caller which one happened:
//   · the email already has a verified account → 'login'  (code signs them in)
//   · no account yet, or an unverified one     → 'signup' (code creates it)
// Either way the reply is the same shape, so the app shows one screen.
import { NextResponse } from 'next/server';
import { findUserByEmail, upsertUnverifiedUser } from '@/lib/users';
import { saveOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { email, fullName } = body;
  if (!emailOk(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const existing = await findUserByEmail(email).catch(() => null);
  const mode = existing && existing.verified ? 'login' : 'signup';

  const saved = await saveOtp(email, mode === 'login' ? 'login' : 'signup', 10, { fullName: fullName || null })
    .catch((e) => ({ ok: false, error: 'otp_store_error', detail: e?.message }));
  if (!saved?.ok) {
    const status = saved?.error === 'rate_limited' ? 429 : 500;
    return NextResponse.json({ error: saved?.error || 'otp_store_error', retryInMs: saved?.retryInMs }, { status });
  }

  // A brand-new email gets a placeholder row so the account exists the moment the
  // code is confirmed (same as the website's wizard).
  if (mode === 'signup') {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    await upsertUnverifiedUser({ email, fullName, phone: null, ip }).catch(() => {});
  }

  const sent = await sendOtpEmail(email, saved.code);
  if (!sent.ok) return NextResponse.json({ error: 'email_send_failed', detail: sent.error }, { status: 502 });

  return NextResponse.json({ ok: true, mode });
}
