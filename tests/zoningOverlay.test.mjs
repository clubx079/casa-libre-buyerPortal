import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoningTileUrl, tileBbox3857, addZoningOverlay, ZONE_COLORS } from '../utils/zoningOverlay.js';
import { codesFor } from '../lib/zoning/asuncionRules.js';

const R = 20037508.34;

test('tile bbox in Web Mercator', () => {
  const [xmin, ymin, xmax, ymax] = tileBbox3857(0, 0, 0);
  assert.ok(Math.abs(xmin + R) < 1 && Math.abs(ymax - R) < 1);
  assert.ok(Math.abs(xmax - R) < 1 && Math.abs(ymin + R) < 1);
  const [a, , c] = tileBbox3857(1, 0, 1);
  assert.ok(Math.abs(a) < 1 && Math.abs(c - R) < 1);
});

test('tile url asks the city for layer 4, filtered to one category', () => {
  const u = zoningTileUrl(4640, 9315, 14, ['AR1A', 'AR1B']);
  assert.match(u, /PlanRegulador\/MapServer\/export\?/);
  assert.match(u, /layers=show%3A4/);
  assert.match(u, /transparent=true/);
  assert.equal(new URL(u).searchParams.get('layerDefs'), "4:zona_reg IN ('AR1A','AR1B')");
  assert.equal(new URL(zoningTileUrl(1, 1, 12)).searchParams.get('layerDefs'), null);
});

test('codesFor splits the rules by category', () => {
  assert.deepEqual(codesFor('baja'), ['AR1A', 'AR1B']);
  assert.ok(codesFor('alta').includes('AR3B') && codesFor('alta').includes('CENTRAL'));
  assert.ok(!codesFor('media').includes('AR1A'));
});

// Minimal DOM stand-in for getTile().
const doc = { createElement: () => { const el = { style: {}, children: [], appendChild(c) { el.children.push(c); } }; return el; } };

function setup(opts) {
  const arr = [];
  const google = { maps: { Size: function () {} } };
  const map = { overlayMapTypes: { push: (l) => arr.push(l), getArray: () => arr, removeAt: (i) => arr.splice(i, 1) } };
  const handle = addZoningOverlay(google, map, opts);
  return { arr, handle };
}

test('overlay paints one colour block per category, masked by the city tile', () => {
  const { arr, handle } = setup();
  assert.equal(arr.length, 1);
  const tile = arr[0].getTile({ x: 4640, y: 9315 }, 14, doc);
  assert.equal(tile.children.length, 3);
  assert.match(tile.children[0].style.cssText, new RegExp(ZONE_COLORS.baja));
  assert.match(tile.children[0].style.maskImage, /layerDefs=/);
  assert.equal(arr[0].getTile({ x: 1, y: 1 }, 8, doc).children.length, 0);   // no tiles below city zoom
  handle.remove();
  assert.equal(arr.length, 0);
});

test('only the filtered category is painted when one is picked', () => {
  const { arr } = setup({ categories: ['alta'] });
  const tile = arr[0].getTile({ x: 4640, y: 9315 }, 14, doc);
  assert.equal(tile.children.length, 1);
  assert.match(tile.children[0].style.cssText, new RegExp(ZONE_COLORS.alta));
});
