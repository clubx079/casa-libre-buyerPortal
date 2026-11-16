import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileCompletion } from '../lib/profileCompletion.js';

test('empty profile: 0 of 7, red, everything missing', () => {
  const c = profileCompletion({});
  assert.equal(c.count, 0); assert.equal(c.total, 7); assert.equal(c.pct, 0); assert.equal(c.tone, 'red');
  assert.equal(c.missing.length, 7);
});

test('name only: 2 of 7 is still red; 3 turns yellow', () => {
  assert.equal(profileCompletion({ first_name: 'Ana', last_name: 'López' }).tone, 'red');
  const c = profileCompletion({ first_name: 'Ana', last_name: 'López', phone_verified: true });
  assert.equal(c.count, 3); assert.equal(c.tone, 'yellow'); assert.equal(c.pct, 43);
});

test('6 or 7 items is green; blanks do not count; photo only when approved or present', () => {
  const full = { first_name: 'Ana', last_name: 'López', job_title: 'Agente', company_name: 'X', company_website: 'x.com.py', phone_verified: true };
  assert.equal(profileCompletion(full).tone, 'green');
  assert.equal(profileCompletion(full).missing.join(), 'photo');
  assert.equal(profileCompletion(full, { photoStatus: 'checking' }).count, 6);
  assert.equal(profileCompletion(full, { photoStatus: 'approved' }).pct, 100);
  assert.equal(profileCompletion({ ...full, job_title: '   ' }, { hasPhoto: true }).count, 6);
});
