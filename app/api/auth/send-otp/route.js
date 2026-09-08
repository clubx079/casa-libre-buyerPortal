// Sends a signup email-OTP. Rejects if the email is already registered.
import { NextResponse } from 'next/server';
import { findUserByEmail, upsertUnverifiedUser } from '@/lib/users';
import { quarantineUserAddress } from '@/lib/quarantine';
import { saveOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';
import { getClientIP } from '@/lib/ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { email, fullName, phone, mode, seller_type, neighborhood, city, address } = body;
  if (!emailOk(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

  // Only a VERIFIED account blocks signup (→ log in). An unverified lead (or no
  // row) proceeds: we (re)send the OTP and capture the info below.
  const existing = await findUserByEmail(email).catch(() => null);
  if (existing && existing.verified) return NextResponse.json({ error: 'email_taken' }, { status: 409 });

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

  // Capture the info even if they never verify: save an UNVERIFIED lead and
  // quarantine the property ADDRESS for admin review. Best-effort — a failure
  // here must never block the OTP send.
  try {
    const ip = getClientIP(req);
    await upsertUnverifiedUser({ email, fullName, phone, ip });
    if (neighborhood || city || address) {
      await quarantineUserAddress({ email, mode, sellerType: seller_type, neighborhood, city, address, fullName });
    }
  } catch (e) {
    console.error('[send-otp] unverified lead / quarantine save failed:', e?.message || e);
  }

  const sent = await sendOtpEmail(email, saved.code);
  if (!sent.ok) return NextResponse.json({ error: 'email_send_failed', detail: sent.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
