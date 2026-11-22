// Upload check (block photos that are neither a face nor a logo) + the "Show your face"
// automation's wrong-photo part (lib/automations/photoFace.js pickPhotoWrong / runPhotoFace).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import { runPhotoFace, pickPhotoWrong, photoWrongConfig, wrongLine, PHOTO_FACE_ID, PHOTO_WRONG_ID, DEFAULT_WRONG_STEPS } from '../lib/automations/photoFace.js';
import { parseUploadKind, uploadDecision, wrongPhotoMessage, whatLabel, photoState, lastRejected, knownGoodKind, WRONG_WHAT } from '../lib/profilePhotoKind.js';

const H = 3600e3;
const NOW = Date.parse('2026-11-22T15:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const SITE = 'https://casa-libre.com.py';

// ── the upload decision ─────────────────────────────────────────────────────────────────────────
test('parseUploadKind: FACE / LOGO / OTHER: <code>; unknown codes → other; junk → null', () => {
  assert.deepEqual(parseUploadKind('FACE'), { kind: 'face', what: null });
  assert.deepEqual(parseUploadKind(' logo.'), { kind: 'logo', what: null });
  assert.deepEqual(parseUploadKind('OTHER: house'), { kind: 'other', what: 'house' });
  assert.deepEqual(parseUploadKind('OTHER - apartment'), { kind: 'other', what: 'apartment' });
  assert.deepEqual(parseUploadKind('OTHER: spaceship'), { kind: 'other', what: 'other' });
  assert.deepEqual(parseUploadKind('OTHER'), { kind: 'other', what: 'other' });
  assert.deepEqual(parseUploadKind('<think>hmm</think>OTHER: no_face'), { kind: 'other', what: 'no_face' });
  assert.equal(parseUploadKind('PASS'), null);
  assert.equal(parseUploadKind(''), null);
});

test('uploadDecision: face and logo accepted; other rejected with what it is; AI error/timeout → accepted (label later)', () => {
  assert.deepEqual(uploadDecision({ verdict: 'pass', kind: 'face' }), { action: 'accept', kind: 'face' });
  assert.deepEqual(uploadDecision({ verdict: 'pass', kind: 'logo' }), { action: 'accept', kind: 'logo' });
  assert.deepEqual(uploadDecision({ verdict: 'pass', kind: 'other', what: 'house' }), { action: 'reject', what: 'house' });
  assert.deepEqual(uploadDecision({ verdict: 'pass', kind: 'other', what: 'weird' }), { action: 'reject', what: 'other' });
  assert.deepEqual(uploadDecision({ verdict: 'error', error: 'groq_timeout' }), { action: 'accept', kind: null });
  assert.deepEqual(uploadDecision({ verdict: 'error', error: 'quota' }), { action: 'accept', kind: null });
  assert.deepEqual(uploadDecision(null), { action: 'accept', kind: null });
});

test('message: Roland wording, ES default, EN; every code has a label', () => {
  assert.equal(wrongPhotoMessage('house'), 'Esta imagen parece ser una foto de una casa. Subí tu foto profesional (tu cara) o el logo de tu empresa.');
  assert.equal(wrongPhotoMessage('apartment', 'en'), 'This image looks like a photo of an apartment. Upload your professional photo (your face) or your company logo.');
  assert.match(wrongPhotoMessage('zzz', 'fr'), /^Esta imagen parece ser una foto de algo que no es tu cara ni un logo\./);
  for (const w of WRONG_WHAT) for (const l of ['es', 'en', 'pt']) assert.ok(whatLabel(w, l));
});

test('re-crop of a known face/logo needs no new check', () => {
  const u = { profile_photo_key: 'k1', profile_photo_kind_key: 'k1', profile_photo_kind: 'logo' };
  assert.equal(knownGoodKind(u), 'logo');
  assert.equal(knownGoodKind({ ...u, profile_photo_kind: 'other' }), null);
  assert.equal(knownGoodKind({ ...u, profile_photo_kind_key: 'k0' }), null);
});

test('lastRejected: shown while nothing newer was uploaded, for 30 days', () => {
  const row = { profile_photo_rejected_at: iso(NOW - H), profile_photo_rejected_what: 'house', profile_photo_updated_at: iso(NOW - 48 * H) };
  const r = lastRejected(row, 'es', NOW);
  assert.equal(r.what, 'house');
  assert.equal(r.kept, false);
  assert.match(r.message, /una casa/);
  assert.equal(lastRejected({ ...row, profile_photo_updated_at: iso(NOW - 10 * 60e3) }, 'es', NOW), null);   // uploaded after
  assert.equal(lastRejected({ ...row, profile_photo_rejected_at: iso(NOW - 31 * 24 * H) }, 'es', NOW), null);
  assert.equal(lastRejected({}, 'es', NOW), null);                                                             // migration 014 not applied
  assert.equal(lastRejected({ ...row, profile_photo_url: 'https://x/a.jpg' }, 'en', NOW).kept, true);
});

// ── the automation ─────────────────────────────────────────────────────────────────────────────
// an account: photo = 'face' | 'logo' | 'other' (approved, labelled) | null (none); rejectedH = hours since a turned-down upload
const acct = (id, photo, { rejectedH = null, what = 'house', approvedH = 24 * 10, ...extra } = {}) => ({
  id, email: `${id}@x.com`, full_name: `Ana ${id}`, verified: true, active: true, blocked: false, suspended: false,
  ...(photo ? {
    profile_photo_status: 'approved', profile_photo_url: `https://x/${id}.jpg`, profile_photo_key: `avatars/${id}/k1.jpg`,
    profile_photo_checked_at: iso(NOW - approvedH * H), profile_photo_kind: photo, profile_photo_kind_key: `avatars/${id}/k1.jpg`,
    profile_photo_kind_at: iso(NOW - approvedH * H),
  } : { profile_photo_status: null, profile_photo_url: null, profile_photo_key: null }),
  ...(rejectedH != null ? { profile_photo_rejected_at: iso(NOW - rejectedH * H), profile_photo_rejected_what: what } : {}),
  ...extra,
});

test('photoState: valid (face/logo), unknown ("?"), pending (checking / not labelled), none', () => {
  assert.equal(photoState(acct('a', 'face')), 'valid');
  assert.equal(photoState(acct('a', 'logo')), 'valid');
  assert.equal(photoState(acct('a', 'other')), 'unknown');
  assert.equal(photoState(acct('a', null)), 'none');
  assert.equal(photoState(acct('a', 'face', { profile_photo_kind_key: 'old' })), 'pending');
  assert.equal(photoState(acct('a', null, { profile_photo_status: 'checking' })), 'pending');
});

test('pickPhotoWrong: turned-down upload with no photo → sequence on schedule; valid photo stops it', () => {
  const steps = DEFAULT_WRONG_STEPS;   // 2 h, 2 days, 7 days
  const users = [
    acct('none1', null, { rejectedH: 3 }),           // step 1 due
    acct('early', null, { rejectedH: 1 }),           // not yet
    acct('fixedFace', 'face', { rejectedH: 3, approvedH: 1 }),   // fixed it after → nothing
    acct('fixedLogo', 'logo', { rejectedH: 3, approvedH: 1 }),
    acct('never', null),                             // no photo, never tried → not this automation
    acct('closed', null, { rejectedH: 3, active: false }),
    acct('checking', null, { rejectedH: 3, profile_photo_status: 'checking' }),
  ];
  const r = pickPhotoWrong({ users, steps, nowMs: NOW });
  assert.deepEqual(r.map((x) => [x.user.id, x.kind, x.step, x.dedupeKey]), [['none1', 'none', 1, 'photowrong:none1:1']]);
  // day 2: step 2 (step 1 already sent)
  const r2 = pickPhotoWrong({ users: [acct('none1', null, { rejectedH: 50 })], lastSent: new Map([['none1', 1]]), steps, nowMs: NOW });
  assert.deepEqual(r2.map((x) => x.step), [2]);
  // all sent → nothing
  assert.equal(pickPhotoWrong({ users: [acct('none1', null, { rejectedH: 200 })], lastSent: new Map([['none1', 3]]), steps, nowMs: NOW }).length, 0);
});

test('pickPhotoWrong: "?" photos are treated like a turned-down upload, clock = switched on (or labelled) time', () => {
  const steps = DEFAULT_WRONG_STEPS;
  const old = acct('q', 'other', { approvedH: 24 * 60 });   // labelled 60 days ago
  // switched on 3 h ago → step 1
  assert.deepEqual(pickPhotoWrong({ users: [old], steps, nowMs: NOW, enabledAtMs: NOW - 3 * H }).map((x) => [x.kind, x.step]), [['unknown', 1]]);
  // not switched on (no date) and labelled long ago → too late, nothing
  assert.equal(pickPhotoWrong({ users: [old], steps, nowMs: NOW }).length, 0);
  // the photo becomes a face → stops
  assert.equal(pickPhotoWrong({ users: [acct('q', 'face', { approvedH: 1 })], steps, nowMs: NOW, enabledAtMs: NOW - 3 * H }).length, 0);
});

test('pickPhotoWrong: valid photo + a wrong new one → ONE "kept" email, once per 30 days, not if fixed after', () => {
  const steps = DEFAULT_WRONG_STEPS;
  const u = acct('k', 'logo', { rejectedH: 3, approvedH: 24 * 5, what: 'apartment' });
  const r = pickPhotoWrong({ users: [u], steps, nowMs: NOW });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'kept');
  assert.equal(r[0].dedupeKey, `photowrongkept:k:${NOW - 3 * H}`);
  // already got one 10 days ago → nothing
  assert.equal(pickPhotoWrong({ users: [u], keptSent: new Map([['k', [NOW - 10 * 24 * H]]]), steps, nowMs: NOW }).length, 0);
  // got one 40 days ago → a new attempt gets one again
  assert.equal(pickPhotoWrong({ users: [u], keptSent: new Map([['k', [NOW - 40 * 24 * H]]]), steps, nowMs: NOW }).length, 1);
  // too early / more than 7 days late
  assert.equal(pickPhotoWrong({ users: [acct('k', 'face', { rejectedH: 1 })], steps, nowMs: NOW }).length, 0);
  assert.equal(pickPhotoWrong({ users: [acct('k', 'face', { rejectedH: 24 * 9 })], steps, nowMs: NOW }).length, 0);
});

