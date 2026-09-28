import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceTile, tileSetFor, ZONING_TILES } from '../utils/zoningOverlay.js';
import { codesFor } from '../lib/zoning/asuncionRules.js';

test('at or below the pre-rendered max zoom a map tile is its own source tile', () => {
  assert.deepEqual(sourceTile(44572, 75060, 17, 17), { z: 17, x: 44572, y: 75060, d: 0, scale: 1, ox: 0, oy: 0, key: '17/44572/75060' });
  assert.equal(sourceTile(695, 1172, 11, 17).key, '11/695/1172');
});

test('beyond max zoom it reuses the ancestor tile, cropped to the right quarter', () => {
  // z18 (89145, 150121) sits in z17 (44572, 75060), right half, bottom half
  const t = sourceTile(89145, 150121, 18, 17);
  assert.equal(t.key, '17/44572/75060');
  assert.deepEqual([t.d, t.scale, t.ox, t.oy], [1, 2, 256, 256]);
  const t2 = sourceTile(178288, 300240, 19, 17);   // two levels deeper → 4×4 grid
  assert.equal(t2.key, '17/44572/75060');
  assert.deepEqual([t2.scale, t2.ox, t2.oy], [4, 0, 0]);
});

test('tile set follows the height filter', () => {
  assert.equal(tileSetFor(['baja', 'media', 'alta']), 'all');
  assert.equal(tileSetFor(['alta']), 'alta');
  assert.equal(tileSetFor(['nonsense']), 'all');
  assert.equal(tileSetFor(undefined), 'all');
});

test('tiles are served same-origin by our media proxy', () => {
  assert.equal(ZONING_TILES, '/api/media/zoning/asuncion/v1');
});

test('codesFor splits the rules by category', () => {
  assert.deepEqual(codesFor('baja'), ['AR1A', 'AR1B']);
  assert.ok(codesFor('alta').includes('AR3B') && codesFor('alta').includes('CENTRAL'));
});
