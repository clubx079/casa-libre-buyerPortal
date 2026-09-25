import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import { runViewsMilestone, VIEWS_AUTOMATION_ID } from '../lib/automations/viewsMilestone.js';

const DAY = 86400000;
const T0 = Date.parse('2026-10-01T12:00:00Z');   // automation switched on
const iso = (ms) => new Date(ms).toISOString();

function setup({ enabled = true, milestones = [50] } = {}) {
  const db = createStore({ ...AUTOMATION_SCHEMA, unique: { ...AUTOMATION_SCHEMA.unique, listing_view_milestones: ['property_id'] } });
  db.seed('email_templates', [{ id: 'tv', key: 'listing-views', name: 'Views', subject: '{{property_title}} ya tiene {{views}} visitas', heading: 'Visitas', body: 'Hola {{name}}, [{{property_title}}]({{property_url}}) tiene **{{views}}** visitas.', button_label: 'Publicar otra propiedad', button_url: '{{publish_url}}' }]);
  db.seed('automations', [{ id: VIEWS_AUTOMATION_ID, enabled, enabled_at: iso(T0), milestones, template_id: 'tv' }]);
  db.seed('users', [{ id: 'u1', email: 'ana@x.com', full_name: 'Ana Pérez' }, { id: 'u2', email: 'bo@x.com', full_name: 'Bo' }]);
  const views = new Map();
  const sent = [];
  let fail = false;
  const run = async (atMs, extra = {}) => {
    const automation = (await db.select('automations', `id=eq.${VIEWS_AUTOMATION_ID}`))[0];
    const templates = await db.select('email_templates', '');
    return runViewsMilestone({
      db, automation, templates, now: new Date(atMs),
      fetchViews: async (ids) => new Map(ids.filter((id) => views.has(id)).map((id) => [id, views.get(id)])),
      deliver: async (m) => { if (fail) return { ok: false, error: 'boom' }; sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
      frame: { brand: 'Casa Libre', tld: '.py', countryName: 'Paraguay' },
      siteUrl: 'https://casa-libre.com.py',
      ...extra,
    });
  };
  return { db, views, sent, run, setFail: (v) => { fail = v; } };
}
const listing = (id, user, createdMs, extra = {}) => ({ id, created_by: user, origin: 'user', created_at: iso(createdMs), admin_status: 'active', property_type: 'Casa', neighborhood: 'Villa Morra', ...extra });

test('disabled automation does nothing', async () => {
  const s = setup({ enabled: false });
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  s.views.set('p1', 999);
  const r = await s.run(T0 + 2 * DAY);
  assert.equal(r.skippedReason, 'disabled');
  assert.equal(s.sent.length, 0);
});

test('emails once when a new listing reaches the view number, with the real count', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  s.views.set('p1', 30);
  await s.run(T0 + 2 * DAY);
  assert.equal(s.sent.length, 0);
  s.views.set('p1', 62);
  const r = await s.run(T0 + 3 * DAY);
  assert.equal(r.sent, 1);
  assert.equal(s.sent[0].to, 'ana@x.com');
  assert.equal(s.sent[0].subject, 'Casa · Villa Morra ya tiene 62 visitas');
  assert.match(s.sent[0].html, /href="https:\/\/casa-libre\.com\.py\/propiedad\/p1"[^>]*>Casa · Villa Morra<\/a>/);
  assert.match(s.sent[0].html, /href="https:\/\/casa-libre\.com\.py\/publicar"[^>]*>Publicar otra propiedad</);
  await s.run(T0 + 4 * DAY);
  assert.equal(s.sent.length, 1);
  const [st] = await s.db.select('listing_view_milestones', '');
  assert.equal(st.last_milestone, 50);
});

test('each further number is emailed once', async () => {
  const s = setup({ milestones: [50, 100] });
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  s.views.set('p1', 55); await s.run(T0 + 2 * DAY);
  s.views.set('p1', 90); await s.run(T0 + 3 * DAY);
  s.views.set('p1', 101); await s.run(T0 + 4 * DAY);
  s.views.set('p1', 150); await s.run(T0 + 5 * DAY);
  assert.equal(s.sent.length, 2);
  assert.match(s.sent[1].subject, /101 visitas/);
});

test('jumping past several numbers sends one email (the highest)', async () => {
  const s = setup({ milestones: [25, 50, 100] });
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  s.views.set('p1', 130);
  await s.run(T0 + 2 * DAY);
  assert.equal(s.sent.length, 1);
  assert.equal((await s.db.select('listing_view_milestones', ''))[0].last_milestone, 100);
});

test('listings that had views before switch-on get no email for numbers already passed', async () => {
  const s = setup({ milestones: [50, 100] });
  s.db.seed('properties', [listing('old', 'u2', T0 - 20 * DAY)]);
  s.views.set('old', 80);
  const r = await s.run(T0 + DAY);
  assert.equal(r.sent, 0);
  assert.equal(r.baselined, 1);
  s.views.set('old', 110);
  await s.run(T0 + 2 * DAY);
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].to, 'bo@x.com');
});

test('a failed send is retried next tick and never duplicated', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  s.views.set('p1', 70);
  s.setFail(true);
  const r1 = await s.run(T0 + 2 * DAY);
  assert.equal(r1.failed, 1);
  assert.equal((await s.db.select('listing_view_milestones', ''))[0].last_milestone, 0);
  s.setFail(false);
  await s.run(T0 + 2.1 * DAY);
  await s.run(T0 + 2.2 * DAY);
  assert.equal(s.sent.length, 1);
});

test('scraped and inactive listings are ignored', async () => {
  const s = setup();
  s.db.seed('properties', [listing('s1', 'u1', T0 + DAY, { origin: 'scraped' }), listing('h1', 'u1', T0 + DAY, { admin_status: 'hidden' })]);
  s.views.set('s1', 500); s.views.set('h1', 500);
  await s.run(T0 + 2 * DAY);
  assert.equal(s.sent.length, 0);
});

test('no view numbers or no template → nothing sent', async () => {
  const a = setup({ milestones: [] });
  a.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  a.views.set('p1', 500);
  assert.equal((await a.run(T0 + 2 * DAY)).skippedReason, 'no_milestones');
  const b = setup();
  await b.db.update('email_templates', 'id=eq.tv', { is_active: false });
  b.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  b.views.set('p1', 500);
  assert.equal((await b.run(T0 + 2 * DAY)).skippedReason, 'no_template');
});

test('emailOverride redirects the email', async () => {
  const s = setup();
  s.db.seed('properties', [listing('p1', 'u1', T0 + DAY)]);
  s.views.set('p1', 70);
  await s.run(T0 + 2 * DAY, { emailOverride: 'omar@airosofts.com' });
  assert.equal(s.sent[0].to, 'omar@airosofts.com');
});
