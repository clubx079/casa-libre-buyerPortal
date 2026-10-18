// Sign in with WhatsApp, step 1: send a 6-digit code to the person's WhatsApp (Relay).
//
// Same idea as /api/auth/code/send (email): one endpoint, and the reply says what the
// code will do —
//   · the number is already proven on an account → 'login'
//   · otherwise                                   → 'signup' (step 2 also asks name + email)
// Relay creates, sends and checks the code; we only keep its otp_id (otp_codes row,
// identifier "wa:+595…") plus our usual cooldown / hourly limit.
import { NextResponse } from 'next/server';
import { COUNTRY } from '@/lib/country';
import { toE164 } from '@/lib/whatsappPhone';
import { relayConfigured, relayTestMode, sendWhatsAppCode } from '@/lib/relay';
import { rateCheck, saveRelayOtp } from '@/lib/otp';
import { findUserByVerifiedPhone } from '@/lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!relayConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const phone = toE164(body.phone, COUNTRY.phonePrefix);
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  let existing;
  try { existing = await findUserByVerifiedPhone(phone); }
  catch { return NextResponse.json({ error: 'not_set_up' }, { status: 503 }); } // migration 016 missing
  const mode = existing ? 'login' : 'signup';

  const ident = `wa:${phone}`;
  const lim = await rateCheck(ident, 'whatsapp').catch(() => ({ ok: false, error: 'otp_store_error' }));
  if (!lim.ok) return NextResponse.json({ error: lim.error, retryInMs: lim.retryInMs }, { status: lim.error === 'otp_store_error' ? 500 : 429 });

  let sent;
  try { sent = await sendWhatsAppCode(phone, { purpose: mode, country: COUNTRY.code }); }
  catch (e) {
    if (e.status === 429) return NextResponse.json({ error: 'rate_limited', retryInMs: (e.retryAfter || 60) * 1000 }, { status: 429 });
    if (e.code === 'invalid_phone') return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    return NextResponse.json({ error: 'whatsapp_send_failed', detail: e.code || e.message }, { status: 502 });
  }

  const saved = await saveRelayOtp(ident, 'whatsapp', 10, { otp_id: sent.otpId, mode }).catch(() => null);
  if (!saved?.ok) return NextResponse.json({ error: 'otp_store_error' }, { status: 500 });

  // Test key only (rk_test_…, never real WhatsApp): hand the code back so the local
  // screen can show it. A live key never returns one.
  return NextResponse.json({ ok: true, mode, phone, ...(relayTestMode() && sent.testCode ? { devCode: sent.testCode } : {}) });
}
