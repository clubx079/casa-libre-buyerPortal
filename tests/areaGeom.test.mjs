import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropOutliers, boundsOf, searchBounds, convexHull, areaRing, placeArea, barrioLabels, crowdCenter } from '../lib/areaGeom.js';

// Ciudad del Este listings + one geocoded into the Chaco (the real feed has it).
const CDE = [[-25.509, -54.611], [-25.515, -54.62], [-25.52, -54.63], [-25.5, -54.6], [-25.53, -54.64], [-25.49, -54.62]];
const CHACO = [-22.46266, -61.1650586];

test('a far outlier is dropped, so the box stays on the city', () => {
  const keep = dropOutliers([...CDE, CHACO]);
  assert.equal(keep.length, CDE.length);
  const b = searchBounds([...CDE, CHACO], 'city');
  assert.ok(b.w > -55 && b.n < -25.4, JSON.stringify(b));
});

test('free-text results in several cities keep every city; only a lone far pin goes', () => {
  const ENC = [[-27.33, -55.87], [-27.34, -55.86], [-27.335, -55.865]];
  const ASU = [[-25.29, -57.6], [-25.3, -57.59], [-25.28, -57.58], [-25.295, -57.61], [-25.285, -57.6], [-25.29, -57.57]];
  const keep = dropOutliers([...ASU, ...ENC, CHACO], { isolatedOnly: true });
  assert.equal(keep.length, ASU.length + ENC.length);
  const b = searchBounds([...ASU, ...ENC, CHACO]);
  assert.ok(b.s < -27.3 && b.w > -58, JSON.stringify(b));
});

test('null island, NaN and out-of-range points are ignored', () => {
  assert.deepEqual(dropOutliers([[0, 0], [NaN, 1], [95, 0], [-25.3, -57.6]]), [[-25.3, -57.6]]);
});

test('listings all on one spot (a building) give a box of a few blocks, not a max zoom-in', () => {
  const same = Array.from({ length: 40 }, () => [-25.288, -57.5421]);
  const b = searchBounds(same, 'barrio');
  const kmNS = (b.n - b.s) * 110.57;
  assert.ok(kmNS >= 1.39 && kmNS < 1.5, String(kmNS));
  assert.ok(Math.abs((b.n + b.s) / 2 + 25.288) < 1e-9);
  const one = searchBounds([[-25.3, -57.6]]);
  assert.ok((one.n - one.s) * 110.57 >= 1.99);
});

test('boundsOf without a minimum is the plain box', () => {
  assert.deepEqual(boundsOf([[-25, -57], [-26, -58]]), { n: -25, s: -26, e: -57, w: -58 });
  assert.equal(boundsOf([]), null);
});

test('convex hull drops inner points', () => {
  const h = convexHull([[0, 0], [2, 0], [2, 2], [0, 2], [1, 1], [1, 0.5]]);
  assert.equal(h.length, 4);
  assert.ok(!h.some((p) => p[0] === 1 && p[1] === 1));
});

test('areaRing: a closed ring around every kept listing; a circle for one spot', () => {
  const ring = areaRing(CDE, 'city');
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  for (const [lat, lng] of CDE) assert.ok(lng >= Math.min(...xs) && lng <= Math.max(...xs) && lat >= Math.min(...ys) && lat <= Math.max(...ys));
  const dot = areaRing([[-25.288, -57.5421], [-25.288, -57.5421]], 'barrio');
  assert.equal(dot.length, 33);
});

test('placeArea: outline, label at its top, bounds; barrio labels at the crowd middle', () => {
  const place = { id: 'b:x', name: 'Las Mercedes', kind: 'barrio', pts: [[-25.287, -57.612], [-25.289, -57.61], [-25.286, -57.611], [-25.288, -57.613], CHACO] };
  const a = placeArea(place);
  assert.equal(a.name, 'Las Mercedes');
  assert.ok(a.bounds.w > -57.7, 'Chaco point not in the box');
  assert.equal(a.label[1], Math.max(...a.ring.map((p) => p[1])));
  assert.equal(placeArea({ id: 'x', kind: 'city', pts: [] }), null);
  const labels = barrioLabels([place, { ...place, id: 'b:y', pts: place.pts.slice(0, 2) }]);
  assert.equal(labels.length, 1);
  assert.ok(Math.abs(labels[0].lat - crowdCenter(place.pts.slice(0, 4))[0]) < 1e-4);   // the Chaco pin left out
});
