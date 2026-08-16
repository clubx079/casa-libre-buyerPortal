// Change email with OTP re-verification.
//   POST /api/account/change-email { newEmail }            -> sends a code to newEmail
//   POST /api/account/change-email { newEmail, code }      -> verifies + updates
import { NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth';
import { findUserByEmail, getUserById, publicUser } from '@/lib/users';
import { saveOtp, verifyOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';
import { update } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

export async function POST(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { newEmail, code } = await req.json().catch(() => ({}));
  if (!emailOk(newEmail)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  const taken = await findUserByEmail(newEmail).catch(() => null);
  if (taken && String(taken.id) !== String(s.uid)) return NextResponse.json({ error: 'email_taken' }, { status: 409 });

  // Step 1 — request the code.
  if (!code) {
    const saved = await saveOtp(newEmail, 'change_email', 10, { uid: s.uid });
    if (!saved.ok) return NextResponse.json({ error: saved.error, retryInMs: saved.retryInMs }, { status: saved.error === 'cooldown' || saved.error === 'rate_limited' ? 429 : 500 });
    const sent = await sendOtpEmail(newEmail, saved.code);
    if (!sent.ok) return NextResponse.json({ error: 'email_send_failed', detail: sent.error }, { status: 502 });
    return NextResponse.json({ ok: true, sent: true });
  }

  // Step 2 — verify + update.
  const result = await verifyOtp(newEmail, 'change_email', code);
  if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 });
  if (String(result.meta?.uid) !== String(s.uid)) return NextResponse.json({ error: 'mismatch' }, { status: 400 });
  try {
    await update('users', `id=eq.${encodeURIComponent(s.uid)}`, { email: String(newEmail).trim().toLowerCase(), updated_at: new Date().toISOString() }, { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'update_failed', detail: e?.message }, { status: 500 });
  }
  const fresh = await getUserById(s.uid);
  if (fresh) setSessionCookie(fresh);
  return NextResponse.json({ ok: true, user: publicUser(fresh) });
}
