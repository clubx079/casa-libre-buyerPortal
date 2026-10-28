import test from 'node:test';
import assert from 'node:assert/strict';
import { listingE164, isAccountPhone, makePhoneProof, checkPhoneProof, PROOF_TTL_MS } from '../lib/listingPhone.js';

const S = 'secret';

test('numbers are compared as E.164, however they were typed', () => {
  assert.equal(listingE164('0981 123 456', '595'), '+595981123456');
  assert.equal(listingE164('+595 981 123-456', '595'), '+595981123456');
  assert.equal(listingE164('12', '595'), null);
});

test('the account’s own verified WhatsApp needs no code', () => {
  const user = { phone: '+595981123456', phone_verified_at: '2026-10-01' };
  assert.equal(isAccountPhone(user, '+595981123456'), true);
  assert.equal(isAccountPhone(user, '+595981999999'), false);                    // another number
  assert.equal(isAccountPhone({ phone: '+595981123456' }, '+595981123456'), false);   // typed, never verified
  assert.equal(isAccountPhone(null, '+595981123456'), false);
});

test('a proof only works for its account and number, and expires after 24 h', () => {
  const now = Date.UTC(2026, 9, 28);
  const proof = makePhoneProof(S, 'u1', '+595981123456', now);
  assert.equal(checkPhoneProof(S, proof, 'u1', '+595981123456', now + 1000), true);
  assert.equal(checkPhoneProof(S, proof, 'u2', '+595981123456', now), false);    // another account
  assert.equal(checkPhoneProof(S, proof, 'u1', '+595981999999', now), false);    // another number
  assert.equal(checkPhoneProof(S, proof, 'u1', '+595981123456', now + PROOF_TTL_MS + 1), false);
  assert.equal(checkPhoneProof('other', proof, 'u1', '+595981123456', now), false);   // other secret
  const [p, s] = proof.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'u1', p: '+595981999999', exp: now + 1e9 })).toString('base64url');
  assert.equal(checkPhoneProof(S, `${forged}.${s}`, 'u1', '+595981999999', now), false);   // edited payload
  assert.equal(checkPhoneProof(S, `${p}.x`, 'u1', '+595981123456', now), false);
  assert.equal(checkPhoneProof(S, '', 'u1', '+595981123456', now), false);
});
