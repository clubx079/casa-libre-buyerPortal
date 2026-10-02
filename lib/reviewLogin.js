// App-store review sign-in. Google Play / Apple reviewers can't create accounts or
// read our emails, so one fixed email accepts one fixed 6-digit code. Set in code
// (the same values are in the Play Console "Sign in details" declaration):
//   review@casa-libre.com.py  /  395171
// It's an ordinary user account — no special rights — so the code being in this
// repo only lets someone do what any sign-up can do.
// Env can override: REVIEW_LOGIN_EMAIL / REVIEW_LOGIN_CODE, or REVIEW_LOGIN=off to
// switch it off. Used by /api/auth/code/send (no email is sent for it) and
// /api/auth/code/verify (the fixed code is accepted for it). Every other email is
// unaffected.
import crypto from 'node:crypto';

export const REVIEW_EMAIL = 'review@casa-libre.com.py';
export const REVIEW_CODE = '395171';

const norm = (e) => String(e || '').trim().toLowerCase();

export function reviewLogin(env = process.env) {
  if (String(env.REVIEW_LOGIN || '').toLowerCase() === 'off') return null;
  const email = norm(env.REVIEW_LOGIN_EMAIL || REVIEW_EMAIL);
  const code = String(env.REVIEW_LOGIN_CODE || REVIEW_CODE).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) return null;
  return { email, code };
}

export function isReviewEmail(email, env = process.env) {
  const r = reviewLogin(env);
  return !!r && norm(email) === r.email;
}

export function reviewCodeMatches(email, code, env = process.env) {
  const r = reviewLogin(env);
  if (!r || norm(email) !== r.email) return false;
  const a = Buffer.from(String(code || '').trim());
  const b = Buffer.from(r.code);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
