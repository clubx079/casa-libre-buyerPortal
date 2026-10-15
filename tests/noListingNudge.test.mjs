import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import {
  runNoListingNudge, pickNudges, nudgeConfig, normalizeDays, publishLink, NO_LISTING_AUTOMATION_ID, LATE_GRACE_DAYS,
} from '../lib/automations/noListingNudge.js';
import { guestOwnerId } from '../lib/guestDrafts.js';

const H = 3600e3;
const D = 24 * H;
const NOW = Date.parse('2026-10-15T15:00:00Z');   // 12:00 in Asunción (daytime)
const iso = (ms) => new Date(ms).toISOString();
const SITE = 'https://casa-libre.com.py';

const TPL1 = { id: 'tpl-welcome', key: 'no-listing-welcome', name: 'w', subject: 'Bienvenido a Casa Libre', heading: 'Hola', body: 'Hola {{name}}, publicá gratis.', button_label: 'Publicar gratis', button_url: '{{publish_url}}', is_active: true };
const TPL2 = { id: 'tpl-last', key: 'no-listing-reminder', name: 'r', subject: 'Último aviso', heading: 'Hola', body: 'Hola {{name}}.', button_label: 'Publicar', button_url: '{{publish_url}}', is_active: true };

const user = (id, signedDaysAgo, extra = {}) => ({ id, email: `${id}@x.com`, full_name: `Ana ${id}`, verified: true, active: true, blocked: false, suspended: false, created_at: iso(NOW - signedDaysAgo * D), ...extra });

// ── pure ─────────────────────────────────────────────────────────────────────

test('normalizeDays: whole days 1–60, unique, ascending, at most 2', () => {
  assert.deepEqual(normalizeDays([7, '2', 2, 0, 99, 1.5]), [2, 7]);
  assert.deepEqual(normalizeDays([1, 2, 3]), [1, 2]);
  assert.deepEqual(normalizeDays(null), []);
});

test('nudgeConfig: no row = off; default 2 days; second template falls back to the first', () => {
  assert.equal(nudgeConfig(null).enabled, false);
  assert.equal(nudgeConfig({ enabled: true }).enabled, false);   // never stamped enabled_at
  const c = nudgeConfig({ enabled: true, enabled_at: iso(NOW), milestones: null, wait_days: 0, template_id: 't1' });
  assert.deepEqual(c.days, [2]);
  assert.deepEqual(c.templateIds, ['t1', 't1']);
  assert.deepEqual(nudgeConfig({ enabled: true, enabled_at: iso(NOW), milestones: [2, 7], template_id: 't1', reminder_template_id: 't2' }).templateIds, ['t1', 't2']);
});

test('publishLink: sell wizard with UTM tags', () => {
  assert.equal(publishLink(`${SITE}/`, 2), `${SITE}/publicar?utm_source=email&utm_medium=automation&utm_campaign=no_listing_nudge&utm_content=email2`);
});

test('pickNudges: only verified, open accounts with no listing and no draft, once the wait has passed', () => {
  const users = [
    user('a', 3),                                        // ✓
    user('b', 1),                                        // too early
    user('c', 3, { verified: false }),                   // not verified
    user('d', 3, { email: 'deleted-d@deleted.invalid' }),// deleted account
    user('e', 3, { blocked: true }),                     // blocked
    user('f', 3),                                        // has a listing
    user('g', 3),                                        // has an account draft
    user('h', 3),                                        // has a guest draft with their email
    user('i', 3, { active: false }),                     // closed
    user('j', 2 + LATE_GRACE_DAYS + 1),                  // came due too long ago
  ];
  const picked = pickNudges({
    users, days: [2], nowMs: NOW,
    listers: new Set(['f']), drafters: new Set(['g', guestOwnerId('h@x.com')]),
  });
  assert.deepEqual(picked.map((p) => [p.user.id, p.step]), [['a', 1]]);
});

test('pickNudges: second email after the extra days; never repeats a step; late signups get only the latest', () => {
  const days = [2, 7];
  const one = (signed, last) => pickNudges({ users: [user('a', signed)], days, nowMs: NOW, lastSent: new Map(last ? [['a', last]] : []) })[0]?.step || 0;
  assert.equal(one(3, 0), 1);
  assert.equal(one(3, 1), 0);   // first already sent
  assert.equal(one(8, 1), 2);
  assert.equal(one(8, 0), 2);   // both due at once → only the second
  assert.equal(one(8, 2), 0);
});

