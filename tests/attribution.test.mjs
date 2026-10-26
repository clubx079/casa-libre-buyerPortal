import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstTouch, attributionFromCookie, isNewAccount } from '../lib/attribution.js';

const NOW = new Date('2026-10-26T12:00:00Z');

test('first touch: UTM tags win', () => {
  const ft = firstTouch('https://casa-libre.com.py/alquiler?utm_source=email&utm_medium=automation&utm_campaign=draft_reminders', '', 'casa-libre.com.py', NOW);
  assert.deepEqual(ft, { source: 'email', medium: 'automation', campaign: 'draft_reminders', content: null, ads_click: false, referrer: null, landing: '/alquiler', at: NOW.toISOString() });
});

test('first touch: a Google Ads click (gclid) without UTM → google / cpc', () => {
  const ft = firstTouch('https://casa-libre.com.py/?gclid=abc', 'https://www.google.com/', 'casa-libre.com.py', NOW);
  assert.equal(ft.source, 'google'); assert.equal(ft.medium, 'cpc'); assert.equal(ft.ads_click, true); assert.equal(ft.referrer, 'google.com');
});

test('first touch: a referring site, or direct; our own pages are not a referrer', () => {
  assert.equal(firstTouch('https://casa-libre.com.py/', 'https://l.facebook.com/x', 'casa-libre.com.py', NOW).source, 'l.facebook.com');
  const own = firstTouch('https://casa-libre.com.py/propiedad/x', 'https://casa-libre.com.py/', 'casa-libre.com.py', NOW);
  assert.equal(own.source, 'direct'); assert.equal(own.medium, 'none');
  assert.equal(firstTouch('not a url'), null);
});

test('cookie round trip and new-account check', () => {
  const ft = firstTouch('https://casa-libre.com.py/?utm_source=reddit', '', '', NOW);
  assert.deepEqual(attributionFromCookie(encodeURIComponent(JSON.stringify(ft))), ft);
  assert.equal(attributionFromCookie('garbage'), null);
  assert.equal(attributionFromCookie(''), null);
  assert.equal(isNewAccount({ created_at: '2026-10-26T11:45:00Z' }, NOW.getTime()), true);
  assert.equal(isNewAccount({ created_at: '2026-10-26T11:00:00Z' }, NOW.getTime()), false);
  assert.equal(isNewAccount({}, NOW.getTime()), false);
});
