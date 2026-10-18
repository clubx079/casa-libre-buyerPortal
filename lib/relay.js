// Relay (relay.airosofts.com) — our WhatsApp gateway. Used here for WhatsApp sign-in
// codes: Relay generates the code, sends it with the project's approved authentication
// template (casa_libre_otp), stores only its hash and counts the attempts.
// Env (server only — never ship the key to the browser):
//   RELAY_API_KEY   rk_test_… (simulated: nothing reaches WhatsApp, the code comes back
//                   as test_code) or rk_live_… (real WhatsApp messages)
//   RELAY_BASE_URL  default https://relay.airosofts.com/v1
//   RELAY_OTP_LOCALE  template language, default es_MX
import 'server-only';

const base = () => String(process.env.RELAY_BASE_URL || 'https://relay.airosofts.com/v1').replace(/\/+$/, '');
const key = () => String(process.env.RELAY_API_KEY || '').trim();

export const relayConfigured = () => !!key();
export const relayTestMode = () => key().startsWith('rk_test_');

async function call(path, body) {
  const r = await fetch(`${base()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j?.error?.message || `Relay ${r.status}`);
    e.status = r.status;
    e.code = j?.error?.code || null;
    e.retryAfter = Number(r.headers.get('retry-after')) || null;
    throw e;
  }
  return j;
}

// → { otpId, expiresAt, testCode? }. testCode only with a test key.
export async function sendWhatsAppCode(to, metadata = {}) {
  const j = await call('/otp/send', { to, locale: process.env.RELAY_OTP_LOCALE || 'es_MX', metadata });
  return { otpId: j.otp_id, expiresAt: j.expires_at, testCode: j.test_code || null };
}

// → { valid, status, attemptsRemaining }. status: valid | invalid | expired |
// max_attempts_exceeded | already_verified.
export async function checkWhatsAppCode(otpId, code) {
  const j = await call('/otp/verify', { otp_id: otpId, code: String(code || '') });
  return { valid: !!j.valid, status: j.status, attemptsRemaining: j.attempts_remaining ?? null };
}
