import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './support/fakePostgrest.mjs';
import { sendPush } from '../lib/push.js';
import { pushContactToOwner, runOwnerPushes, isDaytime } from '../lib/ownerPushes.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OWNER2 = '33333333-3333-4333-8333-333333333333';
const BUYER = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const P2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const SCHEMA = { unique: { push_tokens: ['token'], push_log: ['dedupe_key'], notification_prefs: ['user_id'] }, defaults: { push_tokens: { enabled: true } } };
const H = 3600e3, D = 24 * H;
// 15:00 UTC = 11:00 / 12:00 in Asunción → daytime; 06:00 UTC = 02:00–03:00 → night.
const DAY = new Date('2026-10-02T15:00:00Z');
const NIGHT = new Date('2026-10-02T06:00:00Z');
const iso = (t) => new Date(t).toISOString();

function setup() {
  const db = createStore(SCHEMA);
  db.seed('push_tokens', [
    { user_id: OWNER, token: 'ExponentPushToken[ownerownerowner01]' },
    { user_id: OWNER2, token: 'ExponentPushToken[owner2owner2own02]' },
    { user_id: BUYER, token: 'ExponentPushToken[buyerbuyerbuyer03]' },
  ]);
  db.seed('properties', [
    { id: P1, created_by: OWNER, property_type: 'Casa', neighborhood: 'Villa Morra', city: 'Asunción' },
    { id: P2, created_by: null, property_type: 'Departamento', neighborhood: 'Carmelitas' },   // scraped
  ]);
  const sent = [];
  const fetchImpl = async (url, init) => {
    const msgs = JSON.parse(init.body);
    sent.push(...msgs);
    return { ok: true, status: 200, json: async () => ({ data: msgs.map(() => ({ status: 'ok', id: 't' })) }) };
  };
  const send = (o) => sendPush(db, o, { fetchImpl });
  return { db, sent, send };
}

