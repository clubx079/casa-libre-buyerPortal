// The WhatsApp number on a listing must be one the seller has proven (a code sent to it).
// Before this, a typo in step 1 of the sell form went live and every buyer message and
// WhatsApp automation for that listing failed (Priscila, Oct 2026: wrong number typed).
//
//   • Already proven: the account's own verified WhatsApp (users.phone + phone_verified_at).
//   • Otherwise the form sends a code to the number (/api/account/listing-phone) and, once it
//     is checked, gets a PROOF: a signed token for (account, number), valid 24 h, that
//     /api/publish accepts. No database row — the token is the record.
// Only the web sell form asks for this (it sends wa_check=1); the mobile app publishes as
// before until it gets the same screen.
// Pure (secret passed in) — tests/listingPhone.test.mjs.
import crypto from 'crypto';
import { toE164 } from './whatsappPhone.js';

export const PROOF_TTL_MS = 24 * 3600 * 1000;
const sign = (secret, p) => crypto.createHmac('sha256', `listing-phone:${secret}`).update(p).digest('base64url');

// the number as E.164, or null
export const listingE164 = (phone, prefix) => toE164(phone, prefix);

// Is this number already the account's own proven WhatsApp?
export function isAccountPhone(user, e164) {
  return !!(user && e164 && user.phone_verified_at && String(user.phone) === String(e164));
}

export function makePhoneProof(secret, uid, e164, now = Date.now()) {
  const p = Buffer.from(JSON.stringify({ u: String(uid), p: e164, exp: now + PROOF_TTL_MS })).toString('base64url');
  return `${p}.${sign(secret, p)}`;
}

// true when the proof was made for this account and this number and hasn't expired
export function checkPhoneProof(secret, proof, uid, e164, now = Date.now()) {
  if (!proof || typeof proof !== 'string' || !proof.includes('.') || !e164) return false;
  const [p, sig] = proof.split('.');
  const good = sign(secret, p);
  if (!sig || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    return d.u === String(uid) && d.p === e164 && now <= d.exp;
  } catch { return false; }
}
