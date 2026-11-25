import test from 'node:test';
import assert from 'node:assert/strict';
import * as trash from '../lib/listingTrash.js';
const { trashPatch, restorePatch, trashView, DELETED_STATUS } = trash;

const DAY = 864e5;
const NOW = Date.parse('2026-11-25T12:00:00Z');
const live = {
  id: 'p1', status: 'published', admin_status: 'active',
  promotion_plan: 'verified', promotion_expires_at: '2026-12-10T00:00:00Z',
  raw_data: { paid_listing: { state: 'active', until: '2027-01-01T00:00:00Z' } },
};
const del = (p, at = NOW) => ({ ...p, ...trashPatch(p, at) });

test('delete hides the listing and remembers how it was — no expiry date on the deletion', () => {
  const p = trashPatch(live, NOW);
  assert.equal(p.status, DELETED_STATUS);
  assert.equal(p.admin_status, 'inactive');
  assert.deepEqual(p.raw_data.owner_deleted, { at: new Date(NOW).toISOString(), prev_status: 'published', prev_admin_status: 'active' });
  assert.deepEqual(p.raw_data.paid_listing, live.raw_data.paid_listing);   // paid period untouched
  assert.equal(p.promotion_expires_at, undefined);                          // Verified end date untouched
  assert.equal(trash.TRASH_DAYS, undefined);                                // no 3-day purge any more
  assert.equal(trash.purgeExpired, undefined);
});

test('recover months later still works (no time limit)', () => {
  const r = restorePatch(del(live, NOW - 200 * DAY), { until: '2027-01-01T00:00:00Z', now: NOW });
  assert.equal(r.status, 'published');
  assert.equal(r.admin_status, 'active');
});

test('recover keeps paid features with their ORIGINAL end dates', () => {
  const r = restorePatch(del(live), { until: live.raw_data.paid_listing.until, now: NOW + DAY });
  assert.equal(r.status, 'published');
  assert.equal(r.raw_data.owner_deleted, undefined);
  assert.deepEqual(r.raw_data.paid_listing, live.raw_data.paid_listing);   // same until, still active
  assert.equal('promotion_expires_at' in r, false);                        // the row's Verified date is not touched
});

test('paid period ran out while deleted → comes back ENDED, not live', () => {
  const r = restorePatch(del(live), { until: '2026-11-20T00:00:00Z', now: NOW });
  assert.equal(r.status, 'expired');
  assert.equal(r.admin_status, 'inactive');
  assert.equal(r.raw_data.paid_listing.state, 'expired');
  assert.equal(r.raw_data.paid_listing.until, '2027-01-01T00:00:00Z');     // original data kept
});

test('free period ran out while deleted → comes back ended with a free_listing record', () => {
  const free = { id: 'f', status: 'published', admin_status: 'active', raw_data: {} };
  const r = restorePatch(del(free), { until: '2026-11-01T00:00:00Z', now: NOW });
  assert.equal(r.status, 'expired');
  assert.deepEqual({ state: r.raw_data.free_listing.state, until: r.raw_data.free_listing.until }, { state: 'expired', until: '2026-11-01T00:00:00Z' });
});

test('no end date (paywall off, free listing) → back live', () => {
  const free = { id: 'f', status: 'published', admin_status: 'active', raw_data: {} };
  assert.equal(restorePatch(del(free), { until: null, now: NOW }).status, 'published');
});

test('a listing that was waiting for payment comes back waiting for payment', () => {
  const pending = { status: 'payment_pending', admin_status: 'inactive', raw_data: {} };
  const r = restorePatch(del(pending), { until: '2020-01-01T00:00:00Z', now: NOW });
  assert.equal(r.status, 'payment_pending');
  assert.equal(r.admin_status, 'inactive');
});

test('only deleted listings can be recovered; the dashboard view has no countdown', () => {
  assert.equal(restorePatch(live, { now: NOW }), null);
  assert.deepEqual(trashView(del(live)), { deleted_at: new Date(NOW).toISOString() });
  assert.equal(trashView(live), null);
});
