import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderHomeFeatured, fillHomeFeatured } from '../lib/homeOrder.js';

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

test('strip is filled to 6: Landing, then Verified, then regular listings', () => {
  const out = fillHomeFeatured({
    onHome: [L('h1'), L('h2'), L('h3'), L('h4')],
    verified: [L('v1')],
    others: [L('o1'), L('o2'), L('o3')],
    slots: 6,
  }).map((x) => x.id);
  assert.deepEqual(out, ['h1', 'h2', 'h3', 'h4', 'v1', 'o1']);
});

test('regular listings only show when Verified ones run out', () => {
  const verified = Array.from({ length: 8 }, (_, i) => L(`v${i}`));
  const out = fillHomeFeatured({ onHome: [L('h1')], verified, others: [L('o1')], slots: 6, seed: 0 }).map((x) => x.id);
  assert.equal(out.length, 6);
  assert.equal(out[0], 'h1');
  assert.ok(out.slice(1).every((id) => id.startsWith('v')));
});

test('verified listings rotate with the seed', () => {
  const verified = [L('v1'), L('v2'), L('v3')];
  assert.deepEqual(fillHomeFeatured({ verified, slots: 2, seed: 1 }).map((x) => x.id), ['v2', 'v3']);
});

test('no promotions at all: six regular listings', () => {
  const others = Array.from({ length: 9 }, (_, i) => L(`o${i}`));
  assert.deepEqual(fillHomeFeatured({ others, slots: 6 }).map((x) => x.id), ['o0', 'o1', 'o2', 'o3', 'o4', 'o5']);
});

test('a listing never appears twice', () => {
  const out = fillHomeFeatured({ onHome: [L('a')], verified: [L('a'), L('b')], others: [L('b'), L('c'), L('a')], slots: 6 }).map((x) => x.id);
  assert.deepEqual(out, ['a', 'b', 'c']);
});
