// Sign in with Apple (iOS app). The app gets an identity token (a JWT signed by Apple)
// from the native sheet and posts it to /api/auth/apple; we check it here against
// Apple's public keys. Apple puts the email in every token — the real one or a
// private relay address (…@privaterelay.appleid.com) — so, like Google, the email is
// the identity key and no extra column is needed.
//
// Account deletion (App Review 5.1.1(v)): the app asks Apple for a fresh
// authorization code and /api/account/delete revokes it here. That needs the
// "Sign in with Apple" key from developer.apple.com (APPLE_TEAM_ID, APPLE_KEY_ID,
// APPLE_PRIVATE_KEY = the .p8 text); without it the revoke is skipped.
// Pure Node crypto (no jwt library), so it is unit-tested with a local key.
import crypto from 'crypto';

export const APPLE_ISSUER = 'https://appleid.apple.com';
const KEYS_URL = 'https://appleid.apple.com/auth/keys';

// The iOS bundle id(s) a token may be issued for.
export function appleAudiences(env = process.env) {
  return String(env.APPLE_BUNDLE_IDS || 'com.airosofts.casalibre').split(',').map((s) => s.trim()).filter(Boolean);
}

const b64json = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

let keyCache = { at: 0, keys: [] };
async function appleKeys(force = false) {
  if (!force && keyCache.keys.length && Date.now() - keyCache.at < 6 * 3600e3) return keyCache.keys;
  const r = await fetch(KEYS_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error(`apple_keys_${r.status}`);
  const { keys } = await r.json();
  keyCache = { at: Date.now(), keys: Array.isArray(keys) ? keys : [] };
  return keyCache.keys;
}

// → { sub, email, emailVerified, isPrivateEmail } or throws Error(<reason>).
// nonce: the raw nonce the app made; Apple holds its SHA-256 (the app passes the hash).
export async function verifyAppleIdToken(idToken, { audiences = appleAudiences(), nonce, now = Date.now(), getKeys = appleKeys } = {}) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('malformed');
  let header, claims;
  try { header = b64json(parts[0]); claims = b64json(parts[1]); } catch { throw new Error('malformed'); }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('bad_alg');

  let jwk = (await getKeys()).find((k) => k.kid === header.kid);
  if (!jwk && getKeys === appleKeys) jwk = (await appleKeys(true)).find((k) => k.kid === header.kid); // Apple rotated
  if (!jwk) throw new Error('unknown_key');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('bad_signature');

  if (claims.iss !== APPLE_ISSUER) throw new Error('bad_issuer');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.some((a) => audiences.includes(a))) throw new Error('bad_audience');
  if (!claims.exp || claims.exp * 1000 < now - 60e3) throw new Error('expired');
  if (nonce != null) {
    const want = crypto.createHash('sha256').update(String(nonce)).digest('hex');
    if (claims.nonce !== want) throw new Error('bad_nonce');
  }
  if (!claims.sub) throw new Error('no_subject');
  const email = String(claims.email || '').trim().toLowerCase();
  if (!email) throw new Error('no_email');
  // Apple sends these as booleans or as the strings "true"/"false".
  const yes = (v) => v === true || v === 'true';
  return { sub: claims.sub, email, emailVerified: yes(claims.email_verified), isPrivateEmail: yes(claims.is_private_email) };
}

// The name Apple gives only on the very first sign-in (from the app).
export function appleFullName(n) {
  if (!n) return '';
  if (typeof n === 'string') return n.trim().slice(0, 120);
  return [n.givenName, n.familyName].filter(Boolean).join(' ').trim().slice(0, 120);
}

// ---- token revocation (account deletion) ----
export function appleRevokeConfigured(env = process.env) {
  return !!(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
}

// The client_secret Apple's REST API wants: an ES256 JWT signed with the .p8 key.
export function appleClientSecret({ teamId, keyId, privateKey, clientId, now = Date.now() }) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(now / 1000);
  const head = enc({ alg: 'ES256', kid: keyId });
  const body = enc({ iss: teamId, iat, exp: iat + 300, aud: APPLE_ISSUER, sub: clientId });
  const pem = String(privateKey).replace(/\\n/g, '\n');
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: pem, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${sig.toString('base64url')}`;
}

// Exchange the app's fresh authorization code for a refresh token and revoke it, so
// the app no longer appears under the person's Apple ID. → { ok, skipped?, error? }
export async function revokeAppleAuthorization(code, env = process.env) {
  if (!code) return { ok: false, skipped: 'no_code' };
  if (!appleRevokeConfigured(env)) return { ok: false, skipped: 'not_configured' };
  const clientId = appleAudiences(env)[0];
  const client_secret = appleClientSecret({ teamId: env.APPLE_TEAM_ID, keyId: env.APPLE_KEY_ID, privateKey: env.APPLE_PRIVATE_KEY, clientId });
  const form = (o) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
  const t = await fetch(`${APPLE_ISSUER}/auth/token`, form({ client_id: clientId, client_secret, code: String(code), grant_type: 'authorization_code' }));
  if (!t.ok) return { ok: false, error: `token_${t.status}` };
  const tokens = await t.json();
  const token = tokens.refresh_token || tokens.access_token;
  const r = await fetch(`${APPLE_ISSUER}/auth/revoke`, form({ client_id: clientId, client_secret, token, token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token' }));
  return r.ok ? { ok: true } : { ok: false, error: `revoke_${r.status}` };
}
