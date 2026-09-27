import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoningTileUrl, tileBbox3857, addZoningOverlay } from '../utils/zoningOverlay.js';

const R = 20037508.34;

test('tile bbox in Web Mercator', () => {
  const [xmin, ymin, xmax, ymax] = tileBbox3857(0, 0, 0);
  assert.ok(Math.abs(xmin + R) < 1 && Math.abs(ymax - R) < 1);
  assert.ok(Math.abs(xmax - R) < 1 && Math.abs(ymin + R) < 1);
  const [a, , c] = tileBbox3857(1, 0, 1);
  assert.ok(Math.abs(a) < 1 && Math.abs(c - R) < 1);
});

test('tile url asks the city for layer 4 as a transparent png', () => {
  const u = zoningTileUrl(4640, 9315, 14);
  assert.match(u, /PlanRegulador\/MapServer\/export\?/);
  assert.match(u, /layers=show%3A4/);
  assert.match(u, /transparent=true/);
  assert.match(u, /bboxSR=3857/);
});

test('overlay adds one layer, only tiles at city zoom, and removes cleanly', () => {
  const arr = [];
  let opts;
  const google = { maps: { ImageMapType: function (o) { opts = o; }, Size: function () {} } };
  const map = { overlayMapTypes: { push: (l) => arr.push(l), getArray: () => arr, removeAt: (i) => arr.splice(i, 1) } };
  const o = addZoningOverlay(google, map);
  assert.equal(arr.length, 1);
  assert.equal(opts.getTileUrl({ x: 1, y: 1 }, 8), null);
  assert.match(opts.getTileUrl({ x: 4640, y: 9315 }, 14), /export\?/);
  o.remove();
  assert.equal(arr.length, 0);
});
