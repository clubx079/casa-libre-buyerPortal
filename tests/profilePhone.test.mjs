import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profilePhoneFromListing, saveListingPhoneToProfile } from '../lib/profilePhone.js';

test('a profile without a phone gets the listing phone (E.164)', () => {
  assert.equal(profilePhoneFromListing({ phone: null }, '0981 123 456', '595'), '+595981123456');
  assert.equal(profilePhoneFromListing({ phone: '' }, '+595 971 000 000', '595'), '+595971000000');
});

test('an existing number (typed or verified) is never replaced; junk is ignored', () => {
  assert.equal(profilePhoneFromListing({ phone: '+595981000001' }, '0981 123 456', '595'), null);
  assert.equal(profilePhoneFromListing({ phone: null }, '12', '595'), null);
  assert.equal(profilePhoneFromListing(null, '0981 123 456', '595'), null);
});

test('the write only touches a profile that still has no phone', async () => {
  const calls = [];
  const db = {
    select: async () => [{ id: 'u1', phone: null }],
    update: async (t, q, patch) => { calls.push([t, q, patch]); },
  };
  assert.equal(await saveListingPhoneToProfile(db, 'u1', '0981 123 456', '595'), true);
  assert.deepEqual(calls, [['users', 'id=eq.u1&phone=is.null', { phone: '+595981123456' }]]);
  const db2 = { select: async () => [{ id: 'u1', phone: '+595981000001' }], update: async () => { throw new Error('must not write'); } };
  assert.equal(await saveListingPhoneToProfile(db2, 'u1', '0981 123 456', '595'), false);
});
