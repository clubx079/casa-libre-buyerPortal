import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import {
  codeFor, isCode, parseRefCookie, makeRefCookie, isNewForReferral, maskName, pickRewardListing, rewardOnListing,
  milestonesDue, reminderDue, referralConfig, listingHold, DEFAULTS, DAY, REFERRALS_ID, TEMPLATE_KEYS, dataOf, summarize,
} from '../lib/referrals/core.js';
import { ensureCode, codeOwner, recordClick, clickCount, attachPerson, personOf, rewardsOf, rewardEnds } from '../lib/referrals/store.js';
import { runReferrals, settleReferred } from '../lib/referrals/engine.js';

const T0 = Date.parse('2026-11-01T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

// ── core ─────────────────────────────────────────────────────────────────────────
test('codeFor: 8 characters without look-alikes, the same for the same id', () => {
  const a = codeFor('3f1c2e44-0000-4000-8000-000000000001');
  assert.equal(a, codeFor('3f1c2e44-0000-4000-8000-000000000001'));
  assert.ok(isCode(a), a);
  assert.notEqual(a, codeFor('3f1c2e44-0000-4000-8000-000000000002'));
  assert.equal(isCode('abc'), false);
  assert.equal(isCode('abcdefgo'), false);   // o is never used
});

test('parseRefCookie: valid within the window, gone after it', () => {
  const raw = encodeURIComponent(makeRefCookie('abcdefgh', T0));
  assert.deepEqual(parseRefCookie(raw, T0 + 29 * DAY, 30), { code: 'abcdefgh', clickedAt: T0 });
  assert.equal(parseRefCookie(raw, T0 + 31 * DAY, 30), null);
  assert.equal(parseRefCookie('not json', T0), null);
  assert.equal(parseRefCookie(encodeURIComponent(JSON.stringify({ c: 'bad', t: T0 })), T0), null);
});

test('isNewForReferral: created after the click, or minutes ago', () => {
  assert.equal(isNewForReferral({ created_at: iso(T0 + 3 * DAY) }, T0, T0 + 3 * DAY), true);
  assert.equal(isNewForReferral({ created_at: iso(T0 - 10 * DAY) }, T0, T0 + DAY), false);
  assert.equal(isNewForReferral({ created_at: iso(T0 - 10 * DAY) }, T0, T0 - 10 * DAY + 60000), true);
  assert.equal(isNewForReferral({}, T0, T0), false);
});

test('maskName: first name + last initial, never the email', () => {
  assert.equal(maskName('Ana María Pérez', 'ana@x.com'), 'Ana P.');
  assert.equal(maskName('Bo', 'bo@x.com'), 'Bo');
  assert.equal(maskName('', 'carlos.g@x.com'), 'ca***');
});

const L = (id, extra = {}) => ({ id, created_at: iso(T0), status: 'published', admin_status: 'active', is_complete: true, ...extra });

test('pickRewardListing: newest live listing without a promotion, else stack onto the one ending first', () => {
  assert.equal(pickRewardListing([], 'verified', T0), null);
  assert.equal(pickRewardListing([L('a', { status: 'rejected' })], 'verified', T0), null);
  const two = [L('old', { created_at: iso(T0 - DAY) }), L('new')];
  assert.deepEqual(pickRewardListing(two, 'verified', T0), { id: 'new', plan: 'verified', extendFrom: null });
  const promoted = [
    L('a', { promotion_plan: 'verified', promotion_expires_at: iso(T0 + 10 * DAY) }),
    L('b', { promotion_plan: 'home', promotion_expires_at: iso(T0 + 5 * DAY) }),
  ];
  // verified reward: onto the one ending first, keeping its 'home'
  assert.deepEqual(pickRewardListing(promoted, 'verified', T0), { id: 'b', plan: 'home', extendFrom: iso(T0 + 5 * DAY) });
  // home reward: prefers moving a Verified-only listing up to the home page
  assert.deepEqual(pickRewardListing(promoted, 'home', T0), { id: 'a', plan: 'home', extendFrom: iso(T0 + 10 * DAY) });
  // an expired promotion counts as none
  assert.deepEqual(pickRewardListing([L('x', { promotion_plan: 'verified', promotion_expires_at: iso(T0 - DAY) })], 'home', T0), { id: 'x', plan: 'home', extendFrom: null });
  assert.equal(rewardOnListing(L('y', { status: 'duplicate_review' }), 'verified', T0), null);
});

test('milestonesDue: once at the threshold, every multiple with repeat', () => {
  const cfg = referralConfig({ enabled: true, free_tiers: [{ milestone: { every: 3, repeat: false } }] });
  assert.deepEqual(milestonesDue(2, cfg), []);
  assert.deepEqual(milestonesDue(3, cfg), [1]);
  assert.deepEqual(milestonesDue(7, cfg), [1]);
  const rep = referralConfig({ enabled: true, free_tiers: [{ milestone: { every: 3, repeat: true } }] });
  assert.deepEqual(milestonesDue(6, rep), [1, 2]);
  assert.deepEqual(milestonesDue(9, referralConfig({ free_tiers: [{ milestone: { enabled: false } }] })), []);
});

test('reminderDue: the step most recently reached, nothing before or after the end', () => {
  const until = iso(T0 + 30 * DAY);
  assert.equal(reminderDue(until, [3, 1], T0), null);
  assert.equal(reminderDue(until, [3, 1], T0 + 27 * DAY + 1), 3);
  assert.equal(reminderDue(until, [3, 1], T0 + 29 * DAY + 1), 1);
  assert.equal(reminderDue(until, [3, 1], T0 + 31 * DAY), null);
});

test('referralConfig: defaults for a missing row, values clamped', () => {
  const c = referralConfig(null);
  assert.equal(c.enabled, false);
  assert.equal(c.exists, false);
  assert.equal(c.referrer.days, DEFAULTS.referrer.days);
  const d = referralConfig({ enabled: true, free_tiers: [{ referrer: { plan: 'gold', days: 9999 }, remindDays: [1, 3, 3, 99], attributionDays: 0 }] });
  assert.equal(d.referrer.plan, 'verified');
  assert.equal(d.referrer.days, 30);
  assert.deepEqual(d.remindDays, [3, 1]);
  assert.equal(d.attributionDays, 30);
});

test('listingHold: explains why a listing does not count yet', () => {
  assert.equal(listingHold([]), 'no_listing');
  assert.equal(listingHold([{ status: 'duplicate_review' }]), 'duplicate');
  assert.equal(listingHold([{ status: 'rejected' }]), 'photos_rejected');
  assert.equal(listingHold([{ status: 'scanning' }]), 'checking_photos');
});

// ── store ────────────────────────────────────────────────────────────────────────
const SCHEMA = { ...AUTOMATION_SCHEMA };
const user = (id, extra = {}) => ({ id, email: `${id}@test.invalid`, full_name: `${id[0].toUpperCase()}${id.slice(1)} Test`, verified: true, active: true, blocked: false, suspended: false, created_at: iso(T0), ...extra });

test('store: code owner, one click per visitor per day, first link wins', async () => {
  const db = createStore(SCHEMA);
  const code = await ensureCode(db, user('rita'));
  assert.equal(await ensureCode(db, user('rita')), code);                  // twice → same, one row
  assert.equal(db.tables.email_log.length, 1);
  assert.deepEqual(await codeOwner(db, code), { userId: 'rita', email: 'rita@test.invalid' });
  assert.equal(await codeOwner(db, 'zzzzzzzz'), null);
  assert.equal(await recordClick(db, { code, ownerId: 'rita', visitor: 'v1', now: new Date(T0) }), 'counted');
  assert.equal(await recordClick(db, { code, ownerId: 'rita', visitor: 'v1', now: new Date(T0 + 1000) }), 'duplicate');
  assert.equal(await recordClick(db, { code, ownerId: 'rita', visitor: 'v1', now: new Date(T0 + DAY) }), 'counted');
  assert.equal(await clickCount(db, code), 2);
  const p1 = await attachPerson(db, { referrerId: 'rita', user: user('nina'), code, clickedAt: T0 });
  assert.ok(p1);
  assert.equal(await attachPerson(db, { referrerId: 'other', user: user('nina'), code: 'otherxyz', clickedAt: T0 }), null);
  assert.equal(String((await personOf(db, 'nina')).run_id), 'rita');
  // every record is an event row the email pages leave out
  assert.ok(db.tables.email_log.every((r) => r.dedupe_key.endsWith(':ev') && r.channel === 'event' && r.automation_id === REFERRALS_ID));
});

// ── engine ───────────────────────────────────────────────────────────────────────
function world({ enabled = true, settings = {} } = {}) {
  const db = createStore(SCHEMA);
  db.seed('automations', [{ id: REFERRALS_ID, enabled, enabled_at: iso(T0), free_tiers: [settings] }]);
  db.seed('email_templates', Object.values(TEMPLATE_KEYS).map((key) => ({ id: `t-${key}`, key, name: key, subject: `${key} {{name}}`, heading: 'h', body: '{{property_title}} hasta {{free_until}} ({{referral_count}})', button_label: 'Ver', button_url: '{{referrals_url}}' })));
  db.seed('users', [user('rita', { phone: '+595981000001', phone_verified_at: iso(T0) })]);
  db.seed('properties', [{ id: 'rita-1', created_by: 'rita', origin: 'user', created_at: iso(T0 - 5 * DAY), status: 'published', admin_status: 'active', is_complete: true, contact_phone: '0981 000 001', raw_data: { signals: { device_id: 'dev-rita', fp: 'fprita', ip: '1.1.1.1' } } }]);
  const sent = [];
  const grants = [];
  const deps = {
    db,
    deliver: async (m) => { sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
    grant: async (pid, plan, { days, extendFrom }) => {
      grants.push([pid, plan, days]);
      const [p] = await db.select('properties', `id=eq.${pid}`);
      const from = extendFrom && Date.parse(extendFrom) > now.ms ? Date.parse(extendFrom) : now.ms;
      const until = iso(from + days * DAY);
      await db.update('properties', `id=eq.${pid}`, { promotion_plan: plan, promotion_expires_at: until });
      return until;
    },
    frame: { brand: 'Casa-Libre', tld: '.py', countryName: 'Paraguay' },
    siteUrl: 'https://casa-libre.com.py',
    extendUrl: (r, d) => `https://casa-libre.com.py/api/promo/extend?token=t-${d.property_id}`,
    formatDate: (s) => s.slice(0, 10),
    priceFor: (plan) => (plan === 'home' ? 'US$20' : 'US$5'),
    phonePrefix: '595',
    samePersonMin: 2,
  };
  const now = { ms: T0 };
  const run = async (atMs = now.ms) => {
    now.ms = atMs;
    const [automation] = await db.select('automations', `id=eq.${REFERRALS_ID}`);
    return runReferrals({ ...deps, automation, templates: await db.select('email_templates', ''), now: new Date(atMs) });
  };
  const settle = async (uid) => {
    const [automation] = await db.select('automations', `id=eq.${REFERRALS_ID}`);
    return settleReferred({ ...deps, automation, templates: await db.select('email_templates', ''), now: new Date(now.ms) }, uid);
  };
  // someone signs up through Rita's link and (optionally) publishes
  const join = async (id, { status = 'published', signals, phone = null } = {}) => {
    db.seed('users', [user(id, { created_at: iso(now.ms) })]);
    await attachPerson(db, { referrerId: 'rita', user: user(id), code: codeFor('rita'), clickedAt: now.ms - DAY });
    if (status) db.seed('properties', [{ id: `${id}-1`, created_by: id, origin: 'user', created_at: iso(now.ms), status, admin_status: status === 'published' ? 'active' : 'inactive', is_complete: true, contact_phone: phone, raw_data: { signals: signals || { device_id: `dev-${id}`, fp: `fp${id}`, ip: `9.9.9.${id.length}` } } }]);
  };
  return { db, sent, grants, run, settle, join, now };
}
const rewards = async (db, uid) => (await rewardsOf(db, uid)).map((r) => ({ state: r.subject, ...dataOf(r) }));
const state = async (db, uid) => (await personOf(db, uid))?.subject;

test('engine: a live listing qualifies the referral — both rewards granted once, emails once', async () => {
  const w = world();
  await w.join('nina');
  const r1 = await w.run();
  assert.equal(r1.qualified, 1);
  assert.equal(await state(w.db, 'nina'), 'qualified');
  const ninaR = await rewards(w.db, 'nina');
  const ritaR = await rewards(w.db, 'rita');
  assert.equal(ninaR.length, 1);
  assert.equal(ninaR[0].type, 'new_user');
  assert.equal(ninaR[0].state, 'granted');
  assert.equal(ninaR[0].property_id, 'nina-1');
  assert.equal(ritaR.length, 1);
  assert.equal(ritaR[0].type, 'referrer');
  assert.equal(ritaR[0].property_id, 'rita-1');
  const [rp] = await w.db.select('properties', 'id=eq.rita-1');
  assert.equal(rp.promotion_plan, 'verified');
  assert.equal(w.grants.length, 2);
  assert.equal(w.sent.length, 2);
  // retries change nothing
  await w.run(); await w.run(); await w.settle('nina');
  assert.equal(w.grants.length, 2);
  assert.equal(w.sent.length, 2);
  assert.equal((await rewards(w.db, 'rita')).length, 1);
});

test('engine: the 3rd qualified referral adds the home-page reward (once, without repeat)', async () => {
  const w = world();
  for (const id of ['nina', 'omar', 'pia']) await w.join(id);
  await w.run();
  const rita = await rewards(w.db, 'rita');
  assert.equal(rita.filter((r) => r.type === 'referrer').length, 3);
  const ms = rita.filter((r) => r.type === 'milestone');
  assert.equal(ms.length, 1);
  assert.equal(ms[0].plan, 'home');
  assert.equal(ms[0].state, 'granted');
  const [rp] = await w.db.select('properties', 'id=eq.rita-1');
  assert.equal(rp.promotion_plan, 'home');                       // one listing: stacked, moved up to home
  assert.equal(Date.parse(rp.promotion_expires_at), T0 + 120 * DAY);   // 3×30 Verified + 30 home
  for (const id of ['quim', 'raul', 'sol']) await w.join(id);
  await w.run(); await w.run();
  assert.equal((await rewards(w.db, 'rita')).filter((r) => r.type === 'milestone').length, 1);   // 6 → still one
});

test('engine: with repeat, every 3 more referrals earn another home reward', async () => {
  const w = world({ settings: { milestone: { every: 3, repeat: true } } });
  for (const id of ['nina', 'omar', 'pia', 'quim', 'raul', 'sol']) await w.join(id);
  await w.run();
  assert.equal((await rewards(w.db, 'rita')).filter((r) => r.type === 'milestone').length, 2);
});

test('engine: same person (same device + connection, or the same phone) is rejected, no rewards', async () => {
  const w = world();
  await w.join('twin', { signals: { device_id: 'dev-rita', fp: 'other', ip: '1.1.1.1' } });
  await w.join('phone', { phone: '0981000001' });            // the referrer's verified WhatsApp
  await w.run();
  assert.equal(await state(w.db, 'twin'), 'rejected');
  assert.equal(dataOf(await personOf(w.db, 'twin')).reason, 'same_person');
  assert.equal(await state(w.db, 'phone'), 'rejected');
  assert.deepEqual(await rewards(w.db, 'rita'), []);
  assert.deepEqual(await rewards(w.db, 'twin'), []);
  assert.equal(w.grants.length, 0);
});

test('engine: an admin override lets a same-person rejection through', async () => {
  const w = world();
  await w.join('twin', { signals: { device_id: 'dev-rita', fp: 'other', ip: '1.1.1.1' } });
  const row = await personOf(w.db, 'twin');
  await w.db.update('email_log', `id=eq.${row.id}`, { error: JSON.stringify({ ...dataOf(row), override: true }) });
  await w.run();
  assert.equal(await state(w.db, 'twin'), 'qualified');
});

test('engine: a held duplicate or rejected-photos listing does not qualify until it goes live', async () => {
  const w = world();
  await w.join('dup', { status: 'duplicate_review' });
  await w.join('pics', { status: 'rejected' });
  await w.join('none', { status: null });
  const r = await w.run();
  assert.equal(r.waiting, 3);
  assert.equal(await state(w.db, 'dup'), 'signed_up');
  assert.equal(dataOf(await personOf(w.db, 'dup')).hold, 'duplicate');
  assert.equal(dataOf(await personOf(w.db, 'pics')).hold, 'photos_rejected');
  assert.equal(dataOf(await personOf(w.db, 'none')).hold, 'no_listing');
  assert.equal(w.grants.length, 0);
  // the admin approves the duplicate → live → it counts now
  await w.db.update('properties', 'id=eq.dup-1', { status: 'published', admin_status: 'active' });
  await w.settle('dup');
  assert.equal(await state(w.db, 'dup'), 'qualified');
  assert.equal(w.grants.length, 2);
});

test('engine: reminders 3 and 1 days before the end, once each, then expired', async () => {
  const w = world({ settings: { referrer: { enabled: false } } });
  await w.join('nina');
  await w.run(T0);
  const sent0 = w.sent.length;                                  // the "you got it" email
  await w.run(T0 + 26 * DAY);
  assert.equal(w.sent.length, sent0);                           // nothing yet
  const r1 = await w.run(T0 + 27 * DAY + 3600000);
  assert.equal(r1.reminded, 1);
  await w.run(T0 + 27 * DAY + 7200000);
  assert.equal(w.sent.length, sent0 + 1);                       // once
  await w.run(T0 + 29 * DAY + 3600000);
  assert.equal(w.sent.length, sent0 + 2);                       // the 1-day one
  const end = await w.run(T0 + 31 * DAY);
  assert.equal(end.expired, 1);
  assert.equal((await rewards(w.db, 'nina'))[0].state, 'expired');
});

test('engine: no reminder when the listing was renewed (paid) past the reward', async () => {
  const w = world({ settings: { referrer: { enabled: false } } });
  await w.join('nina');
  await w.run(T0);
  await w.db.update('properties', 'id=eq.nina-1', { promotion_expires_at: iso(T0 + 60 * DAY) });
  const before = w.sent.length;
  await w.run(T0 + 28 * DAY);
  assert.equal(w.sent.length, before);
  assert.equal((await rewardEnds(w.db)).get('nina-1'), iso(T0 + 30 * DAY));
});

test('engine: a referrer without a live listing keeps the reward pending until they publish', async () => {
  const w = world();
  await w.db.update('properties', 'id=eq.rita-1', { status: 'rejected', admin_status: 'inactive' });
  await w.join('nina');
  await w.run();
  const [pending] = (await rewards(w.db, 'rita'));
  assert.equal(pending.state, 'pending');
  assert.equal(pending.wait, 'no_live_listing');
  await w.db.update('properties', 'id=eq.rita-1', { status: 'published', admin_status: 'active' });
  await w.run();
  assert.equal((await rewards(w.db, 'rita'))[0].state, 'granted');
});

test('engine: a failed promotion write goes back to pending and is retried', async () => {
  const w = world({ settings: { referrer: { enabled: false } } });
  await w.join('nina');
  const [automation] = await w.db.select('automations', `id=eq.${REFERRALS_ID}`);
  const templates = await w.db.select('email_templates', '');
  const out = await runReferrals({ db: w.db, automation, templates, now: new Date(T0), grant: async () => { throw new Error('db down'); }, deliver: async () => ({ ok: true }) });
  assert.equal(out.failed, 1);
  const [r] = await rewards(w.db, 'nina');
  assert.equal(r.state, 'pending');
  assert.equal(r.last_error, 'db down');
  await w.run();
  assert.equal((await rewards(w.db, 'nina'))[0].state, 'granted');
});

test('engine: switched off → no new referrals or rewards', async () => {
  const w = world({ enabled: false });
  await w.join('nina');
  const r = await w.run();
  assert.equal(r.qualified, 0);
  assert.equal(await state(w.db, 'nina'), 'signed_up');
});

test('engine: maxRewardsPerReferrer caps the referrer side, the new person still gets theirs', async () => {
  const w = world({ settings: { maxRewardsPerReferrer: 1, milestone: { every: 2 } } });
  await w.join('nina');
  await w.join('omar');
  await w.run();
  const rita = await rewards(w.db, 'rita');
  assert.equal(rita.length, 1);
  assert.equal((await rewards(w.db, 'omar')).length, 1);
});

test('summarize: counts for the dashboard', () => {
  const s = summarize({ clicks: 4, persons: [{ subject: 'qualified', error: '{"listing_id":"x"}' }, { subject: 'signed_up', error: '{}' }, { subject: 'rejected', error: '{}' }], rewards: [{ subject: 'granted' }, { subject: 'pending' }] });
  assert.deepEqual(s, { clicks: 4, signups: 3, listed: 1, qualified: 1, rejected: 1, rewardsGranted: 1, rewardsPending: 1 });
});
