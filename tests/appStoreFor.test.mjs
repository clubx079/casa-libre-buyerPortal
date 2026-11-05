import test from 'node:test';
import assert from 'node:assert/strict';
import { storeForUserAgent } from '../lib/appStoreFor.js';
import { APP_STORE_URL, PLAY_STORE_URL } from '../lib/appLinks.js';

test('the App Store link is the live iPhone app', () => {
  assert.equal(APP_STORE_URL, 'https://apps.apple.com/us/app/casa-libre/id6822493219');
});
test('/descargar: a phone goes to its own store, a computer sees the page', () => {
  assert.equal(storeForUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'), APP_STORE_URL);
  assert.equal(storeForUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), APP_STORE_URL);
  assert.equal(storeForUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'), PLAY_STORE_URL);
  assert.equal(storeForUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130'), null);
  assert.equal(storeForUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), null);
  assert.equal(storeForUserAgent(''), null);
});
