// The sell form's "Confirmá tu WhatsApp" step (lib/listingPhone.js):
//   GET  ?phone=…          → { verified } — is it already the account's own proven WhatsApp?
//   POST { phone }         → send a 6-digit code to that WhatsApp (Relay)
//   POST { phone, code }   → check it → { ok, proof }; an account with no WhatsApp yet also
//                            gets this number added (as Settings → "Agregar WhatsApp" does).
// An account that already has a different verified WhatsApp keeps it: the proof only says the
// seller controls the listing's number.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { COUNTRY } from '@/lib/country';
import { relayConfigured, relayTestMode, sendWhatsAppCode, checkWhatsAppCode } from '@/lib/relay';
import { rateCheck, saveRelayOtp, loadRelayOtp, deleteOtpRow } from '@/lib/otp';
import { findUserByVerifiedPhone, markPhoneVerified, getUserById } from '@/lib/users';
import { listingE164, isAccountPhone, makePhoneProof } from '@/lib/listingPhone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });
const SECRET = () => process.env.SESSION_SECRET || 'insecure-dev-secret';

export async function GET(req) {
  const s = getSession();
  if (!s?.uid) return fail('unauthorized', 401);
  const phone = listingE164(new URL(req.url).searchParams.get('phone'), COUNTRY.phonePrefix);
  if (!phone) return fail('invalid_phone');
  const user = await getUserById(s.uid).catch(() => null);
  return NextResponse.json({ ok: true, phone, verified: isAccountPhone(user, phone) });
}

export async function POST(req) {
  const s = getSession();
  if (!s?.uid) return fail('unauthorized', 401);
  const body = await req.json().catch(() => ({}));
  const phone = listingE164(body.phone, COUNTRY.phonePrefix);
  if (!phone) return fail('invalid_phone');
  const user = await getUserById(s.uid).catch(() => null);
  if (isAccountPhone(user, phone)) return NextResponse.json({ ok: true, already: true, phone, proof: makePhoneProof(SECRET(), s.uid, phone) });
  if (!relayConfigured()) return fail('not_configured', 503);

  const ident = `walisting:${s.uid}:${phone}`;
  const code = String(body.code || '').replace(/\D/g, '');

  if (!code) {
    const lim = await rateCheck(ident, 'whatsapp').catch(() => ({ ok: false, error: 'otp_store_error' }));
    if (!lim.ok) return fail(lim.error, lim.error === 'otp_store_error' ? 500 : 429, { retryInMs: lim.retryInMs });
    let sent;
    try { sent = await sendWhatsAppCode(phone, { purpose: 'listing', country: COUNTRY.code }); }
    catch (e) {
      if (e.status === 429) return fail('rate_limited', 429, { retryInMs: (e.retryAfter || 60) * 1000 });
      if (e.code === 'invalid_phone') return fail('invalid_phone');
      return fail('whatsapp_send_failed', 502);
    }
    const saved = await saveRelayOtp(ident, 'whatsapp', 10, { otp_id: sent.otpId, mode: 'listing' }).catch(() => null);
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

  // No WhatsApp on the account yet, and nobody else has proven this number → add it.
  let linked = false;
  if (!user?.phone_verified_at) {
    const owner = await findUserByVerifiedPhone(phone).catch(() => null);
    if (!owner) {
      try { await markPhoneVerified(s.uid, phone, { keepProvider: true }); linked = true; } catch { /* taken meanwhile: the proof still holds */ }
    }
  }
  return NextResponse.json({ ok: true, phone, linked, proof: makePhoneProof(SECRET(), s.uid, phone) });
}
