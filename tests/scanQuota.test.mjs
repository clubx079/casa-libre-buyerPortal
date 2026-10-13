import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStartIso, fitsQuota, dailyQuota, usedToday, SCAN_API, DEFAULT_DAILY_QUOTA } from '../lib/scanQuota.js';

test('day starts at local midnight (Paraguay UTC-3)', () => {
  assert.equal(dayStartIso('py', new Date('2026-10-13T02:30:00Z')), '2026-10-12T03:00:00.000Z'); // still 12 Oct 23:30 local
  assert.equal(dayStartIso('py', new Date('2026-10-13T15:00:00Z')), '2026-10-13T03:00:00.000Z');
  assert.equal(dayStartIso('bo', new Date('2026-10-13T15:00:00Z')), '2026-10-13T04:00:00.000Z'); // La Paz UTC-4
});

test('quota: a listing is checked only if all its photos fit', () => {
  assert.equal(fitsQuota(0, 10, 5000), true);
  assert.equal(fitsQuota(4990, 10, 5000), true);
  assert.equal(fitsQuota(4995, 10, 5000), false);
  assert.equal(fitsQuota(5000, 0, 5000), true);   // nothing to check (photos passed before)
});

test('default 5,000 a day, overridable with SCAN_DAILY_QUOTA', () => {
  assert.equal(dailyQuota({}), DEFAULT_DAILY_QUOTA);
  assert.equal(DEFAULT_DAILY_QUOTA, 5000);
  assert.equal(dailyQuota({ SCAN_DAILY_QUOTA: '1200' }), 1200);
  assert.equal(dailyQuota({ SCAN_DAILY_QUOTA: 'x' }), 5000);
});

test('usedToday sums today\'s groq_vision calls since local midnight', async () => {
  let q = '';
  const select = async (t, query) => { q = query; return [{ calls: 7 }, { calls: 3 }]; };
  assert.equal(await usedToday(select, 'py', new Date('2026-10-13T15:00:00Z')), 10);
  assert.match(q, new RegExp(`api=eq\\.${SCAN_API}`));
  assert.match(q, /created_at=gte\.2026-10-13T03%3A00%3A00\.000Z/);
});
