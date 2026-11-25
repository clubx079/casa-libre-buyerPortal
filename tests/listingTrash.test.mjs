import test from 'node:test';
import assert from 'node:assert/strict';
import { trashPatch, restorePatch, trashView, purgeExpired, TRASH_DAYS } from '../lib/listingTrash.js';

const DAY = 864e5;
const NOW = Date.parse('2026-11-25T12:00:00Z');
const live = { id: 'p1', status: 'published', admin_status: 'active', raw_data: { paid_listing: { state: 'active', until: '2027-01-01' } } };

test('delete hides the listing and remembers how it was', () => {
  const p = trashPatch(live, NOW);
  assert.equal(p.status, 'deleted');
  assert.equal(p.admin_status, 'inactive');
  assert.equal(p.raw_data.owner_deleted.prev_status, 'published');
  assert.equal(p.raw_data.owner_deleted.prev_admin_status, 'active');
  assert.equal(Date.parse(p.raw_data.owner_deleted.purge_after) - NOW, TRASH_DAYS * DAY);
  assert.deepEqual(p.raw_data.paid_listing, live.raw_data.paid_listing);   // paid period untouched
});

test('recover brings back the exact previous state, paid data included', () => {
  const deleted = { ...live, ...trashPatch(live, NOW) };
  const r = restorePatch(deleted, NOW + DAY);
  assert.equal(r.status, 'published');
  assert.equal(r.admin_status, 'active');
  assert.equal(r.raw_data.owner_deleted, undefined);
  assert.deepEqual(r.raw_data.paid_listing, live.raw_data.paid_listing);
});

test('a listing that was waiting for payment comes back waiting for payment', () => {
  const pending = { status: 'payment_pending', admin_status: 'inactive', raw_data: {} };
  const r = restorePatch({ ...pending, ...trashPatch(pending, NOW) }, NOW);
  assert.equal(r.status, 'payment_pending');
  assert.equal(r.admin_status, 'inactive');
});

test('no recover after the window, and days left counts down', () => {
  const deleted = { ...live, ...trashPatch(live, NOW) };
  assert.equal(trashView(deleted, NOW).days_left, 3);
  assert.equal(trashView(deleted, NOW + 2.5 * DAY).days_left, 1);
  assert.equal(restorePatch(deleted, NOW + TRASH_DAYS * DAY + 1), null);
  assert.equal(trashView(deleted, NOW + TRASH_DAYS * DAY + 1).recoverable, false);
  assert.equal(restorePatch(live, NOW), null);   // not deleted → nothing to recover
});

test('purge removes only listings past the window', async () => {
  const old = { id: 'old', ...trashPatch(live, NOW - 4 * DAY) };
  const fresh = { id: 'fresh', ...trashPatch(live, NOW - DAY) };
  const removed = [];
  const db = { select: async () => [old, fresh], remove: async (t, f) => { removed.push(`${t}?${f}`); } };
  const res = await purgeExpired(db, { now: NOW });
  assert.deepEqual(res, { checked: 2, purged: 1 });
  assert.ok(removed.every((r) => r.includes('old')));
  assert.ok(removed.some((r) => r.startsWith('properties?') && r.includes('status=eq.deleted')));
});
