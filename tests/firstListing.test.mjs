import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import { runFirstListing, AUTOMATION_ID } from '../lib/automations/firstListing.js';

const DAY = 86400000;
const T0 = Date.parse('2026-10-01T12:00:00Z');       // automation switched on
const iso = (ms) => new Date(ms).toISOString();

function setup({ enabled = true } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [
    { id: 'tg', key: 'first-listing-gift', name: 'Gift', subject: '{{name}}, regalo', heading: 'Regalo', body: 'Hola {{name}}, {{property_title}} hasta {{free_until}}', button_label: 'Ver', button_url: '{{property_url}}' },
    { id: 'tr', key: 'first-listing-ending', name: 'Ending', subject: 'Termina {{free_until}}', heading: 'Quedan {{days_left}} días', body: 'Extendé por {{price}}', button_label: 'Extender por {{price}}', button_url: '{{extend_url}}' },
  ]);
  db.seed('automations', [{ id: AUTOMATION_ID, enabled, enabled_at: iso(T0), wait_days: 2, free_days: 30, remind_days_before: 3, gift_template_id: 'tg', reminder_template_id: 'tr' }]);
  db.seed('users', [
    { id: 'u1', email: 'ana@x.com', full_name: 'Ana Pérez' },
    { id: 'u2', email: 'bo@x.com', full_name: 'Bo' },
  ]);
  const sent = [];
  const grants = [];
  const deps = {
    db,
    deliver: async (m) => { sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
    grant: async (pid, days, now) => { grants.push([pid, days]); const until = iso(now.getTime() + days * DAY); await db.update('properties', `id=eq.${pid}`, { promotion_plan: 'home', promotion_expires_at: until }); return until; },
    frame: { brand: 'Casa Libre', tld: '.py', countryName: 'Paraguay' },
    siteUrl: 'https://casa-libre.com.py',
    extendUrl: (run) => `https://casa-libre.com.py/api/promo/extend?token=tok-${run.property_id}`,
    formatDate: (s) => s.slice(0, 10),
    price: 'US$20',
  };
  const run = async (atMs, extra = {}) => {
    const automation = (await db.select('automations', `id=eq.${AUTOMATION_ID}`))[0];
    const templates = await db.select('email_templates', '');
    return runFirstListing({ ...deps, automation, templates, now: new Date(atMs), ...extra });
  };
  return { db, sent, grants, run, deps };
}

const listing = (id, user, createdMs, extra = {}) => ({
  id, created_by: user, origin: 'user', created_at: iso(createdMs), admin_status: 'active', is_complete: true,
  feature_image_url: 'https://img/x.jpg', property_type: 'Casa', neighborhood: 'Villa Morra', promotion_plan: null, promotion_expires_at: null, ...extra,
});

test('disabled automation does nothing', async () => {
  const s = setup({ enabled: false });
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  const r = await s.run(T0 + 5 * DAY);
  assert.equal(r.skippedReason, 'disabled');
  assert.equal(s.sent.length, 0);
});

test('gifts a first listing once it is wait_days old, and only once', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  await s.run(T0 + 2 * DAY);                 // only 1 day old → not yet
  assert.equal(s.sent.length, 0);
  const r = await s.run(T0 + 3.5 * DAY);
  assert.equal(r.gifted, 1);
  assert.deepEqual(s.grants, [['p1', 30]]);
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].to, 'ana@x.com');
  assert.equal(s.sent[0].subject, 'Ana, regalo');
  assert.match(s.sent[0].html, /Casa · Villa Morra/);
  assert.match(s.sent[0].html, /href="https:\/\/casa-libre\.com\.py\/propiedad\/p1"/);
  const runs = await s.db.select('automation_runs', '');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, 'gifted');
  const log = await s.db.select('email_log', '');
  assert.equal(log[0].status, 'sent');
  assert.equal(log[0].resend_id, 're_1');
  await s.run(T0 + 4 * DAY);                 // again → nothing new
  assert.equal(s.sent.length, 1);
  assert.equal(s.grants.length, 1);
});

test('user with a listing before switch-on is skipped as not_first', async () => {
  const s = setup();
  s.db.seed('properties', [listing('old', 'u1', T0 - 10 * DAY), listing('p2', 'u1', T0 + DAY)]);
  const r = await s.run(T0 + 5 * DAY);
  assert.equal(r.skipped, 1);
  const runs = await s.db.select('automation_runs', '');
  assert.equal(runs[0].skip_reason, 'not_first');
  assert.equal(s.sent.length, 0);
  assert.equal(s.grants.length, 0);
});

