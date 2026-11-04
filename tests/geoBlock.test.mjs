import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockedCountries, isBlocked, isOpenPath, AFRICA, BLOCK_HTML } from '../lib/geoBlock.js';

test('GEO_BLOCK: unset = Africa, off = nothing, a list mixes codes and "africa"', () => {
  const def = blockedCountries(undefined);
  for (const c of ['NG', 'UG', 'AO', 'CF', 'ZA', 'EG']) assert.equal(def.has(c), true, c);
  assert.equal(def.has('PY'), false);
  assert.equal(def.has('BR'), false);
  assert.equal(def.size, AFRICA.length);
  assert.equal(blockedCountries('off').size, 0);
  assert.equal(blockedCountries('').size, 0);
  assert.deepEqual([...blockedCountries('bd, cn')], ['BD', 'CN']);
  const mix = blockedCountries('africa,BD');
  assert.equal(mix.has('BD') && mix.has('NG'), true);
});

test('blocked visitors, but never webhooks, crons or unknown countries', () => {
  const blocked = blockedCountries(undefined);
  assert.equal(isBlocked({ country: 'NG', pathname: '/', blocked }), true);
  assert.equal(isBlocked({ country: 'ng', pathname: '/api/listings/search', blocked }), true);
  assert.equal(isBlocked({ country: 'PY', pathname: '/', blocked }), false);
  assert.equal(isBlocked({ country: 'NG', pathname: '/api/relay/webhook', blocked }), false);
  assert.equal(isBlocked({ country: 'NG', pathname: '/api/cron/automations', blocked }), false);
  assert.equal(isBlocked({ country: 'XX', pathname: '/', blocked }), false);
  assert.equal(isBlocked({ country: '', pathname: '/', blocked }), false);
  assert.equal(isOpenPath('/robots.txt'), true);
});

test('the block page: Spanish, Casa-Libre, no index, no emojis', () => {
  assert.match(BLOCK_HTML, /Casa-Libre no está disponible en tu región/);
  assert.match(BLOCK_HTML, /noindex/);
  assert.equal(/\p{Extended_Pictographic}/u.test(BLOCK_HTML), false);
});
