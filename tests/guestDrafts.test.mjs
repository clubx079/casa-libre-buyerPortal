import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './support/fakePostgrest.mjs';
import { listDrafts } from '../lib/drafts.js';
import { guestOwnerId, saveGuestDraft, getGuestDraft, claimGuestDrafts } from '../lib/guestDrafts.js';

const KEY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_KEY = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UID = '11111111-1111-4111-8111-111111111111';
const ADDR = { mode: 'venta', seller_type: 'owner', contact_name: 'Ana', neighborhood: 'Villa Morra', city: 'Asunción', addressText: 'Av. Mcal. López 1234', ptype: 'casa' };

test('a guest owner id is a stable v5 UUID per email (case-insensitive), never a v4 account id', () => {
  const a = guestOwnerId('Ana@Mail.com ');
  assert.equal(a, guestOwnerId('ana@mail.com'));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, guestOwnerId('bo@mail.com'));
});

test('save → update → resume, only from the browser that made it', async () => {
  const db = createStore();
  const { draft } = await saveGuestDraft(db, { email: 'ana@mail.com', key: KEY, data: ADDR, ip: '181.1.2.3' });
  assert.ok(draft.id);
  const again = await saveGuestDraft(db, { email: 'ana@mail.com', key: KEY, id: draft.id, data: { ...ADDR, price: '150000' } });
  assert.equal(again.draft.id, draft.id);                                      // updated in place
  const mine = await getGuestDraft(db, { email: 'ana@mail.com', key: KEY, id: draft.id });
  assert.equal(mine.data.price, '150000');
  assert.equal(mine.data._guest_key, undefined);                               // internal fields never returned
  assert.equal(await getGuestDraft(db, { email: 'ana@mail.com', key: OTHER_KEY, id: draft.id }), null);   // another browser can't read it
  const theirs = await saveGuestDraft(db, { email: 'ana@mail.com', key: OTHER_KEY, id: draft.id, data: ADDR });
  assert.notEqual(theirs.draft.id, draft.id);                                  // …or overwrite it: it gets its own
});

test('needs an email, a browser key and the address', async () => {
  const db = createStore();
  assert.deepEqual(await saveGuestDraft(db, { email: 'nope', key: KEY, data: ADDR }), { error: 'bad_request' });
  assert.deepEqual(await saveGuestDraft(db, { email: 'ana@mail.com', key: 'x', data: ADDR }), { error: 'bad_request' });
  assert.deepEqual(await saveGuestDraft(db, { email: 'ana@mail.com', key: KEY, data: { mode: 'venta' } }), { error: 'needs_address' });
});

test('signing in with the email moves its guest drafts to the account (My listings → Drafts)', async () => {
  const db = createStore();
  await saveGuestDraft(db, { email: 'ana@mail.com', key: KEY, data: ADDR, ip: '181.1.2.3' });
  await saveGuestDraft(db, { email: 'bo@mail.com', key: KEY, data: ADDR });
  assert.equal(await claimGuestDrafts(db, 'ANA@mail.com', UID), 1);
  const drafts = await listDrafts(db, UID);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].data.neighborhood, 'Villa Morra');
  assert.equal(drafts[0].data._guest_email, undefined);                        // guest fields dropped on claim
  assert.equal(await claimGuestDrafts(db, 'ana@mail.com', UID), 0);            // nothing left to move
});