// ── run ──────────────────────────────────────────────────────────────────────

function setup({ automation = {}, users = [] } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [TPL1, TPL2]);
  db.seed('automations', [{ id: NO_LISTING_AUTOMATION_ID, enabled: true, enabled_at: iso(NOW - 30 * D), wait_days: 2, milestones: [2, 7], template_id: TPL1.id, reminder_template_id: TPL2.id, ...automation }]);
  db.seed('users', users);
  const sent = [];
  let fail = false;
  const run = async (atMs = NOW, extra = {}) => {
    const [a] = await db.select('automations', `id=eq.${NO_LISTING_AUTOMATION_ID}`);
    return runNoListingNudge({
      db, automation: a, templates: await db.select('email_templates', ''), now: new Date(atMs), countryCode: 'py',
      deliver: async (m) => { if (fail) return { ok: false, error: 'boom' }; sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
      frame: { brand: 'Casa Libre', tld: '.py', countryName: 'Paraguay' }, siteUrl: SITE, ...extra,
    });
  };
  return { db, sent, run, setFail: (v) => { fail = v; } };
}

test('run: emails the user once per step, with the wizard link, and stops when they list', async () => {
  const s = setup({ users: [user('a', 3), user('b', 3), user('c', 3)] });
  s.db.seed('properties', [{ id: 'p1', created_by: 'b', status: 'pending' }]);
  s.db.seed('listing_drafts', [{ id: 'dr1', user_id: 'c', data: {}, updated_at: iso(NOW) }]);
  const r1 = await s.run();
  assert.equal(r1.sent, 1);
  assert.equal(s.sent[0].to, 'a@x.com');
  assert.equal(s.sent[0].subject, 'Bienvenido a Casa Libre');
  assert.match(s.sent[0].html, /\/publicar\?utm_source=email&amp;utm_medium=automation&amp;utm_campaign=no_listing_nudge&amp;utm_content=email1/);
  assert.match(s.sent[0].text, /Hola Ana/);

  assert.equal((await s.run(NOW + H)).sent, 0);   // already sent

  const r2 = await s.run(NOW + 5 * D);             // a signed up 8 days ago → second email
  assert.equal(r2.sent, 1);
  assert.equal(s.sent[1].subject, 'Último aviso');
  assert.match(s.sent[1].html, /utm_content=email2/);
  const logs = await s.db.select('email_log', `automation_id=eq.${NO_LISTING_AUTOMATION_ID}`);
  assert.deepEqual(logs.map((l) => l.dedupe_key).sort(), ['nolisting:a:1', 'nolisting:a:2']);

  // Someone who lists before the second email gets nothing more.
  const t = setup({ users: [user('z', 3)] });
  await t.run();
  t.db.seed('properties', [{ id: 'pz', created_by: 'z', status: 'active' }]);
  assert.equal((await t.run(NOW + 5 * D)).sent, 0);
});

test('run: off / no row / no template / night → nothing sent', async () => {
  const off = setup({ automation: { enabled: false }, users: [user('a', 3)] });
  assert.equal((await off.run()).skippedReason, 'disabled');
  const none = await runNoListingNudge({ db: createStore(AUTOMATION_SCHEMA), automation: undefined, deliver: async () => ({ ok: true }) });
  assert.equal(none.skippedReason, 'disabled');
  const noTpl = setup({ automation: { template_id: 'missing' }, users: [user('a', 3)] });
  assert.equal((await noTpl.run()).skippedReason, 'no_template');
  const night = setup({ users: [user('a', 3)] });
  assert.equal((await night.run(Date.parse('2026-10-15T05:00:00Z'))).skippedReason, 'night');   // 02:00 Asunción
  assert.equal(night.sent.length, 0);
});

test('run: one email only (no second step) when a single wait is set', async () => {
  const s = setup({ automation: { milestones: [2], reminder_template_id: null }, users: [user('a', 3)] });
  assert.equal((await s.run()).sent, 1);
  assert.equal((await s.run(NOW + 10 * D)).sent, 0);
});

test('run: test override sends to the test address; a failed send is retried next run', async () => {
  const s = setup({ users: [user('a', 3)] });
  s.setFail(true);
  assert.equal((await s.run()).failed, 1);
  assert.equal((await s.db.select('email_log', '')).length, 0);
  s.setFail(false);
  const r = await s.run(NOW + H, { emailOverride: 'qa@x.com' });
  assert.equal(r.sent, 1);
  assert.equal(s.sent[0].to, 'qa@x.com');
});
