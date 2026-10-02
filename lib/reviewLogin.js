// App-store review sign-in. Google Play / Apple reviewers can't create accounts or
// read our emails, so one fixed email accepts one fixed 6-digit code:
//   REVIEW_LOGIN_EMAIL=review@casa-libre.com.py   REVIEW_LOGIN_CODE=<6 digits>
// Used by /api/auth/code/send (no email is sent for it) and /api/auth/code/verify
// (the fixed code is accepted for it). Only that one email, only while both env
// vars are set — remove them to switch it off. Every other email is unaffected.
import crypto from 'node:crypto';

const norm = (e) => String(e || '').trim().toLowerCase();

export function reviewLogin(env = process.env) {
  const email = norm(env.REVIEW_LOGIN_EMAIL);
  const code = String(env.REVIEW_LOGIN_CODE || '').trim();
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
