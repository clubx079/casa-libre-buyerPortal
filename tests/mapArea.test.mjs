import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArea, areaParts, roundArea } from '../lib/mapArea.js';

test('map edges are rounded to ~100 m so the search cache still works', () => {
  assert.deepEqual(roundArea({ n: -25.2612345, s: -25.3398765, e: -57.5501234, w: -57.6698765 }), { n: -25.261, s: -25.34, e: -57.55, w: -57.67 });
});

test('a valid area is accepted (strings from JSON too)', () => {
  assert.deepEqual(parseArea({ n: '-25.26', s: -25.34, e: -57.55, w: -57.67 }), { n: -25.26, s: -25.34, e: -57.55, w: -57.67 });
});

test('missing, broken or inverted areas are ignored (no area filter)', () => {
  assert.equal(parseArea({}), null);
  assert.equal(parseArea({ n: -25.26, s: -25.34, e: -57.55 }), null);
  assert.equal(parseArea({ n: 'x', s: -25.34, e: -57.55, w: -57.67 }), null);
  assert.equal(parseArea({ n: -25.40, s: -25.34, e: -57.55, w: -57.67 }), null, 'north below south');
  assert.equal(parseArea({ n: -25.26, s: -25.34, e: -57.70, w: -57.67 }), null, 'east left of west');
  assert.equal(parseArea({ n: 95, s: -25.34, e: -57.55, w: -57.67 }), null, 'off the globe');
});

test('database filter: inside the box and with coordinates', () => {
  assert.deepEqual(areaParts({ n: -25.26, s: -25.34, e: -57.55, w: -57.67 }), [
    'latitude=gte.-25.34', 'latitude=lte.-25.26', 'longitude=gte.-57.67', 'longitude=lte.-57.55',
  ]);
  assert.deepEqual(areaParts(null), []);
});
