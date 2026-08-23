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

export async function touchLogin(id, ip) {
  try { await update('users', `id=eq.${encodeURIComponent(id)}`, { last_login_at: new Date().toISOString(), ...(ip ? { ip_address: ip } : {}) }, { returning: 'minimal' }); } catch {}
}

// Public-safe view (no password hash) for API responses / client state.
export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, full_name: u.full_name || null, phone: u.phone || null, verified: !!u.verified };
}
