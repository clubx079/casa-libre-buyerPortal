import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './support/fakePostgrest.mjs';
import { cleanDraftData, draftReady, draftMissing, listDrafts, getDraft, createDraft, updateDraft, deleteDraft } from '../lib/drafts.js';

const ANA = '11111111-1111-4111-8111-111111111111';
const BO = '22222222-2222-4222-8222-222222222222';
const ADDR = { mode: 'venta', seller_type: 'owner', contact_name: 'Ana', neighborhood: 'Villa Morra', city: 'Asunción', addressText: 'Av. Mcal. López 1234' };

test('cleanDraftData keeps only wizard fields, as trimmed strings', () => {
  const d = cleanDraftData({ ...ADDR, price: 150000, email: 'x@y.com', admin_status: 'active', description: 'a'.repeat(6000), area: '' });
  assert.equal(d.price, '150000');
  assert.equal(d.email, undefined);          // email comes from the session, never stored
  assert.equal(d.admin_status, undefined);   // can't smuggle columns
  assert.equal(d.area, undefined);           // empty values dropped
  assert.equal(d.description.length, 5000);
  assert.deepEqual(cleanDraftData(null), {});
});

test('draftReady needs an address; draftMissing lists what blocks publishing', () => {
  assert.equal(draftReady({ mode: 'venta' }), false);
  assert.equal(draftReady(ADDR), true);
  assert.deepEqual(draftMissing(ADDR), ['price', 'area', 'phone', 'photos']);
  assert.deepEqual(draftMissing({ ...ADDR, price: '1', area: '80', contact_phone: '0981 123 456' }), ['photos']);
});

test('create → list → update → delete, all scoped to the owner', async () => {
  const db = createStore();
  const t0 = new Date('2026-09-28T10:00:00Z');
  const { draft } = await createDraft(db, ANA, ADDR, t0);
  assert.ok(draft.id);
  assert.equal((await listDrafts(db, ANA)).length, 1);
  assert.equal((await listDrafts(db, BO)).length, 0);             // someone else sees nothing

  const t1 = new Date('2026-09-28T10:05:00Z');
  const up = await updateDraft(db, ANA, draft.id, { ...ADDR, price: '145000' }, t1);
  assert.equal(up.draft.data.price, '145000');
  assert.equal(up.draft.updated_at, t1.toISOString());

  assert.deepEqual(await updateDraft(db, BO, draft.id, { ...ADDR, price: '1' }), { error: 'not_found' });   // not theirs
  assert.equal((await getDraft(db, ANA, draft.id)).data.price, '145000');
  assert.equal(await getDraft(db, BO, draft.id), null);

  assert.equal(await deleteDraft(db, BO, draft.id), false);
  assert.equal(await deleteDraft(db, ANA, draft.id), true);
  assert.equal((await listDrafts(db, ANA)).length, 0);
});

test('no draft without an address; bad ids are rejected', async () => {
  const db = createStore();
  assert.deepEqual(await createDraft(db, ANA, { mode: 'venta' }), { error: 'needs_address' });
  assert.equal(await getDraft(db, ANA, 'not-a-uuid'), null);
  assert.deepEqual(await updateDraft(db, ANA, "x' or 1=1", ADDR), { error: 'not_found' });
  assert.equal(await deleteDraft(db, ANA, '../etc'), false);
});

test('newest-edited draft comes first', async () => {
  const db = createStore();
  const a = (await createDraft(db, ANA, { ...ADDR, neighborhood: 'Carmelitas' }, new Date('2026-09-20T00:00:00Z'))).draft;
  await createDraft(db, ANA, { ...ADDR, neighborhood: 'Recoleta' }, new Date('2026-09-21T00:00:00Z'));
  await updateDraft(db, ANA, a.id, { ...ADDR, neighborhood: 'Carmelitas', price: '9' }, new Date('2026-09-22T00:00:00Z'));
  assert.deepEqual((await listDrafts(db, ANA)).map((d) => d.data.neighborhood), ['Carmelitas', 'Recoleta']);
});
