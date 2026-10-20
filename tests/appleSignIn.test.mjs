import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyAppleIdToken, appleFullName, appleClientSecret, revokeAppleAuthorization, APPLE_ISSUER } from '../lib/appleSignIn.js';

// A local RSA key stands in for Apple's.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256' };
const getKeys = async () => [jwk];
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function token(claims = {}, header = {}, key = privateKey) {
  const h = enc({ alg: 'RS256', kid: 'test-kid', ...header });
  const now = Math.floor(Date.now() / 1000);
  const b = enc({ iss: APPLE_ISSUER, aud: 'com.airosofts.casalibre', sub: '001.abc', email: 'Ana@Example.com', email_verified: 'true', iat: now, exp: now + 600, nonce: sha('raw-nonce'), ...claims });
  return `${h}.${b}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${b}`), key).toString('base64url')}`;
}
const opts = { getKeys, audiences: ['com.airosofts.casalibre'], nonce: 'raw-nonce' };

test('a valid Apple token gives the email (lowercased) and subject', async () => {
  const r = await verifyAppleIdToken(token(), opts);
  assert.deepEqual(r, { sub: '001.abc', email: 'ana@example.com', emailVerified: true, isPrivateEmail: false });
});

test('a private relay email is flagged', async () => {
  const r = await verifyAppleIdToken(token({ email: 'x1@privaterelay.appleid.com', is_private_email: true }), opts);
  assert.equal(r.isPrivateEmail, true);
  assert.equal(r.email, 'x1@privaterelay.appleid.com');
});

test('forged, foreign, expired or replayed tokens are refused', async () => {
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const cases = [
    [token({}, {}, other), 'bad_signature'],
    [token({ iss: 'https://evil.example' }), 'bad_issuer'],
    [token({ aud: 'com.someone.else' }), 'bad_audience'],
    [token({ exp: Math.floor(Date.now() / 1000) - 3600 }), 'expired'],
    [token({ nonce: sha('other') }), 'bad_nonce'],
    [token({ email: '' }), 'no_email'],
    [token({}, { kid: 'nope' }), 'unknown_key'],
    [token({}, { alg: 'none' }), 'bad_alg'],
    ['abc', 'malformed'],
  ];
  for (const [t, reason] of cases) await assert.rejects(verifyAppleIdToken(t, opts), { message: reason });
});

test('the name Apple sends on the first sign-in', () => {
  assert.equal(appleFullName({ givenName: 'Ana', familyName: 'Pérez' }), 'Ana Pérez');
  assert.equal(appleFullName({ givenName: 'Ana', familyName: null }), 'Ana');
  assert.equal(appleFullName(null), '');
});

test('client secret is an ES256 JWT Apple can check with the .p8 key', () => {
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = ec.privateKey.export({ format: 'pem', type: 'pkcs8' });
  const s = appleClientSecret({ teamId: 'TEAM', keyId: 'KEY', privateKey: pem, clientId: 'com.airosofts.casalibre' });
  const [h, b, sig] = s.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'ES256', kid: 'KEY' });
  const body = JSON.parse(Buffer.from(b, 'base64url'));
  assert.equal(body.iss, 'TEAM'); assert.equal(body.sub, 'com.airosofts.casalibre'); assert.equal(body.aud, APPLE_ISSUER);
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${b}`), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
});

test('revoke is skipped without a code or without the Apple key', async () => {
  assert.equal((await revokeAppleAuthorization('', {})).skipped, 'no_code');
  assert.equal((await revokeAppleAuthorization('c1', {})).skipped, 'not_configured');
});
