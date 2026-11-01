import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createdInApp } from '../lib/appInstall.js';

test('account created after the install → made in the app', () => {
  assert.equal(createdInApp('2026-11-01T10:05:00Z', '2026-11-01T10:00:00Z'), true);
  assert.equal(createdInApp('2026-11-01T09:55:00Z', '2026-11-01T10:00:00Z'), true);    // 5 min before: still the app
  assert.equal(createdInApp('2026-10-01T10:00:00Z', '2026-11-01T10:00:00Z'), false);   // website account from October
  assert.equal(createdInApp(null, '2026-11-01T10:00:00Z'), null);
  assert.equal(createdInApp('2026-11-01T10:00:00Z', null), null);
});
