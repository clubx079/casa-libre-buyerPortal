// User records for the buyer portal, stored in the AiroBase `users` table via
// PostgREST (service key). Passwords are bcrypt-hashed in Node.
import 'server-only';
import bcrypt from 'bcryptjs';
import { select, insert, update } from './db';

const norm = (email) => String(email || '').trim().toLowerCase();

export async function findUserByEmail(email) {
  const e = norm(email);
  if (!e) return null;
  const rows = await select('users', `select=*&email=eq.${encodeURIComponent(e)}&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function getUserById(id) {
  if (!id) return null;
  const rows = await select('users', `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// Create a verified user (called after OTP passes). Returns the row.
export async function createUser({ email, password, fullName, phone, ip }) {
  const password_hash = password ? await bcrypt.hash(password, 10) : null;
  const row = {
    email: norm(email),
    password_hash,
    full_name: fullName || null,
    phone: phone || null,
    verified: true,
    active: true,
    last_login_at: new Date().toISOString(),
    registration_ip: ip || null,
    ip_address: ip || null,
  };
  const res = await insert('users', row, { returning: 'representation' });
  return Array.isArray(res) ? res[0] : res;
}

// Find-or-create a user from a Google profile (email is the identity key).
export async function findOrCreateGoogleUser({ email, googleId, fullName, ip }) {
  const e = norm(email);
  const now = new Date().toISOString();
  const existing = await findUserByEmail(e);
  if (existing) {
    const res = await update('users', `id=eq.${existing.id}`,
      { google_id: googleId, auth_provider: 'google', verified: true, full_name: existing.full_name || fullName || null, last_login_at: now, ...(ip ? { ip_address: ip } : {}) },
      { returning: 'representation' });
    const u = (Array.isArray(res) ? res[0] : res) || existing;
    return { ...u, _isNew: false };
  }
  const res = await insert('users',
    { email: e, google_id: googleId, auth_provider: 'google', full_name: fullName || null, verified: true, active: true, last_login_at: now, registration_ip: ip || null, ip_address: ip || null },
    { returning: 'representation' });
  const u = Array.isArray(res) ? res[0] : res;
  return { ...u, _isNew: true };
}

export async function verifyPassword(user, password) {
  if (!user?.password_hash || !password) return false;
  try { return await bcrypt.compare(password, user.password_hash); } catch { return false; }
}

// Set a new password (called after a password-reset OTP passes). Bcrypt-hashed.
export async function updatePassword(userId, newPassword) {
  const password_hash = await bcrypt.hash(newPassword, 10);
  await update('users', `id=eq.${encodeURIComponent(userId)}`, { password_hash }, { returning: 'minimal' });
  return true;
}

export async function touchLogin(id, ip) {
  try { await update('users', `id=eq.${encodeURIComponent(id)}`, { last_login_at: new Date().toISOString(), ...(ip ? { ip_address: ip } : {}) }, { returning: 'minimal' }); } catch {}
}

// Create (or return) an UNVERIFIED lead — someone who entered their email at the
// wizard's address step but hasn't verified yet. No password; verified=false.
// If any row already exists (verified or not) it's returned unchanged, so this
// never clobbers a real account and never duplicates.
export async function upsertUnverifiedUser({ email, fullName, phone, ip }) {
  const e = norm(email);
  if (!e) return null;
  const existing = await findUserByEmail(e);
  if (existing) return existing;
  const row = {
    email: e,
    password_hash: null,
    full_name: fullName || null,
    phone: phone || null,
    verified: false,
    active: true,
    auth_provider: 'pending',
    registration_ip: ip || null,
    ip_address: ip || null,
  };
  const res = await insert('users', row, { returning: 'representation' });
  return Array.isArray(res) ? res[0] : res;
}

// Claim an existing unverified lead when its OTP passes: set the password and
// mark it verified (so a returning user who once abandoned the wizard becomes a
// real account on the spot). Returns the updated row.
export async function verifyExistingUser(userId, { password, fullName, phone } = {}) {
  const password_hash = password ? await bcrypt.hash(password, 10) : null;
  const patch = {
    verified: true,
    auth_provider: 'password',
    last_login_at: new Date().toISOString(),
    ...(password_hash ? { password_hash } : {}),
    ...(fullName ? { full_name: fullName } : {}),
    ...(phone ? { phone } : {}),
  };
  const res = await update('users', `id=eq.${encodeURIComponent(userId)}`, patch, { returning: 'representation' });
  return Array.isArray(res) ? res[0] : res;
}

// Public-safe view (no password hash) for API responses / client state.
export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, full_name: u.full_name || null, phone: u.phone || null, verified: !!u.verified };
}
