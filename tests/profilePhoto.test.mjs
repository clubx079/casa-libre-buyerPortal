import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHOTO_STATUS, PROFILE_FAIL_CATEGORIES, REASONS, reasonFor, parseFaceVerdict, parseProfileVerdict, onUpload, onVerdict, onRemove,
  ownerView, publicPhoto, isStale, withSellerPhotos, avatarKeyFor, COLUMNS,
} from '../lib/profilePhoto.js';
import { logScans, SCAN_API } from '../lib/scanQuota.js';

const NOW = new Date('2026-11-13T15:00:00Z');
const A = { key: 'avatars/u1/a.jpg', url: '/api/media/avatars/u1/a.jpg' };
const B = { key: 'avatars/u1/b.jpg', url: '/api/media/avatars/u1/b.jpg' };
const C = { key: 'avatars/u1/c.jpg', url: '/api/media/avatars/u1/c.jpg' };
const apply = (row, step) => ({ ...row, ...step.patch });

test('the model answer → a profile-picture verdict (faces AND logos are fine)', () => {
  assert.deepEqual(parseProfileVerdict('PASS'), { verdict: 'pass' });
  assert.deepEqual(parseProfileVerdict(' pass.\n'), { verdict: 'pass' });
  assert.deepEqual(parseProfileVerdict('FAIL: adult'), { verdict: 'fail', category: 'adult' });
  assert.deepEqual(parseProfileVerdict('FAIL - violence'), { verdict: 'fail', category: 'violence' });
  assert.deepEqual(parseProfileVerdict('Fail: hate (a symbol)'), { verdict: 'fail', category: 'hate' });
  assert.deepEqual(parseProfileVerdict('<think>a meme</think>FAIL: junk'), { verdict: 'fail', category: 'junk' });
  // the old faces-only reasons are no reason to reject any more
  for (const old of ['logo', 'no_face', 'no-face', 'drawing', 'group', 'object', 'animal']) {
    assert.deepEqual(parseProfileVerdict(`FAIL: ${old}`), { verdict: 'pass' }, old);
  }
  assert.deepEqual(parseProfileVerdict('FAIL: unrelated'), { verdict: 'fail', category: 'other' });   // unknown → other
  assert.equal(parseProfileVerdict('It looks like a man smiling').verdict, 'error');                   // unclear → ask again
  assert.equal(parseProfileVerdict('').verdict, 'error');
  assert.equal(parseProfileVerdict(null).verdict, 'error');
  assert.equal(parseFaceVerdict, parseProfileVerdict);   // old name still works
  assert.deepEqual(PROFILE_FAIL_CATEGORIES, ['adult', 'violence', 'hate', 'junk']);
});

test('every category has a short Spanish (voseo) and English reason', () => {
  for (const c of [...PROFILE_FAIL_CATEGORIES, 'logo', 'no_face', 'other']) {
    assert.ok(REASONS.es[c] && REASONS.es[c].length < 160, c);
    assert.ok(REASONS.en[c], c);
  }
  assert.match(reasonFor('junk'), /logo de tu empresa/);
  assert.match(reasonFor('adult'), /Subí/);                         // voseo
  assert.doesNotMatch(Object.values(REASONS.es).join(' '), /foto real de tu cara/);
  assert.equal(reasonFor('nonsense'), REASONS.es.other);
  assert.equal(reasonFor('junk', 'en'), REASONS.en.junk);
});

test('first upload → checking, nothing shown to buyers yet', () => {
  const s = onUpload({}, A, NOW);
  assert.equal(s.patch.profile_photo_status, 'checking');
  assert.equal(s.patch.profile_photo_pending_key, A.key);
  assert.equal(s.patch.profile_photo_updated_at, NOW.toISOString());
  assert.deepEqual(s.deleteKeys, []);
  const row = apply({}, s);
  assert.equal(publicPhoto(row), null);
  assert.deepEqual(ownerView(row), { status: 'checking', photo: null, pending: A.url, category: null, reason: null, checked_at: null, updated_at: NOW.toISOString(), edit_src: null, edit_fallback: null, last_rejected: null });
});

