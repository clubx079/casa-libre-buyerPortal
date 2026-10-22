import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoFor, isAndroidPhone, allowedPath, fromOurMessage } from '../lib/appPromo.js';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; SM-A146M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const fresh = (views) => ({ views, banner: false, full: false });

test('Android phones only — not iPhone, tablets, WebViews', () => {
  assert.equal(isAndroidPhone(ANDROID), true);
  assert.equal(isAndroidPhone(IPHONE), false);
  assert.equal(isAndroidPhone(TABLET), false);
  assert.equal(isAndroidPhone(WEBVIEW), false);
});

test('home page and landing page get the small card; later pages the full screen, once per visit', () => {
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: fresh(1) }), 'banner');
  assert.equal(promoFor({ ua: ANDROID, path: '/propiedad/abc', visit: fresh(1) }), 'banner');
  assert.equal(promoFor({ ua: ANDROID, path: '/propiedad/abc', visit: { views: 2, banner: true, full: false } }), 'full');
  assert.equal(promoFor({ ua: ANDROID, path: '/comprar', visit: { views: 3, banner: true, full: true } }), null);
  // back on the home page later in the visit: the small card, never the full one
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: { views: 4, banner: false, full: true } }), 'banner');
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: { views: 4, banner: true, full: true } }), null);
  assert.equal(promoFor({ ua: IPHONE, path: '/', visit: fresh(1) }), null);
});

test('never on flows, after Download, or when they came from our own message', () => {
  for (const p of ['/publicar', '/cuenta/publicaciones', '/descargar', '/eliminar-cuenta', '/r/rd']) assert.equal(allowedPath(p), false, p);
  assert.equal(allowedPath('/propiedades-en/asuncion'), true);
  assert.equal(promoFor({ ua: ANDROID, path: '/publicar', visit: fresh(2) }), null);
  const now = Date.now();
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: fresh(1), snoozedUntil: now + 1000, now }), null);
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: fresh(1), snoozedUntil: now - 1000, now }), 'banner');
  assert.equal(fromOurMessage('?utm_source=x&utm_medium=email&utm_campaign=y'), true);
  assert.equal(fromOurMessage('?utm_medium=cpc'), false);
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: fresh(1), fromMessage: true }), null);
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: fresh(1), standalone: true }), null);
});