test('config + lines', () => {
  assert.equal(photoWrongConfig(null).enabled, false);
  assert.equal(photoWrongConfig({ enabled: true }).enabled, false);
  const c = photoWrongConfig({ enabled: true, enabled_at: iso(NOW), milestones: [48, 2], template_id: 't1', gift_template_id: 't3' });
  assert.deepEqual(c.steps, [2, 48]);
  assert.deepEqual(c.templateIds, ['t1', 't1']);
  assert.equal(c.keptTemplateId, 't3');
  assert.match(wrongLine('none', 'house'), /parece ser una foto de una casa, por eso no la pudimos usar/);
  assert.match(wrongLine('unknown'), /no muestra tu cara ni el logo/);
  assert.match(wrongLine('kept', 'apartment'), /un departamento, así que seguimos mostrando tu foto anterior/);
});

// ── end to end on the in-memory database ─────────────────────────────────────────────────────────
const TF1 = { id: 'tf1', key: 'photo-face', subject: 'Cara', heading: 'h', body: 'Hola {{name}}. {{photo_line}}', button_label: 'Subir', button_url: '{{settings_url}}', is_active: true };
const TW1 = { id: 'tw1', key: 'photo-wrong', subject: 'Wrong 1', heading: 'h', body: '{{photo_line}}', button_label: 'Subir', button_url: '{{settings_url}}', is_active: true };
const TW2 = { id: 'tw2', key: 'photo-wrong-reminder', subject: 'Wrong 2', heading: 'h', body: '{{photo_line}}', button_label: 'Subir', button_url: '{{settings_url}}', is_active: true };
const TK = { id: 'tk', key: 'photo-wrong-kept', subject: 'Kept', heading: 'h', body: '{{photo_line}}', button_label: 'Subir', button_url: '{{settings_url}}', is_active: true };

