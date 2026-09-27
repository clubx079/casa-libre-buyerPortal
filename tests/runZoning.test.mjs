import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './support/fakePostgrest.mjs';
import { runZoning } from '../lib/zoning/runZoning.js';

const NOW = new Date('2026-10-01T12:00:00Z');
const prop = (id, city, extra = {}) => ({ id, city, latitude: -25.29, longitude: -57.58, admin_status: 'active', zoning_checked_at: null, zoning_lat: null, zoning_lng: null, ...extra });
const provider = (lookup) => (city) => (String(city).startsWith('Asun') ? { id: 'asuncion', lookup } : null);
const AR1A = { code: 'AR1A', category: 'baja', maxFloors: 3 };
const one = async (db, id) => (await db.select('properties', `id=eq.${id}`))[0];

test('zones Asunción listings; other cities marked checked without calling a provider', async () => {
  const db = createStore().seed('properties', [prop('a', 'Asunción'), prop('l', 'Luque')]);
  let calls = 0;
  const r = await runZoning({ db, now: NOW, providerFor: provider(async () => { calls++; return AR1A; }) });
  assert.equal(calls, 1);
  assert.deepEqual([r.checked, r.zoned, r.skipped], [2, 1, 1]);
  const a = await one(db, 'a');
  assert.deepEqual([a.zoning_code, a.zoning_category, a.zoning_max_floors, a.zoning_source], ['AR1A', 'baja', 3, 'asuncion']);
  assert.deepEqual([a.zoning_lat, a.zoning_lng, a.zoning_checked_at], [-25.29, -57.58, NOW.toISOString()]);
  const l = await one(db, 'l');
  assert.equal(l.zoning_category, null);
  assert.equal(l.zoning_checked_at, NOW.toISOString());
});

test('no zone found is recorded as checked+empty', async () => {
  const db = createStore().seed('properties', [prop('n', 'Asunción')]);
  const r = await runZoning({ db, now: NOW, providerFor: provider(async () => null) });
  assert.equal(r.noZone, 1);
  const n = await one(db, 'n');
  assert.equal(n.zoning_category, null);
  assert.equal(n.zoning_source, 'asuncion');
  assert.ok(n.zoning_checked_at);
});

test('provider error is NOT recorded, so the next run retries it', async () => {
  const db = createStore().seed('properties', [prop('e', 'Asunción')]);
  const r = await runZoning({ db, now: NOW, providerFor: provider(async () => { throw new Error('city server down'); }) });
  assert.equal(r.failed, 1);
  assert.equal((await one(db, 'e')).zoning_checked_at, null);
  const r2 = await runZoning({ db, now: NOW, providerFor: provider(async () => AR1A) });
  assert.equal(r2.zoned, 1);
});

test('already-zoned listings are skipped unless their coordinates moved', async () => {
  const done = { zoning_checked_at: '2026-09-01T00:00:00Z', zoning_category: 'baja' };
  const db = createStore().seed('properties', [
    prop('same', 'Asunción', { ...done, zoning_lat: -25.29, zoning_lng: -57.58 }),
    prop('moved', 'Asunción', { ...done, zoning_lat: -25.30, zoning_lng: -57.60 }),
  ]);
  let calls = 0;
  await runZoning({ db, now: NOW, providerFor: provider(async () => { calls++; return { code: 'AR3B', category: 'alta', maxFloors: 8 }; }) });
  assert.equal(calls, 1);
  assert.equal((await one(db, 'moved')).zoning_category, 'alta');
  assert.equal((await one(db, 'same')).zoning_category, 'baja');
});

test('inactive listings and listings without coordinates are ignored', async () => {
  const db = createStore().seed('properties', [prop('off', 'Asunción', { admin_status: 'inactive' }), prop('nogeo', 'Asunción', { latitude: null })]);
  const r = await runZoning({ db, now: NOW, providerFor: provider(async () => AR1A) });
  assert.equal(r.checked, 0);
});

test('respects the per-run limit', async () => {
  const db = createStore().seed('properties', Array.from({ length: 7 }, (_, i) => prop(`p${i}`, 'Asunción')));
  const r = await runZoning({ db, now: NOW, limit: 3, providerFor: provider(async () => AR1A) });
  assert.equal(r.checked, 3);
});
