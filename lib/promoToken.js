// Signed, self-contained token for the one-click "Renew" link in the day-29
// promotion-reminder email. Lets the link work straight from the inbox (no session)
// while staying tamper-proof: it only names the property/user/plan; the renew route
// still re-checks ownership and charges the vaulted card server-side. Pure + DB-free.
import 'server-only';
import crypto from 'node:crypto';

const SECRET = process.env.PROMO_LINK_SECRET || process.env.SESSION_SECRET || process.env.CRON_SECRET || 'cl_promo_dev_secret';
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // link valid 14 days (reminder goes out ~1 day before expiry)

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (data) => b64url(crypto.createHmac('sha256', SECRET).update(data).digest());

// { pid, uid, plan } -> "payload.signature"
// purpose: omitted for the one-click renew link; 'extend' for the automation's
// pay-to-extend link (which must NEVER be accepted by the charging renew route).
export function signRenewToken({ pid, uid, plan, purpose }, ttlMs = TTL_MS) {
  const payload = { pid: String(pid), uid: String(uid), plan: String(plan), exp: Date.now() + ttlMs };
  if (purpose) payload.purpose = String(purpose);
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body)}`;
}

// Verify + parse. Returns { pid, uid, plan } on success, else null.
export function verifyRenewToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = hmac(body);
  // Constant-time compare (equal length required by timingSafeEqual).
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(fromB64url(body).toString('utf8')); } catch { return null; }
  if (!payload || !payload.pid || !payload.uid || !payload.plan) return null;
  if (!payload.exp || Date.now() > Number(payload.exp)) return null; // expired link
  return { pid: payload.pid, uid: payload.uid, plan: payload.plan, purpose: payload.purpose || null };
}
