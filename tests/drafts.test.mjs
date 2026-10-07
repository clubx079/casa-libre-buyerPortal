import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './support/fakePostgrest.mjs';
import { cleanDraftData, draftReady, draftMissing, listDrafts, getDraft, createDraft, updateDraft, deleteDraft, cleanDraftPhotos, draftPhotoKeys, getDraftRow, setDraftPhotos, orderedPhotoSources } from '../lib/drafts.js';

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

// ---- draft photos ----
const DRAFT_ID = '33333333-3333-4333-8333-333333333333';
const photoKey = (owner, n) => `drafts/${owner}/${DRAFT_ID}/${String(n).repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`;

test('cleanDraftPhotos keeps only well-formed draft keys, no repeats, at most 20', () => {
  const ok = { key: photoKey(ANA, 1), url: '/api/media/x' };
  const list = cleanDraftPhotos([ok, ok, { key: 'user-uploads/x.webp' }, { key: '../etc/passwd' }, null]);
  assert.deepEqual(list, [ok]);
  assert.equal(cleanDraftData({ ...ADDR, photos: [ok] }).photos.length, 1);
  const many = Array.from({ length: 25 }, (_, i) => ({ key: `drafts/${ANA}/${DRAFT_ID}/${String(i).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg` }));
  assert.equal(cleanDraftPhotos(many).length, 20);
  assert.deepEqual(draftMissing({ ...ADDR, price: '1', area: '80', contact_phone: '0981 123 456', photos: [ok] }), []);
});

test('the autosave never changes the photo list; setDraftPhotos is its only writer', async () => {
  const db = createStore();
  const { draft } = await createDraft(db, ANA, { ...ADDR, photos: [{ key: photoKey(ANA, 1) }] });
  assert.equal((await getDraft(db, ANA, draft.id)).data.photos, undefined);          // create ignores photos
  const row = await getDraftRow(db, ANA, draft.id);
  await setDraftPhotos(db, ANA, row, [{ key: photoKey(ANA, 2), url: 'u' }]);
  await updateDraft(db, ANA, draft.id, { ...ADDR, price: '9', photos: [] });           // an autosave without photos…
  const after = await getDraft(db, ANA, draft.id);
  assert.equal(after.data.price, '9');
  assert.deepEqual(draftPhotoKeys(after.data), [photoKey(ANA, 2)]);                      // …keeps them
  assert.equal(await getDraftRow(db, BO, draft.id), null);                               // another owner can't touch it
});

test('publishing takes photos in the seller order, draft keys only from their own folders', () => {
  const mine = [`drafts/${ANA}/`];
  const order = [{ k: photoKey(ANA, 1) }, { f: 0 }, { k: photoKey(BO, 2) }, { f: 5 }, { k: 'user-uploads/x.webp' }];
  assert.deepEqual(orderedPhotoSources(order, 1, mine), [{ key: photoKey(ANA, 1) }, { file: 0 }]);
  assert.deepEqual(orderedPhotoSources(null, 2, mine), []);
});
