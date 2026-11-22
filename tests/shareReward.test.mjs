import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import {
  shareRewardConfig, shareNudgeConfig, rewardStep, rewardDecision, nudgeStepDue, lowViewsDue, rewardText,
  SHARE_NUDGE_ID, SHARE_REWARD_ID, HOUR, DAY,
} from '../lib/shareReward.js';
import { runShareNudge, runShareReward, rewardKey, dataOf } from '../lib/automations/shareListing.js';

const T0 = Date.parse('2026-11-20T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

test('reward config: defaults, OFF unless enabled', () => {
  const c = shareRewardConfig(null);
  assert.equal(c.exists, false);
  assert.equal(c.enabled, false);
  assert.deepEqual([c.visits, c.reward, c.days, c.perListingOnce], [20, 'verified', 3, true]);
  const d = shareRewardConfig({ enabled: true, free_tiers: [{ visits: 5, reward: 'home', days: 7, perListingOnce: false }] });
  assert.deepEqual([d.enabled, d.visits, d.reward, d.days, d.perListingOnce], [true, 5, 'home', 7, false]);
  assert.equal(shareRewardConfig({ free_tiers: [{ reward: 'gold', visits: -1 }] }).reward, 'verified');
});

test('reward decision: threshold, once per listing, repeat when allowed', () => {
  const once = shareRewardConfig({ enabled: true, free_tiers: [{ visits: 20 }] });
  assert.equal(rewardStep(19, once), 0);
  assert.equal(rewardStep(65, once), 1);
  assert.deepEqual(rewardDecision({ visits: 20, cfg: once }), { step: 1 });
  assert.equal(rewardDecision({ visits: 80, cfg: once, given: [1] }), null);
  assert.equal(rewardDecision({ visits: 20, cfg: once, live: false }), null);
  assert.equal(rewardDecision({ visits: 20, cfg: { ...once, enabled: false } }), null);
  const rep = { ...once, perListingOnce: false };
  assert.deepEqual(rewardDecision({ visits: 45, cfg: rep, given: [1] }), { step: 2 });
});

test('nudge timing: the latest step reached, fresh, not sent', () => {
  const pub = iso(T0);
  assert.equal(nudgeStepDue(pub, [24, 168], T0 + 23 * HOUR), null);
  assert.equal(nudgeStepDue(pub, [24, 168], T0 + 25 * HOUR), 24);
  assert.equal(nudgeStepDue(pub, [24, 168], T0 + 25 * HOUR, [24]), null);
  assert.equal(nudgeStepDue(pub, [24, 168], T0 + 100 * HOUR), null);             // 24 h step is stale (grace 48 h)
  assert.equal(nudgeStepDue(pub, [24, 168], T0 + 170 * HOUR, [24]), 168);
  assert.equal(nudgeStepDue('bad', [24], T0), null);
});

test('nudge config reads the admin layout; low views rule', () => {
  const c = shareNudgeConfig({ enabled: true, enabled_at: iso(T0), milestones: [168, 24, 72], free_tiers: [{ lowViews: { enabled: true, threshold: 15, afterHours: 96 } }] });
  assert.deepEqual(c.steps, [24, 72, 168]);
  assert.deepEqual(c.lowViews, { afterHours: 96, maxViews: 15 });
  assert.equal(shareNudgeConfig({ free_tiers: [{ lowViews: { enabled: false } }] }).lowViews, null);
  const lv = { afterHours: 72, maxViews: 10 };
  assert.equal(lowViewsDue({ publishedAtIso: iso(T0), nowMs: T0 + 71 * HOUR, views: 0, lowViews: lv }), false);
  assert.equal(lowViewsDue({ publishedAtIso: iso(T0), nowMs: T0 + 73 * HOUR, views: 9, lowViews: lv }), true);
  assert.equal(lowViewsDue({ publishedAtIso: iso(T0), nowMs: T0 + 73 * HOUR, views: 10, lowViews: lv }), false);
  assert.equal(lowViewsDue({ publishedAtIso: iso(T0), nowMs: T0 + 73 * HOUR, views: 2, shareVisits: 1, lowViews: lv }), false);
});

test('reward text for the owner', () => {
  assert.deepEqual(rewardText({ enabled: false }), { active: false });
  const t = rewardText(shareRewardConfig({ enabled: true, free_tiers: [{ visits: 20, days: 3 }] }));
  assert.equal(t.es, 'Si tu link trae 20 visitas, ganás 3 días de Verificada gratis.');
  assert.ok(t.en && t.pt);
});

// ── engine ───────────────────────────────────────────────────────────────────────
const OWNER = '11111111-1111-4111-8111-111111111111';
const L1 = '22222222-2222-4222-8222-222222222222';
const L2 = '33333333-3333-4333-8333-333333333333';
const live = (id, createdMs, extra = {}) => ({ id, created_by: OWNER, created_at: iso(createdMs), origin: 'user', status: 'published', admin_status: 'active', is_complete: true, property_type: 'Casa', city: 'Asunción', ...extra });

function setup() {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('users', [{ id: OWNER, email: 'owner@test', full_name: 'Ana Pérez' }]);
  db.seed('email_templates', [
    { id: 'tp', key: 'share-nudge-published', subject: 'Compartí {{listing_title}}', heading: 'h', body: '{{share_url}}', button_label: 'Compartir', button_url: '{{share_url}}' },
    { id: 'tl', key: 'share-nudge-lowviews', subject: 'Pocas visitas', heading: 'h', body: '{{views}}', button_label: 'Compartir', button_url: '{{share_url}}' },
    { id: 'tr', key: 'share-reward-earned', subject: 'Ganaste {{reward_text}}', heading: 'h', body: '{{visits_needed}} {{reward_days}}', button_label: 'Ver', button_url: '{{listing_url}}' },
  ]);
  return db;
}
const outbox = () => { const sent = []; return { sent, deliver: async (m) => { sent.push(m); return { ok: true, id: `r${sent.length}` }; } }; };

test('nudge engine: one email per step, dedupe, low views once, only after the switch-on', async () => {
  const db = setup();
  db.seed('properties', [live(L1, T0), live(L2, T0 - 10 * DAY)]);   // L2 published before the switch-on
  const automation = { id: SHARE_NUDGE_ID, enabled: true, enabled_at: iso(T0 - DAY), milestones: [24, 168], template_id: 'tp', reminder_template_id: 'tl', free_tiers: [{ lowViews: { enabled: true, threshold: 10, afterHours: 72 } }] };
  const templates = await db.select('email_templates', 'select=*');
  const box = outbox();
  const run = (ms, views = 0) => runShareNudge({ db, automation, templates, now: new Date(ms), deliver: box.deliver, siteUrl: 'https://s.test', fetchViews: async () => new Map([[L1, views]]), shareVisits: async () => new Map() });

  let r = await run(T0 + 25 * HOUR);
  assert.equal(r.sent, 1);
  assert.equal(box.sent[0].subject, 'Compartí Casa · Asunción');
  assert.match(box.sent[0].html, /s\.test\/compartir\/22222222/);
  r = await run(T0 + 26 * HOUR);
  assert.equal(r.sent, 0);                                            // already sent
  r = await run(T0 + 73 * HOUR, 3);
  assert.equal(r.lowViews, 1);
  r = await run(T0 + 74 * HOUR, 3);
  assert.equal(r.lowViews, 0);
  r = await run(T0 + 169 * HOUR, 3);
  assert.equal(r.sent, 1);
  assert.equal(box.sent.length, 3);
  assert.ok(box.sent.every((m) => m.to === 'owner@test'));
  const off = await runShareNudge({ db, automation: { ...automation, enabled: false }, templates, now: new Date(T0 + 200 * HOUR), deliver: box.deliver });
  assert.equal(off.skippedReason, 'disabled');
});

test('reward engine: grants once with the referral rules, logs the event row, emails', async () => {
  const db = setup();
  db.seed('properties', [live(L1, T0), live(L2, T0, { status: 'scanning' })]);
  const automation = { id: SHARE_REWARD_ID, enabled: true, template_id: 'tr', free_tiers: [{ visits: 20, reward: 'verified', days: 3, perListingOnce: true }] };
  const templates = await db.select('email_templates', 'select=*');
  const grants = [];
  const grant = async (pid, plan, { days, extendFrom }) => { grants.push({ pid, plan, days, extendFrom }); return iso(T0 + days * DAY); };
  const box = outbox();
  const run = (visits, enabled = true) => runShareReward({ db, automation: { ...automation, enabled }, templates, now: new Date(T0), shareVisits: async () => visits, grant, deliver: box.deliver, siteUrl: 'https://s.test' });

  let r = await run(new Map([[L1, 19], [L2, 50]]));
  assert.equal(r.granted, 0);                                       // L1 below, L2 not live
  r = await run(new Map([[L1, 21]]));
  assert.equal(r.granted, 1);
  assert.equal(r.emailed, 1);
  assert.deepEqual(grants, [{ pid: L1, plan: 'verified', days: 3, extendFrom: null }]);
  const [ev] = await db.select('email_log', `dedupe_key=eq.${rewardKey(L1, 1)}`);
  assert.equal(ev.dedupe_key, `share:reward:${L1}:ev`);
  assert.equal(ev.automation_id, 'share_reward');
  assert.equal(ev.channel, 'event');
  assert.equal(ev.run_id, OWNER);
  assert.equal(dataOf(ev).emailed, true);
  assert.equal(box.sent[0].subject, 'Ganaste la insignia Verificada');
  r = await run(new Map([[L1, 90]]));
  assert.equal(r.granted, 0);                                       // once per listing
  assert.equal(box.sent.length, 1);
  assert.equal((await run(new Map([[L2, 99]]), false)).granted, 0);  // OFF
});

test('reward engine: a failed grant frees the claim for the next run', async () => {
  const db = setup();
  db.seed('properties', [live(L1, T0)]);
  const automation = { id: SHARE_REWARD_ID, enabled: true, free_tiers: [{ visits: 1 }] };
  let fail = true;
  const grant = async () => { if (fail) throw new Error('db down'); return iso(T0 + 3 * DAY); };
  const deps = { db, automation, templates: [], now: new Date(T0), shareVisits: async () => new Map([[L1, 5]]), grant, deliver: async () => ({ ok: true }) };
  assert.equal((await runShareReward(deps)).failed, 1);
  fail = false;
  assert.equal((await runShareReward(deps)).granted, 1);
});