test('checking → approved: the pending photo becomes the photo', () => {
  const row = apply({}, onUpload({}, A, NOW));
  const s = onVerdict(row, { verdict: 'pass' }, NOW);
  assert.equal(s.outcome, 'approved');
  assert.deepEqual(s.deleteKeys, []);
  const after = apply(row, s);
  assert.equal(publicPhoto(after), A.url);
  assert.equal(after.profile_photo_key, A.key);
  assert.equal(after.profile_photo_pending_key, null);
  assert.equal(after.profile_photo_attempts, 1);
  assert.equal(ownerView(after).status, 'approved');
  assert.equal(ownerView(after).pending, null);
});

test('checking → rejected: category + Spanish reason stored, nothing shown to buyers', () => {
  const row = apply({}, onUpload({}, A, NOW));
  const s = onVerdict(row, { verdict: 'fail', category: 'adult' }, NOW);
  assert.equal(s.outcome, 'rejected');
  const after = apply(row, s);
  assert.equal(after.profile_photo_category, 'adult');
  assert.equal(after.profile_photo_reason, REASONS.es.adult);
  assert.equal(publicPhoto(after), null);
  const v = ownerView(after);
  assert.equal(v.status, 'rejected');
  assert.equal(v.pending, A.url);          // the owner sees which photo was rejected
  assert.equal(v.reason, REASONS.es.adult);
  assert.equal(ownerView(after, 'en').reason, REASONS.en.adult);
});

test('replace an approved photo: the old one keeps showing while checking and after a rejection', () => {
  let row = apply(apply({}, onUpload({}, A, NOW)), onVerdict(apply({}, onUpload({}, A, NOW)), { verdict: 'pass' }, NOW));
  assert.equal(publicPhoto(row), A.url);
  const up = onUpload(row, B, NOW);
  assert.deepEqual(up.deleteKeys, []);     // the approved file is NOT deleted on upload
  row = apply(row, up);
  assert.equal(publicPhoto(row), A.url);   // still A while B is checked
  assert.equal(ownerView(row).status, 'checking');
  assert.equal(ownerView(row).photo, A.url);
  assert.equal(ownerView(row).pending, B.url);
  const rej = onVerdict(row, { verdict: 'fail', category: 'junk' }, NOW);
  assert.deepEqual(rej.deleteKeys, []);
  row = apply(row, rej);
  assert.equal(publicPhoto(row), A.url);   // B rejected → A still shows
  assert.equal(ownerView(row).status, 'rejected');
  // a third upload replaces the rejected B (deleted) and is approved → A deleted, C shows
  const up2 = onUpload(row, C, NOW);
  assert.deepEqual(up2.deleteKeys, [B.key]);
  row = apply(row, up2);
  const ok = onVerdict(row, { verdict: 'pass' }, NOW);
  assert.deepEqual(ok.deleteKeys, [A.key]);
  row = apply(row, ok);
  assert.equal(publicPhoto(row), C.url);
});

test('AI error → stays checking (never approved), attempts and error recorded', () => {
  const row = apply({}, onUpload({}, A, NOW));
  const s = onVerdict(row, { verdict: 'error', error: 'groq_http_503' }, NOW);
  assert.equal(s.outcome, 'retry');
  const after = apply(row, s);
  assert.equal(after.profile_photo_status, 'checking');
  assert.equal(after.profile_photo_error, 'groq_http_503');
  assert.equal(after.profile_photo_attempts, 1);
  assert.equal(publicPhoto(after), null);
  assert.equal(onVerdict(after, {}, NOW).outcome, 'retry');   // no verdict at all → retry too
});

