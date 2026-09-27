import { test } from 'node:test';
import assert from 'node:assert/strict';
import { to3857, exportUrl, paddedView } from '../utils/zoningOverlay.js';
import { codesFor } from '../lib/zoning/asuncionRules.js';

test('lat/lng → Web Mercator metres', () => {
  const [x0, y0] = to3857(0, 0);
  assert.ok(Math.abs(x0) < 1e-6 && Math.abs(y0) < 1e-6);
  const [x, y] = to3857(-25.28, -57.63);   // Asunción
  assert.ok(Math.abs(x + 6415342) < 5, String(x));
  assert.ok(Math.abs(y + 2910176) < 5, String(y));
});

test('export url covers the box, one category via layerDefs', () => {
  const u = new URL(exportUrl({ s: -25.3, w: -57.7, n: -25.2, e: -57.5 }, [800, 600], ['AR1A', 'AR1B']));
  assert.match(u.pathname, /PlanRegulador\/MapServer\/export$/);
  assert.equal(u.searchParams.get('layers'), 'show:4');
  assert.equal(u.searchParams.get('size'), '800,600');
  assert.equal(u.searchParams.get('transparent'), 'true');
  assert.equal(u.searchParams.get('layerDefs'), "4:zona_reg IN ('AR1A','AR1B')");
  const [xmin, ymin, xmax, ymax] = u.searchParams.get('bbox').split(',').map(Number);
  assert.ok(xmin < xmax && ymin < ymax);
  assert.equal(new URL(exportUrl({ s: 0, w: 0, n: 1, e: 1 }, [10, 10])).searchParams.get('layerDefs'), null);
});

test('padded view grows the box and never asks for more than 1400 px', () => {
  const { box, size } = paddedView({ s: -25.3, n: -25.2, w: -57.7, e: -57.5 }, [800, 600]);
  assert.ok(Math.abs(box.s - -25.35) < 1e-9 && Math.abs(box.n - -25.15) < 1e-9);
  assert.ok(Math.abs(box.w - -57.8) < 1e-9 && Math.abs(box.e - -57.4) < 1e-9);
  assert.deepEqual(size, [1400, 1050]);
  const big = paddedView({ s: 0, n: 1, w: 0, e: 1 }, [2000, 1000]).size;
  assert.equal(Math.max(...big), 1400);
  assert.equal(big[1], 700);   // aspect ratio kept
});

test('codesFor splits the rules by category', () => {
  assert.deepEqual(codesFor('baja'), ['AR1A', 'AR1B']);
  assert.ok(codesFor('alta').includes('AR3B') && codesFor('alta').includes('CENTRAL'));
  assert.ok(!codesFor('media').includes('AR1A'));
});
