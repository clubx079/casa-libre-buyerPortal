import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CRON_JOBS, dueJobs, otherSites } from '../lib/cronJobs.js';

const at = (h) => new Date(Date.UTC(2026, 9, 7, h, 5));

test('hourly jobs run every hour; 6-hourly ones at 00, 06, 12, 18 UTC', () => {
  const names = (h) => dueJobs(at(h)).map((j) => j.name).sort();
  assert.deepEqual(names(13), ['automations', 'expire-highlights', 'zoning']);
  assert.deepEqual(names(6), ['automations', 'expire-highlights', 'recompute-complete', 'renewal-reminders', 'zoning']);
  assert.deepEqual(names(0), names(6));
  assert.deepEqual(names(5), names(13));
});

test('every job in the list points at a real cron route', () => {
  for (const j of CRON_JOBS) assert.ok(fs.existsSync(`app${j.path}/route.js`), `${j.path} has no route`);
});

test('a tick passes the call on to every other country, never back to itself', () => {
  const all = [{ code: 'py', url: 'https://casa-libre.com.py' }, { code: 'bo', url: 'https://casa-libre.com.bo' }, { code: 'uy', url: 'https://uy.casa-libre.com' }, { code: 've', url: 'https://casa-libre.com.ve' }, { code: 'xx', url: '' }];
  assert.deepEqual(otherSites(all, 'py').map((c) => c.code), ['bo', 'uy', 've']);
  assert.deepEqual(otherSites(all, 'bo').map((c) => c.code), ['py', 'uy', 've']);
});
