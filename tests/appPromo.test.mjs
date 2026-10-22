import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoFor, isInAppBrowser, allowedPath, fromOurMessage } from '../lib/appPromo.js';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; SM-A146M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0';
const visit = (views, extra = {}) => ({ views, home: false, second: false, ...extra });

test('every device — but not inside in-app browsers', () => {
  for (const ua of [ANDROID, IPHONE, DESKTOP]) assert.equal(promoFor({ ua, path: '/', visit: visit(1) }), 'home', ua);
  assert.equal(isInAppBrowser(WEBVIEW), true);
  assert.equal(isInAppBrowser(INSTAGRAM), true);
  assert.equal(promoFor({ ua: WEBVIEW, path: '/', visit: visit(1) }), null);
});

test('the same pop-up on the home page and on the second page, once each per visit', () => {
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: visit(1) }), 'home');
  assert.equal(promoFor({ ua: ANDROID, path: '/propiedad/abc', visit: visit(2, { home: true }) }), 'second');
  assert.equal(promoFor({ ua: ANDROID, path: '/comprar', visit: visit(3, { home: true, second: true }) }), null);
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: visit(4, { home: true, second: true }) }), null);
  assert.equal(promoFor({ ua: ANDROID, path: '/propiedad/abc', visit: visit(1) }), null);
  assert.equal(promoFor({ ua: ANDROID, path: '/comprar', visit: visit(2) }), 'second');
});

test('never on flows, after Download, or when they came from our own message', () => {
  for (const p of ['/publicar', '/cuenta/publicaciones', '/descargar', '/eliminar-cuenta', '/r/rd']) assert.equal(allowedPath(p), false, p);
  assert.equal(allowedPath('/propiedades-en/asuncion'), true);
  assert.equal(promoFor({ ua: ANDROID, path: '/publicar', visit: visit(2) }), null);
  const now = Date.now();
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: visit(1), snoozedUntil: now + 1000, now }), null);
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: visit(1), snoozedUntil: now - 1000, now }), 'home');
  assert.equal(fromOurMessage('?utm_source=x&utm_medium=email&utm_campaign=y'), true);
  assert.equal(fromOurMessage('?utm_medium=cpc'), false);
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: visit(1), fromMessage: true }), null);
  assert.equal(promoFor({ ua: ANDROID, path: '/', visit: visit(1), standalone: true }), null);
});
