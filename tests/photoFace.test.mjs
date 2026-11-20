import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import { runPhotoFace, pickPhotoFace, photoFaceConfig, photoLine, settingsLink, PHOTO_FACE_ID, DEFAULT_STEPS } from '../lib/automations/photoFace.js';
import { parseKind, kindIsCurrent, needsFace } from '../lib/profilePhotoKind.js';

const H = 3600e3;
const NOW = Date.parse('2026-11-20T15:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const SITE = 'https://casa-libre.com.py';
const TPL1 = { id: 'tpl-f1', key: 'photo-face', name: 'f1', subject: 'Tu foto', heading: 'Hola', body: 'Hola {{name}}. {{photo_line}}', button_label: 'Cambiar foto', button_url: '{{settings_url}}', is_active: true };
const TPL2 = { id: 'tpl-f2', key: 'photo-face-reminder', name: 'f2', subject: 'Recordatorio', heading: 'Hola', body: '{{photo_line}}', button_label: 'Cambiar foto', button_url: '{{settings_url}}', is_active: true };

// an account whose current approved photo (key k1) was approved `hoursAgo` and checked as `kind`
const user = (id, hoursAgo, kind = 'logo', extra = {}) => ({
  id, email: `${id}@x.com`, full_name: `Ana ${id}`, verified: true, active: true, blocked: false, suspended: false,
  profile_photo_status: 'approved', profile_photo_url: `https://x/${id}.jpg`, profile_photo_key: `avatars/${id}/k1.jpg`,
  profile_photo_checked_at: iso(NOW - hoursAgo * H), profile_photo_kind: kind, profile_photo_kind_key: `avatars/${id}/k1.jpg`, ...extra,
});

test('parseKind: one word, tolerant of extra text; anything else = unclear', () => {
  assert.equal(parseKind('FACE'), 'face');
  assert.equal(parseKind(' logo.'), 'logo');
  assert.equal(parseKind('Answer: OTHER'), 'other');
  assert.equal(parseKind('PASS'), null);
  assert.equal(parseKind(''), null);
});

test('kind belongs to one photo: a new photo (other key) needs a new check; face never needs the email', () => {
  assert.equal(kindIsCurrent(user('a', 1)), true);
  assert.equal(kindIsCurrent(user('a', 1, 'logo', { profile_photo_key: 'avatars/a/k2.jpg' })), false);
  assert.equal(needsFace(user('a', 1, 'logo')), true);
  assert.equal(needsFace(user('a', 1, 'other')), true);
  assert.equal(needsFace(user('a', 1, 'face')), false);
  assert.equal(needsFace(user('a', 1, 'logo', { profile_photo_status: 'rejected' })), false);
  assert.equal(needsFace(user('a', 1, 'logo', { profile_photo_key: 'avatars/a/k2.jpg' })), false);   // not checked yet
});

test('config: default 1, 3 and 7 days; off unless enabled with a date', () => {
  assert.deepEqual(DEFAULT_STEPS, [24, 72, 168]);
  assert.equal(photoFaceConfig(null).enabled, false);
  assert.equal(photoFaceConfig({ enabled: true }).enabled, false);
  assert.deepEqual(photoFaceConfig({ enabled: true, enabled_at: iso(NOW), milestones: [48, 0, 48] }).steps, [0, 48]);
});

test('pick: only verified, open accounts with a logo/other photo, on schedule', () => {
  const users = [
    user('logo', 30), user('face', 30, 'face'), user('early', 5),
    user('closed', 30, 'logo', { active: false }), user('unverified', 30, 'logo', { verified: false }),
    user('stop', 30), user('old', 24 * 30),
  ];
  const r = pickPhotoFace({ users, stopped: new Set(['stop']), steps: DEFAULT_STEPS, nowMs: NOW });
  assert.deepEqual(r.map((x) => [x.user.id, x.step]), [['logo', 1]]);
});

test('lines and link', () => {
  assert.match(photoLine('logo'), /logo o un texto/);
  assert.match(photoLine('other'), /no muestra tu cara/);
  assert.match(settingsLink(SITE, 2), /\/cuenta\/ajustes\?utm_source=email&utm_medium=automation&utm_campaign=profile_photo_face&utm_content=email2$/);
});

function setup(users) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [TPL1, TPL2]);
  db.seed('automations', [{ id: PHOTO_FACE_ID, enabled: true, enabled_at: iso(NOW - 30 * 24 * H), milestones: [24, 72, 168], template_id: TPL1.id, reminder_template_id: TPL2.id }]);
  db.seed('users', users);
  const sent = [];
  const run = async (atMs = NOW, extra = {}) => {
    const [a] = await db.select('automations', `id=eq.${PHOTO_FACE_ID}`);
    return runPhotoFace({
      db, automation: a, templates: await db.select('email_templates', ''), now: new Date(atMs),
      deliver: async (m) => { sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
      frame: { brand: 'Casa-Libre', tld: '.py', countryName: 'Paraguay' }, siteUrl: SITE, ...extra,
    });
  };
  return { db, sent, run };
}

test('run: day 1, day 3, day 7 — each once; checked again before each; stops when the photo is a face', async () => {
  const s = setup([user('a', 25), user('b', 25, 'face')]);
  const r1 = await s.run();
  assert.equal(r1.sent, 1);
  assert.equal(s.sent[0].to, 'a@x.com');
  assert.match(s.sent[0].html || s.sent[0].text || JSON.stringify(s.sent[0]), /logo o un texto/);
  assert.equal((await s.run()).sent, 0);                      // same step never twice
  assert.equal((await s.run(NOW + 48 * H)).sent, 1);           // day 3 → reminder
  // a uploads a real photo before day 7 → no more emails
  await s.db.update('users', 'id=eq.a', { profile_photo_kind: 'face' });
  assert.equal((await s.run(NOW + 150 * H)).sent, 0);
  assert.equal(s.sent.length, 2);
});

test('run: photo checks happen first; off / no template → nothing', async () => {
  const s = setup([user('a', 25)]);
  let checks = 0;
  const r = await s.run(NOW, { classifyMissing: async () => { checks++; return { checked: 0 }; } });
  assert.equal(checks, 1);
  assert.equal(r.sent, 1);
  await s.db.update('automations', `id=eq.${PHOTO_FACE_ID}`, { enabled: false });
  assert.equal((await s.run(NOW + 48 * H)).skippedReason, 'disabled');
});
