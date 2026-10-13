import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hamming, matchingPhotos, enoughSamePhotos, findDuplicateOf } from '../lib/duplicateCheck.js';

const U = '11111111-1111-1111-1111-111111111111';
const base = { listing_type: 'sale', property_type: 'casa', price: 145000, currency: 'USD', neighborhood: 'Villa Morra', city: 'Asunción', covered_area: 120, description: 'Linda casa', contact_phone: '0981 123 456' };

test('hamming distance between two picture fingerprints', () => {
  assert.equal(hamming('ffffffffffffffff', 'ffffffffffffffff'), 0);
  assert.equal(hamming('ffffffffffffffff', 'fffffffffffffffe'), 1);
  assert.equal(hamming('0000000000000000', 'ffffffffffffffff'), 64);
  assert.equal(hamming(null, 'ff'), 64);
});

test('a photo counts as the same within 10 of 64 bits', () => {
  assert.equal(matchingPhotos(['ffffffffffffff00', '0000000000000000'], ['ffffffffffffffff']), 1);   // 8 bits off → same; the other → not
  assert.equal(matchingPhotos(['ffffffffffff0000'], ['ffffffffffffffff']), 0);                       // 16 bits off → different
});

test('half or more of the new photos must be the same', () => {
  assert.equal(enoughSamePhotos(2, 4), true);
  assert.equal(enoughSamePhotos(3, 5), true);
  assert.equal(enoughSamePhotos(2, 5), false);
  assert.equal(enoughSamePhotos(0, 0), true);   // no photos: the details decide
});

const db = (rows) => ({ select: async () => rows });

test('same details + same photos → duplicate of the OLDEST matching listing', async () => {
  const rows = [
    { id: 'a', created_at: '2026-10-01', ...base, raw_data: { photo_hashes: ['ffffffffffffffff', '00000000ffffffff'] } },
    { id: 'b', created_at: '2026-10-02', ...base, raw_data: { photo_hashes: ['ffffffffffffffff'] } },
  ];
  const d = await findDuplicateOf({ ...db(rows), uid: U, newRow: base, newHashes: ['ffffffffffffffff', '00000000ffffffff'], photoHashesOf: async (p) => p.raw_data.photo_hashes });
  assert.equal(d.id, 'a');
  assert.equal(d.matched, 2);
  assert.equal(d.count, 3);
});

test('same details but different photos → NOT a duplicate', async () => {
  const rows = [{ id: 'a', ...base, raw_data: { photo_hashes: ['ffffffffffffffff'] } }];
  const d = await findDuplicateOf({ ...db(rows), uid: U, newRow: base, newHashes: ['0000000000000000', '0f0f0f0f0f0f0f0f'], photoHashesOf: async (p) => p.raw_data.photo_hashes });
  assert.equal(d, null);
});

test('one detail different (price) → NOT a duplicate, even with the same photos', async () => {
  const rows = [{ id: 'a', ...base, price: 150000, raw_data: { photo_hashes: ['ffffffffffffffff'] } }];
  const d = await findDuplicateOf({ ...db(rows), uid: U, newRow: base, newHashes: ['ffffffffffffffff'], photoHashesOf: async (p) => p.raw_data.photo_hashes });
  assert.equal(d, null);
});

test('formatting differences in the details still match (spaces, case, phone format)', async () => {
  const rows = [{ id: 'a', ...base, neighborhood: '  villa  morra ', contact_phone: '0981123456', raw_data: { photo_hashes: ['ffffffffffffffff'] } }];
  const d = await findDuplicateOf({ ...db(rows), uid: U, newRow: base, newHashes: ['ffffffffffffffff'], photoHashesOf: async (p) => p.raw_data.photo_hashes });
  assert.equal(d?.id, 'a');
});
