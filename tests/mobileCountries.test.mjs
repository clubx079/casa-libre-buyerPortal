import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_COUNTRIES } from '../lib/mobileCountries.js';

// The app skips any entry that fails these checks (app: lib/countryPick.js), so a
// typo here would silently drop a country from the app.
const REQUIRED = ['name', 'origin', 'currencyCode', 'moneyPrefix', 'moneyLocale', 'usdRate', 'mapCenter', 'mapZoom', 'singleZoom', 'phonePrefix'];

test('every country is complete and valid for the app', () => {
  const codes = new Set();
  for (const c of MOBILE_COUNTRIES) {
    assert.match(c.code, /^[a-z]{2}$/);
    assert.ok(!codes.has(c.code), `duplicate ${c.code}`);
    codes.add(c.code);
    for (const k of REQUIRED) assert.ok(c[k] !== undefined, `${c.code} missing ${k}`);
    assert.match(c.origin, /^https:\/\/[a-z0-9.-]+$/i);
    assert.match(c.currencyCode, /^[A-Z]{3}$/);
    assert.match(c.moneyLocale, /^[a-z]{2}(-[A-Z]{2})?$/);
    assert.match(c.phonePrefix, /^\d{1,4}$/);
    assert.ok(c.usdRate > 0);
    assert.ok(Math.abs(c.mapCenter.latitude) <= 90 && Math.abs(c.mapCenter.longitude) <= 180);
    assert.ok(['live', 'soon', 'hidden'].includes(c.status));
    for (const r of c.regions || []) assert.match(r, /^[A-Z]{2}$/);
  }
});

test('Paraguay is present and live (the app falls back to it)', () => {
  const py = MOBILE_COUNTRIES.find((c) => c.code === 'py');
  assert.equal(py.status, 'live');
  assert.equal(py.origin, 'https://casa-libre.com.py');
});
