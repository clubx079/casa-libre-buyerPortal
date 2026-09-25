import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderHomeFeatured } from '../lib/homeOrder.js';

const L = (id) => ({ id });

test('paid home listings come first; free ones only fill the remaining slots', () => {
  const onHome = [L('f1'), L('p1'), L('f2'), L('p2')];
  const out = orderHomeFeatured(onHome, new Set(['f1', 'f2']), { slots: 3, seed: 0 }).map((x) => x.id);
  assert.deepEqual(out, ['p1', 'p2', 'f1']);
});

test('six paid listings leave no room for free ones', () => {
  const paid = Array.from({ length: 6 }, (_, i) => L(`p${i}`));
  const out = orderHomeFeatured([L('f1'), ...paid], new Set(['f1']), { slots: 6, seed: 0 }).map((x) => x.id);
  assert.ok(!out.includes('f1'));
  assert.equal(out.length, 6);
});

test('free listings rotate with the seed', () => {
  const onHome = [L('f1'), L('f2'), L('f3')];
  const free = new Set(['f1', 'f2', 'f3']);
  assert.deepEqual(orderHomeFeatured(onHome, free, { slots: 2, seed: 0 }).map((x) => x.id), ['f1', 'f2']);
  assert.deepEqual(orderHomeFeatured(onHome, free, { slots: 2, seed: 1 }).map((x) => x.id), ['f2', 'f3']);
  assert.deepEqual(orderHomeFeatured(onHome, free, { slots: 2, seed: 2 }).map((x) => x.id), ['f3', 'f1']);
});
