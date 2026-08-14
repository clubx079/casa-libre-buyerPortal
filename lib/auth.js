// Stateless HMAC-signed session cookie for buyer-portal accounts. No AiroBase Auth.
// Mirrors the super-admin pattern; payload carries the user id/email/name.
import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE = 'cl_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  return process.env.SESSION_SECRET || 'insecure-dev-secret';
}
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (p) => crypto.createHmac('sha256', secret()).update(p).digest('base64url');

// Build a signed token for a user row.
export function makeToken(user) {
  const payload = { uid: user.id, email: user.email, name: user.full_name || null, exp: Date.now() + MAX_AGE * 1000 };
  const p = b64url(JSON.stringify(payload));
  return `${p}.${sign(p)}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [p, sig] = token.split('.');
  const expected = sign(p);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload; // { uid, email, name, exp }
  } catch {
    return null;
  }
}

// Read + verify the current session (server components / route handlers).
export function getSession() {
  const token = cookies().get(COOKIE)?.value;
  return verifyToken(token);
}

export function setSessionCookie(user) {
  cookies().set(COOKIE, makeToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export const COOKIE_NAME = COOKIE;
