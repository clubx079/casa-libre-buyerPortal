// "Confirm your email" for WhatsApp sign-ups. A WhatsApp code proves the number, but
// the email typed next to it is unproven (it can be fake). The welcome email carries a
// signed one-click link; clicking it marks the email confirmed: auth_provider
// 'whatsapp' → 'whatsapp_email'. Until then that email does not count as a verified
// identity (admin Users page, "same person"). Signed + self-contained, no DB column.
import 'server-only';
import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || process.env.CRON_SECRET || 'cl_confirm_dev_secret';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;   // the link works for 30 days
export const UNCONFIRMED = 'whatsapp';       // WhatsApp sign-up, email not confirmed yet
export const CONFIRMED = 'whatsapp_email';   // WhatsApp sign-up, email confirmed

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (data) => b64url(crypto.createHmac('sha256', SECRET).update(`confirm_email:${data}`).digest());

export function signEmailConfirm({ uid, email }, ttlMs = TTL_MS) {
  const body = b64url(JSON.stringify({ uid: String(uid), email: String(email).trim().toLowerCase(), exp: Date.now() + ttlMs }));
  return `${body}.${hmac(body)}`;
}

// → { uid, email } or null (tampered / expired)
export function verifyEmailConfirm(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(hmac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!p?.uid || !p?.email || !p.exp || Date.now() > Number(p.exp)) return null;
  return { uid: p.uid, email: p.email };
}

export const emailConfirmed = (user) => String(user?.auth_provider || '') !== UNCONFIRMED;
