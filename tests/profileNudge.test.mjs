import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import {
  runProfileNudge, pickProfileNudges, profileNudgeConfig, normalizeSteps, settingsLink, progressLine, startedProfile,
  PROFILE_NUDGE_ID, DEFAULT_STEPS, LATE_GRACE_HOURS,
} from '../lib/automations/profileNudge.js';
import { userCompletion, isPersonalized } from '../lib/profileCompletion.js';

const H = 3600e3;
const NOW = Date.parse('2026-11-17T15:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const SITE = 'https://casa-libre.com.py';

const TPL1 = { id: 'tpl-p1', key: 'profile-personalize', name: 'p1', subject: 'Personalizá tu perfil', heading: 'Hola', body: 'Hola {{name}}. {{progress_line}}', button_label: 'Personalizar', button_url: '{{settings_url}}', is_active: true };
const TPL2 = { id: 'tpl-p2', key: 'profile-personalize-reminder', name: 'p2', subject: 'Tu perfil al {{progress_pct}} %', heading: 'Hola', body: '{{progress_line}}', button_label: 'Completar', button_url: '{{settings_url}}', is_active: true };

const user = (id, signedHoursAgo, extra = {}) => ({ id, email: `${id}@x.com`, full_name: `Ana ${id}`, verified: true, active: true, blocked: false, suspended: false, created_at: iso(NOW - signedHoursAgo * H), ...extra });
const PERSONALIZED = { first_name: 'Ana', last_name: 'López', job_title: 'Agente', profile_photo_url: 'https://x/p.jpg', profile_photo_status: 'approved' };
const COMPLETE = { ...PERSONALIZED, company_name: 'Inmo', company_website: 'https://inmo.com.py', phone_verified_at: iso(NOW) };

// ── completion / "personalized" ───────────────────────────────────────────────

test('userCompletion: from a users row — full_name split when never saved, approved photo, verified WhatsApp', () => {
  assert.equal(userCompletion({ full_name: 'Ana López' }).count, 2);
  assert.equal(userCompletion({}).count, 0);
  assert.equal(userCompletion(COMPLETE).count, 7);
  assert.equal(userCompletion({ ...COMPLETE, profile_photo_url: null }).count, 6);
  assert.equal(userCompletion({ first_name: 'Ana', full_name: 'Ana López' }).done.last_name, false);   // saved columns win
});

test('isPersonalized: photo + first + last name + (title or company), or all 7', () => {
  assert.equal(isPersonalized(userCompletion(PERSONALIZED)), true);
  assert.equal(isPersonalized(userCompletion({ ...PERSONALIZED, job_title: null, company_name: 'Inmo' })), true);
  assert.equal(isPersonalized(userCompletion({ ...PERSONALIZED, job_title: null })), false);         // no title / company
  assert.equal(isPersonalized(userCompletion({ ...PERSONALIZED, profile_photo_url: null })), false);  // no photo
  assert.equal(isPersonalized(userCompletion({ ...PERSONALIZED, last_name: '' })), false);           // no last name
  assert.equal(isPersonalized(userCompletion(COMPLETE)), true);
  assert.equal(isPersonalized(userCompletion({ full_name: 'Ana López', company_website: 'x.com', phone_verified_at: iso(NOW) })), false);
});

// ── settings + scheduling ─────────────────────────────────────────────────────

test('normalizeSteps: whole hours 0–1440, unique, ascending, at most 5', () => {
  assert.deepEqual(normalizeSteps([48, '0', 24, 24, -1, 2000, 1.5]), [0, 24, 48]);
  assert.deepEqual(normalizeSteps([1, 2, 3, 4, 5, 6]), [1, 2, 3, 4, 5]);
  assert.deepEqual(normalizeSteps(null), []);
});

test('profileNudgeConfig: no row = off with default steps 0/24/48 h; later steps fall back to the first template', () => {
  assert.deepEqual(DEFAULT_STEPS, [0, 24, 48]);
  const off = profileNudgeConfig(null);
  assert.equal(off.enabled, false);
  assert.deepEqual(off.steps, [0, 24, 48]);
  assert.equal(profileNudgeConfig({ enabled: true }).enabled, false);   // never stamped enabled_at
  const c = profileNudgeConfig({ enabled: true, enabled_at: iso(NOW), milestones: [24, 0], template_id: 't1' });
  assert.equal(c.enabled, true);
  assert.deepEqual(c.steps, [0, 24]);
  assert.deepEqual(c.templateIds, ['t1', 't1']);
  assert.deepEqual(profileNudgeConfig({ milestones: [], template_id: 't1', reminder_template_id: 't2' }).templateIds, ['t1', 't2']);
  assert.deepEqual(profileNudgeConfig({ milestones: [] }).steps, [0, 24, 48]);
});

test('settingsLink: Settings with the UTM tags the brief asks for', () => {
  assert.equal(settingsLink(`${SITE}/`, 2), `${SITE}/cuenta/ajustes?utm_source=email&utm_medium=automation&utm_campaign=profile_personalization&utm_content=email2`);
});

test('pickProfileNudges: verified, open, not personalized, not opted out — step by hours since sign-up', () => {
  const users = [
    user('a', 0.5),                                          // ✓ step 1 (0 h)
    user('b', 30),                                           // ✓ step 2 (24 h), both due → latest
    user('c', 1, { verified: false }),
    user('d', 1, { email: 'deleted-d@deleted.invalid' }),
    user('e', 1, { blocked: true }),
    user('f', 1, { ...PERSONALIZED }),                       // personalized → nothing
    user('g', 1, { ...COMPLETE }),                           // complete → nothing
    user('h', 1),                                            // opted out
    user('i', 48 + LATE_GRACE_HOURS + 1),                    // came due too long ago
    user('j', 1, { suspended: true }),
  ];
  const picked = pickProfileNudges({ users, steps: [0, 24, 48], nowMs: NOW, stopped: new Set(['h']) });
  assert.deepEqual(picked.map((p) => [p.user.id, p.step]), [['a', 1], ['b', 2]]);
});

test('pickProfileNudges: never repeats a step; +24 h then +48 h', () => {
  const one = (hours, last) => pickProfileNudges({ users: [user('a', hours)], steps: [0, 24, 48], nowMs: NOW, lastSent: new Map(last ? [['a', last]] : []) })[0]?.step || 0;
  assert.equal(one(1, 0), 1);
  assert.equal(one(1, 1), 0);
  assert.equal(one(23, 1), 0);
  assert.equal(one(25, 1), 2);
  assert.equal(one(47, 2), 0);
  assert.equal(one(49, 2), 3);
  assert.equal(one(60, 3), 0);
});

test('progressLine: not started vs started but not finished', () => {
  assert.match(progressLine({ full_name: 'Ana López' }), /^Todavía no personalizaste tu perfil\. Te falta: foto o logo, cargo/);
  assert.equal(startedProfile({ full_name: 'Ana López' }), false);
  const started = { first_name: 'Ana', last_name: 'López', job_title: 'Agente' };
  assert.equal(startedProfile(started), true);
  assert.match(progressLine(started), /^Ya empezaste: tu perfil está al 43 % \(3 de 7\)\. Te falta: foto o logo, empresa, sitio web, WhatsApp confirmado\.$/);
});

// ── run ───────────────────────────────────────────────────────────────────────

function setup({ automation = {}, users = [] } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [TPL1, TPL2]);
  db.seed('automations', [{ id: PROFILE_NUDGE_ID, enabled: true, enabled_at: iso(NOW - 30 * 24 * H), milestones: [0, 24, 48], template_id: TPL1.id, reminder_template_id: TPL2.id, ...automation }]);
  db.seed('users', users);
  const sent = [];
  const run = async (atMs = NOW, extra = {}) => {
    const [a] = await db.select('automations', `id=eq.${PROFILE_NUDGE_ID}`);
    return runProfileNudge({
      db, automation: a, templates: await db.select('email_templates', ''), now: new Date(atMs),
      deliver: async (m) => { sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
      frame: { brand: 'Casa-Libre', tld: '.py', countryName: 'Paraguay' }, siteUrl: SITE, ...extra,
    });
  };
  return { db, sent, run };
}

test('run: sign-up email, +24 h, +48 h — each once, with the Settings link; stops once personalized', async () => {
  const s = setup({ users: [user('a', 0.2), user('b', 0.2, { ...PERSONALIZED })] });
  const r1 = await s.run();
  assert.equal(r1.sent, 1);
  assert.equal(s.sent[0].to, 'a@x.com');
  assert.equal(s.sent[0].subject, 'Personalizá tu perfil');
  assert.match(s.sent[0].html, /\/cuenta\/ajustes\?utm_source=email&amp;utm_medium=automation&amp;utm_campaign=profile_personalization&amp;utm_content=email1/);
  assert.match(s.sent[0].text, /Hola Ana\. Todavía no personalizaste tu perfil/);
  assert.equal((await s.run(NOW + H)).sent, 0);             // same step: never twice
  assert.equal((await s.run(NOW + 25 * H)).sent, 1);         // +24 h
  assert.equal(s.sent[1].subject, 'Tu perfil al 29 %');
  assert.equal((await s.run(NOW + 26 * H)).sent, 0);
  // they personalize before +48 h → nothing more
  await s.db.update('users', 'id=eq.a', { ...PERSONALIZED });
  assert.equal((await s.run(NOW + 49 * H)).sent, 0);
  const logs = await s.db.select('email_log', `automation_id=eq.${PROFILE_NUDGE_ID}`);
  assert.deepEqual(logs.map((l) => l.dedupe_key).sort(), ['profile:a:1', 'profile:a:2']);
});

test('run: override address, onlyUserIds, opt-out rows, off / no template', async () => {
  const s = setup({ users: [user('a', 1), user('b', 1), user('c', 1)] });
  s.db.seed('email_log', [{ id: 'stop', automation_id: 'referral_promo', run_id: 'c', dedupe_key: 'refpromo-stop:c:ev', subject: 'unsubscribed', status: 'event' }]);
  const r = await s.run(NOW, { emailOverride: 'omar@airosofts.com', onlyUserIds: ['a', 'c'] });
  assert.equal(r.sent, 1);
  assert.deepEqual(s.sent.map((m) => m.to), ['omar@airosofts.com']);

  const off = setup({ automation: { enabled: false }, users: [user('a', 1)] });
  assert.equal((await off.run()).skippedReason, 'disabled');
  const noTpl = setup({ automation: { template_id: null, reminder_template_id: null }, users: [user('a', 1)] });
  assert.equal((await noTpl.run()).skippedReason, 'no_template');
  const quiet = setup({ users: [user('a', 1)] });
  const q = await quiet.run(NOW, { frame: { quiet: true } });
  assert.equal(q.sent, 0);
  assert.equal(quiet.sent.length, 0);
});

// ── buyer or seller (lib/userType.js) ─────────────────────────────────────────

test('pick: buyers who never listed are skipped; sellers, buyers who listed and unknown types are kept', () => {
  const users = [
    user('s', 1, { user_type: 'seller' }),
    user('b', 1, { user_type: 'buyer' }),
    user('bl', 1, { user_type: 'buyer', first_listed_at: iso(NOW - H) }),
    user('bp', 1, { user_type: 'buyer' }),
    user('u', 1, { user_type: null }),
    user('old', 1),   // no column at all (migration not run) → as before
  ];
  const due = pickProfileNudges({ users, listings: new Map([['bp', 2]]), nowMs: NOW });
  assert.deepEqual(due.map((d) => d.user.id).sort(), ['bl', 'bp', 'old', 's', 'u']);
});

test('run: a buyer is not emailed, a buyer owning a listing is; works when the type columns are missing', async () => {
  const s = setup({ users: [user('s', 1, { user_type: 'seller' }), user('b', 1, { user_type: 'buyer' }), user('bp', 1, { user_type: 'buyer' })] });
  s.db.seed('properties', [{ id: 'p1', created_by: 'bp' }]);
  const r = await s.run();
  assert.equal(r.sent, 2);
  assert.deepEqual(s.sent.map((m) => m.to).sort(), ['bp@x.com', 's@x.com']);

  // a DB without user_type / first_listed_at: the first select throws → falls back, everyone as before
  const t = setup({ users: [user('a', 1), user('c', 1)] });
  const realSelect = t.db.select.bind(t.db);
  t.db.select = async (table, q) => {
    if (table === 'users' && /user_type/.test(q)) throw Object.assign(new Error('column users.user_type does not exist'), { status: 400 });
    return realSelect(table, q);
  };
  assert.equal((await t.run()).sent, 2);
});
