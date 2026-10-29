// Relay (relay.airosofts.com) — our WhatsApp gateway. Used here for WhatsApp sign-in
// codes: Relay generates the code, sends it with the project's approved authentication
// template (casa_libre_otp), stores only its hash and counts the attempts.
// Env (server only — never ship the key to the browser):
//   RELAY_API_KEY   rk_test_… (simulated: nothing reaches WhatsApp, the code comes back
//                   as test_code) or rk_live_… (real WhatsApp messages)
//   RELAY_BASE_URL  default https://relay.airosofts.com/v1
//   RELAY_OTP_LOCALE  template language, default es_MX
import 'server-only';
import { COUNTRY } from './country';

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
// The site that asked for the code goes with it (metadata.site) and onto the WhatsApp
// conversation as the tag "site-<code>" — one number serves every site, and the admin's
// inbox shows each conversation under the site(s) that number came from.
export async function sendWhatsAppCode(to, metadata = {}) {
  const site = String(metadata.country || COUNTRY.code || '').toLowerCase();
  const j = await call('/otp/send', { to, locale: process.env.RELAY_OTP_LOCALE || 'es_MX', metadata: { ...metadata, site } });
  if (site) await tagSite(to, site);
  return { otpId: j.otp_id, expiresAt: j.expires_at, testCode: j.test_code || null };
}

// Best effort: a failed tag never blocks the code.
async function tagSite(to, site) {
  try {
    await fetch(`${base()}/conversations/${encodeURIComponent(String(to).replace(/\D/g, ''))}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ add_tags: [`site-${site}`] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* the inbox falls back to the country DBs */ }
}

// → { valid, status, attemptsRemaining }. status: valid | invalid | expired |
// max_attempts_exceeded | already_verified.
export async function checkWhatsAppCode(otpId, code) {
  const j = await call('/otp/verify', { otp_id: otpId, code: String(code || '') });
  return { valid: !!j.valid, status: j.status, attemptsRemaining: j.attempts_remaining ?? null };
}