test('a buyer contacting → the owner gets "someone wants to contact you" on their phone', async () => {
  const { db, sent, send } = setup();
  const r = await pushContactToOwner(db, send, { propertyId: P1, buyerUserId: BUYER, now: DAY });
  assert.equal(r.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ExponentPushToken[ownerownerowner01]');
  assert.match(sent[0].body, /Casa · Villa Morra/);
  assert.equal(sent[0].channelId, 'listings');
  assert.equal(sent[0].data.url, '/my-listings');
});

test('contact push: at most once per listing per day; never for your own listing or scraped ones', async () => {
  const { db, sent, send } = setup();
  await pushContactToOwner(db, send, { propertyId: P1, buyerUserId: BUYER, now: DAY });
  await pushContactToOwner(db, send, { propertyId: P1, buyerUserId: null, now: new Date(DAY.getTime() + H) });
  assert.equal(sent.length, 1, 'same day → once');
  await pushContactToOwner(db, send, { propertyId: P1, buyerUserId: null, now: new Date(DAY.getTime() + D) });
  assert.equal(sent.length, 2, 'next day → again');
  assert.equal((await pushContactToOwner(db, send, { propertyId: P1, buyerUserId: OWNER, now: DAY })).skipped, 'own_listing');
  assert.equal((await pushContactToOwner(db, send, { propertyId: P2, now: DAY })).skipped, 'no_owner');
  assert.equal((await pushContactToOwner(db, send, { propertyId: 'not-a-uuid', now: DAY })).skipped, 'no_property');
  assert.equal(sent.length, 2);
});

test('an owner who switched "Your listings" notifications off gets nothing', async () => {
  const { db, sent, send } = setup();
  db.seed('notification_prefs', [{ user_id: OWNER, listings: false }]);
  await pushContactToOwner(db, send, { propertyId: P1, now: DAY });
  assert.equal(sent.length, 0);
});

test('scheduled pushes never go out at night', async () => {
  const { db, sent, send } = setup();
  db.seed('listing_drafts', [{ id: 'd1', user_id: OWNER, data: { ptype: 'casa', neighborhood: 'Sajonia' }, updated_at: iso(NIGHT.getTime() - 2 * D) }]);
  assert.equal(isDaytime(NIGHT, 'py'), false);
  assert.equal(isDaytime(DAY, 'py'), true);
  const r = await runOwnerPushes(db, send, { now: NIGHT, countryCode: 'py' });
  assert.equal(r.skipped, 'night');
  assert.equal(sent.length, 0);
});

test('views milestone the views automation emailed → push once, opening the listing', async () => {
  const { db, sent, send } = setup();
  db.seed('email_log', [
    { automation_id: 'listing_views_milestone', dedupe_key: `views:${P1}:100`, status: 'sent', created_at: iso(DAY.getTime() - 3 * H) },
    { automation_id: 'listing_views_milestone', dedupe_key: `views:${P1}:50`, status: 'failed', created_at: iso(DAY.getTime() - 3 * H) },
    { automation_id: 'first_listing_free_home', dedupe_key: 'x', status: 'sent', created_at: iso(DAY.getTime() - 3 * H) },
  ]);
  // A baseline (listing first seen already past 200, never emailed) must NOT push.
  db.seed('listing_view_milestones', [{ property_id: P1, user_id: OWNER, last_milestone: 200, updated_at: iso(DAY.getTime() - H) }]);
  const r1 = await runOwnerPushes(db, send, { now: DAY, countryCode: 'py' });
  assert.equal(r1.views, 1);
  assert.match(sent[0].body, /100 visitas/);
  assert.equal(sent[0].data.url, `/property/${P1}`);
  const r2 = await runOwnerPushes(db, send, { now: new Date(DAY.getTime() + H), countryCode: 'py' });
  assert.equal(r2.views, 0, 'already sent');
  assert.equal(sent.length, 1);
});

test('old milestone emails (before this feature) are not pushed', async () => {
  const { db, sent, send } = setup();
  db.seed('email_log', [{ automation_id: 'listing_views_milestone', dedupe_key: `views:${P1}:50`, status: 'sent', created_at: iso(DAY.getTime() - 5 * D) }]);
  await runOwnerPushes(db, send, { now: DAY, countryCode: 'py' });
  assert.equal(sent.length, 0);
});

test('highlight ending within 24 h → push once', async () => {
  const { db, sent, send } = setup();
  db.tables.properties[0].promotion_plan = 'verified';
  db.tables.properties[0].promotion_expires_at = iso(DAY.getTime() + 10 * H);
  const r = await runOwnerPushes(db, send, { now: DAY, countryCode: 'py' });
  assert.equal(r.promo, 1);
  assert.match(sent[0].title, /destacado/i);
  await runOwnerPushes(db, send, { now: new Date(DAY.getTime() + H), countryCode: 'py' });
  assert.equal(sent.length, 1);
});

test('draft untouched for 1–7 days → one reminder; fresh or old drafts → none', async () => {
  const { db, sent, send } = setup();
  db.seed('listing_drafts', [
    { id: 'd-idle', user_id: OWNER2, data: { ptype: 'casa', neighborhood: 'Sajonia' }, updated_at: iso(DAY.getTime() - 2 * D) },
    { id: 'd-fresh', user_id: OWNER2, data: { ptype: 'terreno', neighborhood: 'Luque' }, updated_at: iso(DAY.getTime() - 3 * H) },
    { id: 'd-old', user_id: OWNER2, data: { neighborhood: 'Lambaré' }, updated_at: iso(DAY.getTime() - 10 * D) },
  ]);
  const r = await runOwnerPushes(db, send, { now: DAY, countryCode: 'py' });
  assert.equal(r.drafts, 1);
  assert.match(sent[0].body, /Casa · Sajonia/);
  assert.equal(sent[0].data.url, '/my-listings');
  await runOwnerPushes(db, send, { now: new Date(DAY.getTime() + 3 * H), countryCode: 'py' });
  assert.equal(sent.length, 1, 'one reminder per draft, ever');
});

test('one push per owner per run — the rest wait for the next hour', async () => {
  const { db, sent, send } = setup();
  db.tables.properties[0].promotion_plan = 'verified';
  db.tables.properties[0].promotion_expires_at = iso(DAY.getTime() + 5 * H);
  db.seed('listing_drafts', [{ id: 'd1', user_id: OWNER, data: { neighborhood: 'Sajonia' }, updated_at: iso(DAY.getTime() - 2 * D) }]);
  await runOwnerPushes(db, send, { now: DAY, countryCode: 'py' });
  assert.equal(sent.length, 1);
  await runOwnerPushes(db, send, { now: new Date(DAY.getTime() + H), countryCode: 'py' });
  assert.equal(sent.length, 2);
});

test('a table this country database lacks is skipped, the rest still runs', async () => {
  const { db, sent, send } = setup();
  db.seed('listing_drafts', [{ id: 'd1', user_id: OWNER2, data: { neighborhood: 'Sajonia' }, updated_at: iso(DAY.getTime() - 2 * D) }]);
  const gappy = { ...db, select: async (t, q) => { if (t === 'email_log') { const e = new Error('missing'); e.status = 404; e.code = 'PGRST205'; throw e; } return db.select(t, q); } };
  const r = await runOwnerPushes(gappy, send, { now: DAY, countryCode: 'py' });
  assert.equal(r.drafts, 1);
  assert.equal(sent.length, 1);
});
