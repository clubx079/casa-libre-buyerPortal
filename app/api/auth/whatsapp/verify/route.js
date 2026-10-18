// Sign in with WhatsApp, step 2: check the code (Relay) and start the session.
//   · 'login'  — the number is proven on an account → sign in to it
//   · 'signup' — new number: name + email are required. The email is not verified
//                here (the WhatsApp code proves the phone), so an email that already
//                belongs to a verified account is refused — that person signs in with
//                email. An unverified placeholder row for the email is claimed.
// Field checks run BEFORE the code is checked: Relay accepts a code only once.
import { NextResponse } from 'next/server';
import { COUNTRY } from '@/lib/country';
import { toE164 } from '@/lib/whatsappPhone';
import { relayConfigured, checkWhatsAppCode } from '@/lib/relay';
import { loadRelayOtp, deleteOtpRow } from '@/lib/otp';
import { findUserByEmail, findUserByVerifiedPhone, createUser, verifyExistingUser, markPhoneVerified, touchLogin, publicUser } from '@/lib/users';
import { setSessionCookie } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const fail = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req) {
  if (!relayConfigured()) return fail('not_configured', 503);
  const body = await req.json().catch(() => ({}));
  const phone = toE164(body.phone, COUNTRY.phonePrefix);
  const code = String(body.code || '').replace(/\D/g, '');
  if (!phone || !code) return fail('missing_fields');

  const row = await loadRelayOtp(`wa:${phone}`, 'whatsapp').catch(() => null);
  if (!row) return fail('expired');

  let existing;
  try { existing = await findUserByVerifiedPhone(phone); } catch { return fail('not_set_up', 503); }
  const isLogin = !!existing;

  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  let byEmail = null;
  if (!isLogin) {
    if (!fullName) return fail('missing_name');
    if (!emailOk(email)) return fail('invalid_email');
    byEmail = await findUserByEmail(email).catch(() => null);
    if (byEmail?.verified) return fail('email_taken', 409);
  } else if (existing.blocked || existing.suspended || existing.active === false) {
    return fail('account_unavailable', 403);
  }

  let check;
  try { check = await checkWhatsAppCode(row.meta.otp_id, code); }
  catch (e) { return fail(e.status === 404 ? 'expired' : 'whatsapp_check_failed', e.status === 404 ? 400 : 502); }
  if (!check.valid) {
    if (check.status === 'invalid') return fail('invalid', 400, { attemptsLeft: check.attemptsRemaining });
    await deleteOtpRow(row.id).catch(() => {});
    return fail(check.status === 'max_attempts_exceeded' ? 'too_many_attempts' : 'expired');
  }
  await deleteOtpRow(row.id).catch(() => {});

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  let user;
  if (isLogin) {
    user = existing;
    await touchLogin(user.id, ip).catch(() => {});
  } else {
    const base = byEmail
      ? await verifyExistingUser(byEmail.id, { fullName })
      : await createUser({ email, password: null, fullName, phone, ip });
    if (!base) return fail('create_failed', 500);
    user = (await markPhoneVerified(base.id, phone).catch(() => null)) || base;
    await sendWelcomeEmail(email, user.full_name || fullName).catch(() => {});
  }

  setSessionCookie(user);
  return NextResponse.json({ ok: true, mode: isLogin ? 'login' : 'signup', user: publicUser(user) });
}
