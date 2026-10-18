// Email OTP codes: 6-digit, bcrypt-hashed, stored in `otp_codes`, one active per
// (identifier, purpose). Rate-limited. Server-only. Mirrors the DeelMap flow.
import 'server-only';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { select, insert, update, remove } from './db';

const SEND_COOLDOWN_MS = 30 * 1000;      // min gap between sends
const WINDOW_MS = 60 * 60 * 1000;        // rolling window
const MAX_SENDS_PER_WINDOW = 6;
const MAX_VERIFY_ATTEMPTS = 5;

const norm = (id) => String(id || '').trim().toLowerCase();
export const generateCode = () => String(crypto.randomInt(100000, 1000000)); // 6 digits

async function loadRow(identifier, purpose) {
  const rows = await select('otp_codes', `select=*&identifier=eq.${encodeURIComponent(identifier)}&purpose=eq.${encodeURIComponent(purpose)}&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// Create/refresh a code. Returns { ok, code } or { ok:false, error, retryInMs }.
export async function saveOtp(identifier, purpose, ttlMinutes = 10, meta = {}) {
  const code = generateCode();
  const saved = await storeRow(identifier, purpose, ttlMinutes, meta, await bcrypt.hash(code, 10));
  return saved.ok ? { ok: true, code } : saved;
}

// WhatsApp codes (lib/relay.js): Relay makes, sends and checks the code itself; we keep
// one row per number for the same cooldown / hourly limit, holding Relay's otp_id in
// meta. Step 1: rateCheck → send with Relay → saveRelayOtp. Step 2: loadRelayOtp.
export async function rateCheck(identifier, purpose) {
  const row = await loadRow(norm(identifier), purpose);
  const r = limits(row, Date.now());
  return r.ok ? { ok: true } : r;
}
export const saveRelayOtp = (identifier, purpose, ttlMinutes, meta) => storeRow(identifier, purpose, ttlMinutes, meta, 'relay');
export async function loadRelayOtp(identifier, purpose) {
  const row = await loadRow(norm(identifier), purpose);
  if (!row || !row.meta?.otp_id) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) { await remove('otp_codes', `id=eq.${row.id}`); return null; }
  return row;
}
export const deleteOtpRow = (id) => remove('otp_codes', `id=eq.${id}`);

function limits(existing, now) {
  if (!existing) return { ok: true, send_count: 1, window_started_at: new Date(now).toISOString() };
  const winStart = new Date(existing.window_started_at).getTime();
  const lastSent = new Date(existing.last_sent_at).getTime();
  if (now - lastSent < SEND_COOLDOWN_MS) return { ok: false, error: 'cooldown', retryInMs: SEND_COOLDOWN_MS - (now - lastSent) };
  if (now - winStart < WINDOW_MS) {
    if (existing.send_count >= MAX_SENDS_PER_WINDOW) return { ok: false, error: 'rate_limited', retryInMs: WINDOW_MS - (now - winStart) };
    return { ok: true, send_count: existing.send_count + 1, window_started_at: existing.window_started_at };
  }
  return { ok: true, send_count: 1, window_started_at: new Date(now).toISOString() };
}

async function storeRow(identifier, purpose, ttlMinutes, meta, code_hash) {
  const id = norm(identifier);
  const now = Date.now();
  const existing = await loadRow(id, purpose);
  const lim = limits(existing, now);
  if (!lim.ok) return lim;
  const { send_count, window_started_at } = lim;
  const expires_at = new Date(now + ttlMinutes * 60 * 1000).toISOString();
  const last_sent_at = new Date(now).toISOString();

  if (existing) {
    await update('otp_codes', `id=eq.${existing.id}`,
      { code_hash, meta, attempts: 0, send_count, window_started_at, last_sent_at, expires_at }, { returning: 'minimal' });
  } else {
    await insert('otp_codes', { identifier: id, purpose, code_hash, meta, send_count, window_started_at, last_sent_at, expires_at }, { returning: 'minimal' });
  }
  return { ok: true };
}

// Verify a code. By default consumes it on success; pass { consume:false } to
// validate without deleting (used by the password-reset "check code" step, where
// the final reset step re-verifies with consume:true). Returns { valid, ... }.
export async function verifyOtp(identifier, purpose, code, opts = {}) {
  const { consume = true } = opts;
  const id = norm(identifier);
  const row = await loadRow(id, purpose);
  if (!row) return { valid: false, error: 'not_found' };
  if (new Date(row.expires_at).getTime() < Date.now()) { await remove('otp_codes', `id=eq.${row.id}`); return { valid: false, error: 'expired' }; }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) { await remove('otp_codes', `id=eq.${row.id}`); return { valid: false, error: 'too_many_attempts' }; }

  const ok = await bcrypt.compare(String(code || ''), row.code_hash);
  if (!ok) {
    await update('otp_codes', `id=eq.${row.id}`, { attempts: row.attempts + 1 }, { returning: 'minimal' });
    return { valid: false, error: 'invalid', attemptsLeft: MAX_VERIFY_ATTEMPTS - row.attempts - 1 };
  }
  if (consume) await remove('otp_codes', `id=eq.${row.id}`); // consume
  return { valid: true, meta: row.meta || {} };
}
