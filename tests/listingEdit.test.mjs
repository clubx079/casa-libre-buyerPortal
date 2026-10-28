import test from 'node:test';
import assert from 'node:assert/strict';
import { lockReason } from '../lib/listingEdit.js';

test('a live or rejected listing can be edited', () => {
  assert.equal(lockReason({ status: 'published', admin_status: 'active' }), null);
  assert.equal(lockReason({ status: 'rejected', admin_status: 'inactive' }), null);   // edit = fix it and check again
});

test('listings an admin or a process is holding cannot', () => {
  assert.equal(lockReason({ status: 'published', admin_status: 'inactive' }), 'taken_down');   // an admin took it down
  assert.equal(lockReason({ status: 'duplicate_review', admin_status: 'inactive' }), 'held_duplicate');
  assert.equal(lockReason({ status: 'payment_pending', admin_status: 'inactive' }), 'payment_pending');
  assert.equal(lockReason({ status: 'scanning', admin_status: 'inactive' }), 'checking');
  assert.equal(lockReason({ status: 'expired', admin_status: 'inactive' }), 'locked');
});