function setup(users, { wrong = true } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [TF1, TW1, TW2, TK]);
  db.seed('automations', [
    { id: PHOTO_FACE_ID, enabled: true, enabled_at: iso(NOW - 30 * 24 * H), milestones: [24, 72, 168], template_id: TF1.id, reminder_template_id: TF1.id },
    { id: PHOTO_WRONG_ID, enabled: wrong, enabled_at: wrong ? iso(NOW - 3 * H) : null, milestones: [2, 48, 168], template_id: TW1.id, reminder_template_id: TW2.id, gift_template_id: TK.id },
  ]);
  db.seed('users', users);
  const sent = [];
  const run = async (atMs = NOW) => {
    const [a] = await db.select('automations', `id=eq.${PHOTO_FACE_ID}`);
    const [w] = await db.select('automations', `id=eq.${PHOTO_WRONG_ID}`);
    return runPhotoFace({
      db, automation: a, wrongAutomation: w, templates: await db.select('email_templates', ''), now: new Date(atMs),
      deliver: async (m) => { sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
      frame: { brand: 'Casa-Libre', tld: '.py', countryName: 'Paraguay' }, siteUrl: SITE,
    });
  };
  return { db, sent, run };
}

test('run: rejected upload → wrong-photo emails until a valid photo; kept → one email; "?" → wrong emails; logo → face emails', async () => {
  const s = setup([
    acct('none', null, { rejectedH: 3, what: 'house' }),
    acct('kept', 'face', { rejectedH: 3, what: 'apartment' }),
    acct('q', 'other'),
    acct('logo', 'logo', { approvedH: 25 }),
  ]);
  const r = await s.run();
  assert.equal(r.sent, 4);
  const by = Object.fromEntries(s.sent.map((m) => [m.to, m]));
  assert.equal(by['none@x.com'].subject, 'Wrong 1');
  assert.match(by['none@x.com'].html, /una casa/);
  assert.equal(by['kept@x.com'].subject, 'Kept');
  assert.match(by['kept@x.com'].html, /un departamento/);
  assert.equal(by['q@x.com'].subject, 'Wrong 1');
  assert.match(by['q@x.com'].html, /no muestra tu cara ni el logo/);
  assert.equal(by['logo@x.com'].subject, 'Cara');
  assert.match(by['logo@x.com'].html, /tenés un logo/);

  assert.equal((await s.run()).sent, 0);                                 // nothing twice
  // "none" uploads a logo before day 2 → wrong-photo emails stop (the face emails take over later)
  await s.db.update('users', 'id=eq.none', {
    profile_photo_status: 'approved', profile_photo_url: 'https://x/none.jpg', profile_photo_key: 'avatars/none/k2.jpg',
    profile_photo_checked_at: iso(NOW + 10 * H), profile_photo_kind: 'logo', profile_photo_kind_key: 'avatars/none/k2.jpg',
  });
  const before = s.sent.length;
  await s.run(NOW + 48 * H);
  const later = s.sent.slice(before);
  assert.ok(!later.some((m) => m.to === 'none@x.com' && /Wrong/.test(m.subject)));
  assert.ok(later.some((m) => m.to === 'q@x.com' && m.subject === 'Wrong 2'));   // "?" gets the reminder
  assert.ok(!later.some((m) => m.to === 'kept@x.com'));                         // kept: only ONE email
  assert.ok(later.some((m) => m.to === 'none@x.com' && m.subject === 'Cara'));  // logo now → face emails
});

test('run: wrong-photo part off → only the face emails, as before', async () => {
  const s = setup([acct('none', null, { rejectedH: 3 }), acct('q', 'other'), acct('logo', 'logo', { approvedH: 25 })], { wrong: false });
  const r = await s.run();
  assert.equal(r.sent, 1);
  assert.equal(s.sent[0].to, 'logo@x.com');
});
