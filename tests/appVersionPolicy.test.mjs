import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appVersionPolicy, testerEmails } from '../lib/appVersionPolicy.js';

test('defaults never wall anyone', () => {
  const p = appVersionPolicy({ platform: 'android', env: {} });
  assert.equal(p.minVersion, '1.0.0');
  assert.equal(p.latestVersion, '1.0.1');
  assert.match(p.storeUrl, /play\.google\.com.*py\.casalibre\.mobile/);
  assert.match(appVersionPolicy({ platform: 'ios', env: {} }).storeUrl, /apps\.apple\.com/);
});

test('per-platform env wins over generic', () => {
  const env = { MOBILE_MIN_VERSION: '1.1.0', MOBILE_MIN_VERSION_ANDROID: '1.2.0', MOBILE_LATEST_VERSION: '1.3.0' };
  assert.equal(appVersionPolicy({ platform: 'android', env }).minVersion, '1.2.0');
  assert.equal(appVersionPolicy({ platform: 'ios', env }).minVersion, '1.1.0');
  assert.equal(appVersionPolicy({ platform: 'ios', env }).latestVersion, '1.3.0');
});

test('test mode: only listed testers get the TEST_ values', () => {
  const env = { MOBILE_MIN_VERSION: '1.0.0', MOBILE_TEST_EMAILS: ' Omar@Airosofts.com , qa@x.com', MOBILE_TEST_MIN_VERSION_ANDROID: '9.9.9' };
  assert.deepEqual(testerEmails(env), ['omar@airosofts.com', 'qa@x.com']);
  const tester = appVersionPolicy({ platform: 'android', email: 'omar@airosofts.com', env });
  assert.equal(tester.minVersion, '9.9.9');
  assert.equal(tester.test, true);
  const other = appVersionPolicy({ platform: 'android', email: 'someone@else.com', env });
  assert.equal(other.minVersion, '1.0.0');
  assert.equal(other.test, undefined);
  const anon = appVersionPolicy({ platform: 'android', email: null, env });
  assert.equal(anon.minVersion, '1.0.0');
  // iOS has no TEST_ value set → tester unaffected on iOS
  assert.equal(appVersionPolicy({ platform: 'ios', email: 'omar@airosofts.com', env }).minVersion, '1.0.0');
});

test('test mode prompt-only (latest) without the wall', () => {
  const env = { MOBILE_TEST_EMAILS: 'omar@airosofts.com', MOBILE_TEST_LATEST_VERSION: '9.9.9' };
  const p = appVersionPolicy({ platform: 'android', email: 'omar@airosofts.com', env });
  assert.equal(p.minVersion, '1.0.0');
  assert.equal(p.latestVersion, '9.9.9');
});

test('admin settings: no row / disabled row / junk → exactly the env values', () => {
  const env = { MOBILE_MIN_VERSION_ANDROID: '1.2.0', MOBILE_LATEST_VERSION: '1.3.0' };
  const base = appVersionPolicy({ platform: 'android', env });
  for (const settings of [null, { enabled: false, free_tiers: [{ android: { min: '9.9.9' } }] }, { enabled: true, free_tiers: null }, { enabled: true, free_tiers: [{ android: { min: 'abc', latest: '' } }] }]) {
    const p = appVersionPolicy({ platform: 'android', env, settings });
    assert.equal(p.minVersion, base.minVersion);
    assert.equal(p.latestVersion, base.latestVersion);
    assert.equal(p.source, 'env');
  }
});

test('admin settings: filled values win per platform, empty ones keep env', () => {
  const env = { MOBILE_MIN_VERSION: '1.1.0', MOBILE_LATEST_VERSION: '1.3.0' };
  const settings = { enabled: true, free_tiers: [{ android: { min: '1.3.0', latest: '1.4.0' }, ios: { latest: '1.4.0', storeUrl: 'https://apps.apple.com/app/id1' } }] };
  const a = appVersionPolicy({ platform: 'android', env, settings });
  assert.deepEqual([a.minVersion, a.latestVersion, a.source], ['1.3.0', '1.4.0', 'admin']);
  const i = appVersionPolicy({ platform: 'ios', env, settings });
  assert.deepEqual([i.minVersion, i.latestVersion, i.storeUrl], ['1.1.0', '1.4.0', 'https://apps.apple.com/app/id1']);
});

test('admin settings: tester list + test versions', () => {
  const settings = { enabled: true, free_tiers: [{ testEmails: ['QA@x.com'], test: { android: { min: '9.9.9' } } }] };
  assert.equal(appVersionPolicy({ platform: 'android', email: 'qa@x.com', env: {}, settings }).minVersion, '9.9.9');
  assert.equal(appVersionPolicy({ platform: 'android', email: 'other@x.com', env: {}, settings }).minVersion, '1.0.0');
});
