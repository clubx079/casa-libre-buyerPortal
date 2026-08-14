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
  const id = norm(identifier);
  const now = Date.now();
  const existing = await loadRow(id, purpose);

  let send_count = 1, window_started_at = new Date(now).toISOString();
  if (existing) {
    const winStart = new Date(existing.window_started_at).getTime();
    const lastSent = new Date(existing.last_sent_at).getTime();
    if (now - lastSent < SEND_COOLDOWN_MS) return { ok: false, error: 'cooldown', retryInMs: SEND_COOLDOWN_MS - (now - lastSent) };
    if (now - winStart < WINDOW_MS) {
      if (existing.send_count >= MAX_SENDS_PER_WINDOW) return { ok: false, error: 'rate_limited', retryInMs: WINDOW_MS - (now - winStart) };
      send_count = existing.send_count + 1;
      window_started_at = existing.window_started_at;
    }
  }

  const code = generateCode();
  const code_hash = await bcrypt.hash(code, 10);
  const expires_at = new Date(now + ttlMinutes * 60 * 1000).toISOString();
  const last_sent_at = new Date(now).toISOString();

  if (existing) {
    await update('otp_codes', `id=eq.${existing.id}`,
      { code_hash, meta, attempts: 0, send_count, window_started_at, last_sent_at, expires_at }, { returning: 'minimal' });
  } else {
    await insert('otp_codes', { identifier: id, purpose, code_hash, meta, send_count, window_started_at, last_sent_at, expires_at }, { returning: 'minimal' });
  }
  return { ok: true, code };
}

// Verify + consume. Returns { valid:true, meta } or { valid:false, error }.
export async function verifyOtp(identifier, purpose, code) {
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
  await remove('otp_codes', `id=eq.${row.id}`); // consume
  return { valid: true, meta: row.meta || {} };
}
