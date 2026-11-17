import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NO_PHOTO_URL, NO_PHOTO_SQUARE_URL, NO_PHOTO_OG_URL, isNoPhoto, coverOrPlaceholder, absolutePlaceholder, withAbsolutePlaceholder } from '../lib/noPhoto.js';

test('the placeholder files exist in public/', () => {
  for (const u of [NO_PHOTO_URL, NO_PHOTO_SQUARE_URL, NO_PHOTO_OG_URL]) {
    assert.ok(fs.existsSync(new URL(`../public${u}`, import.meta.url)), u);
  }
});

test('a listing without a cover gets the placeholder; a real photo is kept', () => {
  assert.equal(coverOrPlaceholder(null), NO_PHOTO_URL);
  assert.equal(coverOrPlaceholder('https://cdn.example/a.webp'), 'https://cdn.example/a.webp');
  assert.equal(isNoPhoto(NO_PHOTO_URL), true);
  assert.equal(isNoPhoto(`https://casa-libre.com.py${NO_PHOTO_OG_URL}`), true);
  assert.equal(isNoPhoto('https://cdn.example/a.webp'), false);
});

test('the app gets an absolute placeholder URL; real photos are untouched', () => {
  assert.equal(absolutePlaceholder(NO_PHOTO_URL, 'https://casa-libre.com.py/'), `https://casa-libre.com.py${NO_PHOTO_URL}`);
  assert.equal(absolutePlaceholder('https://cdn.example/a.webp', 'https://casa-libre.com.py'), 'https://cdn.example/a.webp');
  const l = { id: 1, no_photo: true, image: NO_PHOTO_URL, images: [NO_PHOTO_URL] };
  assert.deepEqual(withAbsolutePlaceholder(l, 'http://localhost:3103'), { ...l, image: `http://localhost:3103${NO_PHOTO_URL}`, images: [`http://localhost:3103${NO_PHOTO_URL}`] });
  const real = { id: 2, no_photo: false, image: 'https://cdn.example/a.webp' };
  assert.equal(withAbsolutePlaceholder(real, 'http://x'), real);
});