test('no photo / inactive / already promoted are skipped with a reason', async () => {
  const s = setup();
  s.db.seed('users', [{ id: 'u3', email: 'c@x.com', full_name: 'C' }]);
  s.db.seed('properties', [
    listing('p1', 'u1', T0 + DAY, { feature_image_url: null }),
    listing('p2', 'u2', T0 + DAY, { admin_status: 'hidden' }),
    listing('p3', 'u3', T0 + DAY, { promotion_plan: 'home', promotion_expires_at: iso(T0 + 40 * DAY) }),
  ]);
  await s.run(T0 + 5 * DAY);
  const reasons = (await s.db.select('automation_runs', '')).map((r) => `${r.user_id}:${r.skip_reason}`).sort();
  assert.deepEqual(reasons, ['u1:no_photo', 'u2:inactive', 'u3:already_promoted']);
  assert.equal(s.sent.length, 0);
});

test('reminder goes out remind_days_before the end, once, with the extend link', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  const giftAt = T0 + 3 * DAY;
  await s.run(giftAt);
  await s.run(giftAt + 26 * DAY);            // 4 days left → too early
  assert.equal(s.sent.length, 1);
  const r = await s.run(giftAt + 27.5 * DAY); // 2.5 days left → remind
  assert.equal(r.reminded, 1);
  assert.equal(s.sent.length, 2);
  assert.match(s.sent[1].html, /href="https:\/\/casa-libre\.com\.py\/api\/promo\/extend\?token=tok-p1"/);
  assert.match(s.sent[1].html, /Extender por US\$20/);
  assert.match(s.sent[1].subject, /^Termina /);
  await s.run(giftAt + 28 * DAY);
  assert.equal(s.sent.length, 2);
  assert.equal((await s.db.select('automation_runs', ''))[0].status, 'reminded');
});

test('a successful payment after the gift converts the run (no reminder)', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  const giftAt = T0 + 3 * DAY;
  await s.run(giftAt);
  s.db.seed('payments', [{ property_id: 'p1', user_id: 'u1', status: 'succeeded', created_at: iso(giftAt + 5 * DAY), amount_usd: 20 }]);
  const r = await s.run(giftAt + 28 * DAY);
  assert.equal(r.converted, 1);
  assert.equal(s.sent.length, 1);
  assert.equal((await s.db.select('automation_runs', ''))[0].status, 'converted');
});

test('runs past free_until are marked done', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  const giftAt = T0 + 3 * DAY;
  await s.run(giftAt);
  await s.run(giftAt + 28 * DAY);
  const r = await s.run(giftAt + 31 * DAY);
  assert.equal(r.done, 1);
  assert.equal((await s.db.select('automation_runs', ''))[0].status, 'done');
});

test('a failed send is retried on the next tick and never duplicated', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  let fail = true;
  const deliver = async (m) => { if (fail) return { ok: false, error: 'boom' }; s.sent.push(m); return { ok: true, id: 're_ok' }; };
  const r1 = await s.run(T0 + 3 * DAY, { deliver });
  assert.equal(r1.failed, 1);
  assert.equal((await s.db.select('email_log', '')).length, 0);
  assert.equal((await s.db.select('automation_runs', ''))[0].last_error, 'boom');
  fail = false;
  await s.run(T0 + 3.2 * DAY, { deliver });
  await s.run(T0 + 3.4 * DAY, { deliver });
  assert.equal(s.sent.length, 1);
  assert.equal(s.grants.length, 1);           // grant happened once, on the first tick
});

test('respects the per-tick limit', async () => {
  const s = setup();
  const users = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, email: `x${i}@x.com`, full_name: `X${i}` }));
  s.db.seed('users', users);
  s.db.seed('properties', users.map((u, i) => listing(`q${i}`, u.id, T0 + DAY + i)));
  const r = await s.run(T0 + 5 * DAY, { limit: 3 });
  assert.equal(r.gifted, 3);
  await s.run(T0 + 5.1 * DAY, { limit: 3 });
  assert.equal(s.sent.length, 5);
});

test('emailOverride redirects every automated email', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  await s.run(T0 + 3 * DAY, { emailOverride: 'omar@airosofts.com' });
  assert.equal(s.sent[0].to, 'omar@airosofts.com');
});