test('a verdict for a photo that is no longer being checked is ignored', () => {
  assert.equal(onVerdict({}, { verdict: 'pass' }).outcome, 'skipped');
  assert.equal(onVerdict({ profile_photo_status: 'approved', profile_photo_url: A.url }, { verdict: 'pass' }).outcome, 'skipped');
  assert.equal(onVerdict({ profile_photo_status: 'checking' }, { verdict: 'pass' }).outcome, 'skipped');   // no pending file
});

test('remove → no photo at all, both files deleted', () => {
  const row = { profile_photo_url: A.url, profile_photo_key: A.key, profile_photo_pending_url: B.url, profile_photo_pending_key: B.key, profile_photo_status: 'checking' };
  const s = onRemove(row, NOW);
  assert.deepEqual(s.deleteKeys, [A.key, B.key]);
  const after = apply(row, s);
  assert.equal(publicPhoto(after), null);
  assert.equal(ownerView(after).status, null);
  assert.deepEqual(onRemove({}, NOW).deleteKeys, []);
  for (const c of Object.keys(s.patch)) assert.ok(COLUMNS.includes(c), c);
});

test('a stuck check is nudged only after a minute', () => {
  const row = apply({}, onUpload({}, A, NOW));
  assert.equal(isStale(row, new Date(NOW.getTime() + 30_000)), false);
  assert.equal(isStale(row, new Date(NOW.getTime() + 61_000)), true);
  assert.equal(isStale({ ...row, profile_photo_status: 'approved' }, new Date(NOW.getTime() + 3600_000)), false);
});

test('seller photos are attached only to listings whose owner has an approved photo', () => {
  const l1 = { id: 'p1', usd: 1 }, l2 = { id: 'p2', usd: 2 };
  const out = withSellerPhotos([l1, l2], new Map([['p2', A.url]]));
  assert.equal(out[0], l1);                         // untouched: the site looks as before
  assert.ok(!('seller_photo' in out[0]));
  assert.deepEqual(out[1], { id: 'p2', usd: 2, seller_photo: A.url });
  assert.equal(withSellerPhotos([l1], new Map()).length, 1);
  assert.equal(withSellerPhotos(null, new Map([['p1', A.url]])), null);
});

test('avatar keys live under avatars/<user id>/', () => {
  assert.equal(avatarKeyFor('u1', 'r'), 'avatars/u1/r.jpg');
  assert.equal(PHOTO_STATUS.checking, 'checking');
});

test('profile photo checks count in the same daily quota, with their own source', async () => {
  const rows = [];
  const insert = async (t, r) => { rows.push({ t, ...r[0] }); };
  await logScans(insert, 1, 'u1', { source: 'profile_photo_check', codePath: 'lib/profilePhotoScan.js' });
  await logScans(insert, 3, 'p9');
  assert.deepEqual(rows[0], { t: 'api_usage_log', api: SCAN_API, source: 'profile_photo_check', code_path: 'lib/profilePhotoScan.js#u1', calls: 1 });
  assert.equal(rows[1].source, 'listing_photo_check');   // listings unchanged
  assert.equal(rows[1].code_path, 'lib/listingScan.js#p9');
});

test('re-crop: the approved photo offers its original (same name + -orig) and the photo as fallback', async () => {
  const { ownerView, origKeyOf } = await import('../lib/profilePhoto.js');
  assert.equal(origKeyOf('avatars/u1/abc.jpg'), 'avatars/u1/abc-orig.jpg');
  assert.equal(origKeyOf(null), null);
  const v = ownerView({ profile_photo_url: 'https://x/api/media/avatars/u1/abc.jpg', profile_photo_key: 'avatars/u1/abc.jpg', profile_photo_status: 'approved' });
  assert.equal(v.edit_src, '/api/media/avatars/u1/abc-orig.jpg');
  assert.equal(v.edit_fallback, '/api/media/avatars/u1/abc.jpg');
  assert.equal(ownerView({}).edit_src, null);
});
