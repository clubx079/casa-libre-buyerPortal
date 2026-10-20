// POST /api/account/whatsapp — a signed-in account ADDS its WhatsApp (Settings →
// "Agregar WhatsApp"), so one person keeps ONE account and can then sign in with either
// the email or the number:
//   { phone }        → send a 6-digit code to that WhatsApp (Relay)
//   { phone, code }  → check it and attach the number (users.phone + phone_verified_at)
// A number already verified on another account is refused (409 number_taken): that is
// another person's sign-in — or this person's other account (admin: "same person").
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { COUNTRY } from '@/lib/country';
import { toE164 } from '@/lib/whatsappPhone';
import { relayConfigured, relayTestMode, sendWhatsAppCode, checkWhatsAppCode } from '@/lib/relay';
import { rateCheck, saveRelayOtp, loadRelayOtp, deleteOtpRow } from '@/lib/otp';
import { findUserByVerifiedPhone, markPhoneVerified, getUserById } from '@/lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req) {
  const s = getSession();
  if (!s?.uid) return fail('unauthorized', 401);
  if (!relayConfigured()) return fail('not_configured', 503);
  const body = await req.json().catch(() => ({}));
  const phone = toE164(body.phone, COUNTRY.phonePrefix);
  if (!phone) return fail('invalid_phone');

  let owner;
  try { owner = await findUserByVerifiedPhone(phone); } catch { return fail('not_set_up', 503); }
  if (owner && String(owner.id) === String(s.uid)) return NextResponse.json({ ok: true, already: true, phone });
  if (owner) return fail('number_taken', 409);

  const ident = `walink:${s.uid}:${phone}`;
  const code = String(body.code || '').replace(/\D/g, '');

  if (!code) {
    const lim = await rateCheck(ident, 'whatsapp').catch(() => ({ ok: false, error: 'otp_store_error' }));
    if (!lim.ok) return fail(lim.error, lim.error === 'otp_store_error' ? 500 : 429, { retryInMs: lim.retryInMs });
    let sent;
    try { sent = await sendWhatsAppCode(phone, { purpose: 'link', country: COUNTRY.code }); }
    catch (e) {
      if (e.status === 429) return fail('rate_limited', 429, { retryInMs: (e.retryAfter || 60) * 1000 });
      if (e.code === 'invalid_phone') return fail('invalid_phone');
      return fail('whatsapp_send_failed', 502);
    }
    const saved = await saveRelayOtp(ident, 'whatsapp', 10, { otp_id: sent.otpId, mode: 'link' }).catch(() => null);
    if (!saved?.ok) return fail('otp_store_error', 500);
    return NextResponse.json({ ok: true, sent: true, phone, ...(relayTestMode() && sent.testCode ? { devCode: sent.testCode } : {}) });
  }

  const row = await loadRelayOtp(ident, 'whatsapp').catch(() => null);
  if (!row) return fail('expired');
  let check;
  try { check = await checkWhatsAppCode(row.meta.otp_id, code); }
  catch (e) { return fail(e.status === 404 ? 'expired' : 'whatsapp_check_failed', e.status === 404 ? 400 : 502); }
  if (!check.valid) {
    if (check.status === 'invalid') return fail('invalid', 400, { attemptsLeft: check.attemptsRemaining });
    await deleteOtpRow(row.id).catch(() => {});
    return fail(check.status === 'max_attempts_exceeded' ? 'too_many_attempts' : 'expired');
  }
  await deleteOtpRow(row.id).catch(() => {});
  // Someone else may have verified it in the meantime (the unique index refuses a second one).
  try { await markPhoneVerified(s.uid, phone, { keepProvider: true }); }
  catch (e) { return fail(e?.code === '23505' || e?.status === 409 ? 'number_taken' : 'save_failed', e?.code === '23505' || e?.status === 409 ? 409 : 500); }
  const u = await getUserById(s.uid).catch(() => null);
  return NextResponse.json({ ok: true, phone: u?.phone || phone });
}
