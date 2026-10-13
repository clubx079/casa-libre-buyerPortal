import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paidConfig, priceCents, usd, monthStartIso, decide, paidWindow, countFreeThisMonth, chargeCents, DEFAULTS } from '../lib/paidListings.js';
import { makeSignals, matchCount, linkedAccounts, samePersonGroups } from '../lib/samePerson.js';
import { listingQuota } from '../lib/listingQuota.js';
import { runPaidListings } from '../lib/automations/paidListings.js';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const U3 = '33333333-3333-3333-3333-333333333333';

test('no settings row = paywall off; defaults are 3 free, US$29 −80% = US$5.80, 90 days, +30 days for US$5', () => {
  const c = paidConfig(null);
  assert.equal(c.enabled, false);
  assert.equal(c.freePerMonth, 3);
  assert.equal(priceCents(c), 580);
  assert.equal(usd(priceCents(c)), 'US$5.80');
  assert.equal(usd(c.listCents), 'US$29');
  assert.equal(usd(c.extendCents), 'US$5');
  assert.equal(c.days, 90);
  assert.equal(c.extendDays, 30);
  assert.equal(chargeCents('extend', c), 500);
});

test('settings come from the automations row; bad values fall back to defaults', () => {
  const c = paidConfig({ enabled: true, first_tier_count: 2, free_days: 60, later_free_days: 15, remind_days_before: 2, milestones: [3900, 75, 700, 3], template_id: 'a', reminder_template_id: 'b', gift_template_id: 'c' });
  assert.deepEqual([c.enabled, c.freePerMonth, c.days, c.extendDays, c.remindDaysBefore, c.listCents, c.discountPct, c.extendCents, c.samePersonMin], [true, 2, 60, 15, 2, 3900, 75, 700, 3]);
  assert.equal(priceCents(c), 975);
  assert.deepEqual([c.endingTemplateId, c.endedTemplateId, c.agentTemplateId], ['a', 'b', 'c']);
  const bad = paidConfig({ enabled: true, first_tier_count: -1, milestones: [null, 140] });
  assert.equal(bad.freePerMonth, DEFAULTS.freePerMonth);
  assert.equal(bad.discountPct, DEFAULTS.discountPct);
});

test('free 0 = every listing is paid', () => {
  assert.deepEqual(decide({ enabled: true, freePerMonth: 0 }, 0), { paymentRequired: true, freeUsed: 0, freeLeft: 0 });
});

test('3 free a month: listings 1–3 free, the 4th is paid; off = always free', () => {
  const cfg = { enabled: true, freePerMonth: 3 };
  assert.equal(decide(cfg, 0).paymentRequired, false);
  assert.equal(decide(cfg, 2).paymentRequired, false);   // this is the 3rd
  assert.equal(decide(cfg, 2).freeLeft, 1);
  assert.equal(decide(cfg, 3).paymentRequired, true);    // this is the 4th
  assert.equal(decide({ enabled: false, freePerMonth: 3 }, 50).paymentRequired, false);
});

test('the month starts on the 1st at local midnight (Paraguay UTC-3, Bolivia UTC-4)', () => {
  assert.equal(monthStartIso('py', new Date('2026-10-13T15:00:00Z')), '2026-10-01T03:00:00.000Z');
  assert.equal(monthStartIso('py', new Date('2026-11-01T01:00:00Z')), '2026-10-01T03:00:00.000Z');   // still 31 Oct 22:00 local
  assert.equal(monthStartIso('bo', new Date('2026-10-13T15:00:00Z')), '2026-10-01T04:00:00.000Z');
});

test('only unpaid listings of this month use the free quota', () => {
  const ms = '2026-10-01T03:00:00.000Z';
  const rows = [
    { created_at: '2026-10-02T00:00:00Z' },
    { created_at: '2026-10-05T00:00:00Z', raw_data: { paid_listing: { state: 'active' } } },
    { created_at: '2026-09-30T00:00:00Z' },
    { created_at: '2026-10-06T00:00:00Z', status: 'duplicate_review' },
  ];
  assert.equal(countFreeThisMonth(rows, ms), 1);
});

test('paid window: publish = now + 90 days; extend stacks onto what is left, or starts today once ended', () => {
  const cfg = { days: 90, extendDays: 30 };
  const now = new Date('2026-10-13T00:00:00Z');
  assert.equal(paidWindow('publish', cfg, null, now), '2027-01-11T00:00:00.000Z');
  assert.equal(paidWindow('extend', cfg, { until: '2026-10-20T00:00:00Z' }, now), '2026-11-19T00:00:00.000Z');
  assert.equal(paidWindow('extend', cfg, { until: '2026-10-01T00:00:00Z' }, now), '2026-11-12T00:00:00.000Z');
});

test('same person: 2 of 3 signals (device, device profile, connection) must match', () => {
  const a = makeSignals({ deviceId: 'dev-aaaaaaaa', fp: 'abc123def', ip: '181.1.1.1' });
  assert.equal(matchCount(a, { device_id: 'dev-aaaaaaaa', fp: 'zzz999zzz', ip: '181.1.1.1' }), 2);
  assert.equal(matchCount(a, { device_id: 'dev-bbbbbbbb', fp: 'zzz999zzz', ip: '181.1.1.1' }), 1);   // same Wi-Fi only
  assert.equal(matchCount(a, { device_id: null, fp: null, ip: null }), 0);
  assert.deepEqual(makeSignals({ deviceId: 'x', fp: 'not valid!', ip: '' }), { device_id: null, fp: null, ip: null });
  const listings = [
    { created_by: U2, raw_data: { signals: { device_id: 'dev-aaaaaaaa', fp: 'q1q1q1', ip: '181.1.1.1' } } },   // device + ip → same person
    { created_by: U3, raw_data: { signals: { device_id: 'dev-cccccccc', fp: 'q2q2q2', ip: '181.1.1.1' } } },   // only ip → not
    { created_by: U1, raw_data: { signals: a } },                                                              // themselves
  ];
  assert.deepEqual(linkedAccounts(U1, a, listings, 2), [{ userId: U2, matched: ['device_id', 'ip'] }]);
  assert.equal(linkedAccounts(U1, a, listings, 1).length, 2);
  assert.equal(linkedAccounts(U1, a, listings, 3).length, 0);
});

test('admin groups: accounts that share 2+ signals end up in one group', () => {
  const s = (d, f, i) => ({ device_id: d, fp: f, ip: i });
  const g = samePersonGroups([
    { created_by: U1, raw_data: { signals: s('d1-aaaaaa', 'f1', '1.1.1.1') } },
    { created_by: U2, raw_data: { signals: s('d1-aaaaaa', 'f9', '1.1.1.1') } },
    { created_by: U3, raw_data: { signals: s('d3-cccccc', 'f3', '1.1.1.1') } },
  ], 2);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].users, [U1, U2].sort());
  assert.deepEqual(g[0].matched.sort(), ['device_id', 'ip']);
});

// A tiny fake of lib/db for the quota + cron.
function fakeDb(tables) {
  const calls = { updates: [], inserts: [] };
  const filt = (rows, q) => {
    let out = rows;
    for (const part of q.split('&')) {
      const [k, v] = part.split('=');
      if (!v || ['select', 'order', 'limit'].includes(k)) continue;
      const val = decodeURIComponent(v);
      if (val.startsWith('eq.')) out = out.filter((r) => String(r[k]) === val.slice(3));
      else if (val.startsWith('gte.')) out = out.filter((r) => String(r[k]) >= val.slice(4));
      else if (val.startsWith('in.(')) { const set = val.slice(4, -1).split(',').map((x) => x.replace(/"/g, '')); out = out.filter((r) => set.includes(String(r[k]))); }
      else if (val === 'not.is.null') out = out.filter((r) => r[k] != null);
    }
    return out;
  };
  return {
    calls,
    select: async (t, q) => filt(tables[t] || [], q),
    selectWithCount: async (t, q) => ({ count: filt(tables[t] || [], q).length }),
    update: async (t, q, patch) => { calls.updates.push({ t, q, patch }); for (const r of filt(tables[t] || [], q)) Object.assign(r, patch); },
    insert: async (t, rows) => { const list = Array.isArray(rows) ? rows : [rows];
      if (t === 'email_log' && list.some((r) => (tables.email_log || []).some((x) => x.dedupe_key === r.dedupe_key))) throw Object.assign(new Error('dup'), { status: 409 }); const made = list.map((r, i) => ({ id: `${t}-${(tables[t] || []).length + i}`, ...r })); (tables[t] = tables[t] || []).push(...made); calls.inserts.push({ t, rows: made }); return made; },
    remove: async (t, q) => { const del = new Set(filt(tables[t] || [], q)); tables[t] = (tables[t] || []).filter((r) => !del.has(r)); },
  };
}

test('quota: free listings of an account + the same person on another account are added up', async () => {
  const now = new Date('2026-10-13T15:00:00Z');
  const dev = { device_id: 'dev-aaaaaaaa', fp: 'abc123def', ip: '181.1.1.1' };
  const db = fakeDb({
    automations: [{ id: 'paid_listings', enabled: true, first_tier_count: 3 }],
    properties: [
      { id: 'p1', origin: 'user', created_by: U1, created_at: '2026-10-02T00:00:00.000Z', raw_data: { signals: dev } },
      { id: 'p2', origin: 'user', created_by: U1, created_at: '2026-10-03T00:00:00.000Z', raw_data: { signals: dev } },
      { id: 'p3', origin: 'user', created_by: U2, created_at: '2026-10-04T00:00:00.000Z', raw_data: { signals: { ...dev, fp: 'other1' } } },   // same device + Wi-Fi, other email
      { id: 'p4', origin: 'user', created_by: U3, created_at: '2026-10-05T00:00:00.000Z', raw_data: { signals: { device_id: 'dev-zzzzzzzz', fp: 'zz', ip: '181.1.1.1' } } },
    ],
    payments: [],
  });
  const q1 = await listingQuota(db, { uid: U1, signals: dev, countryCode: 'py', now });
  assert.equal(q1.freeUsed, 3);
  assert.equal(q1.paymentRequired, true);
  assert.deepEqual(q1.linked.map((l) => l.userId), [U2]);
  // From another device and Wi-Fi, U3 has just 1 free listing used.
  const q3 = await listingQuota(db, { uid: U3, signals: { device_id: 'dev-yyyyyyyy', fp: 'yy', ip: '10.0.0.1' }, countryCode: 'py', now });
  assert.equal(q3.freeUsed, 1);
  assert.equal(q3.freeLeft, 2);
  assert.equal(q3.paymentRequired, false);
});

test('quota: deleting a free listing does not give the slot back (the ledger counts it)', async () => {
  const now = new Date('2026-10-13T15:00:00Z');
  const db = fakeDb({
    automations: [{ id: 'paid_listings', enabled: true, first_tier_count: 3 }],
    properties: [],
    payments: ['a', 'b', 'c'].map((x) => ({ id: x, user_id: U1, kind: 'listing_free', created_at: '2026-10-05T00:00:00.000Z' })),
  });
  const q = await listingQuota(db, { uid: U1, signals: {}, countryCode: 'py', now });
  assert.equal(q.freeUsed, 3);
  assert.equal(q.paymentRequired, true);
});

test('quota: paywall off → never paid', async () => {
  const db = fakeDb({ automations: [{ id: 'paid_listings', enabled: false, first_tier_count: 0 }], properties: [], payments: [] });
  const q = await listingQuota(db, { uid: U1, signals: {}, countryCode: 'py' });
  assert.equal(q.paymentRequired, false);
});

test('cron: ends-soon email, then off the site + ended email when the paid time is up, agents email once', async () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const tables = {
    payments: [
      { id: 'pay1', property_id: 'L1', user_id: U1, kind: 'listing', status: 'succeeded', created_at: '2026-07-15T00:00:00Z' },
      { id: 'pay2', property_id: 'L2', user_id: U1, kind: 'listing', status: 'succeeded', created_at: '2026-07-10T00:00:00Z' },
    ],
    properties: [
      { id: 'L1', created_by: U1, status: 'published', admin_status: 'active', origin: 'user', property_type: 'casa', listing_type: 'sale', city: 'Asunción', raw_data: { paid_listing: { state: 'active', until: '2026-10-15T00:00:00Z' } } },
      { id: 'L2', created_by: U1, status: 'published', admin_status: 'active', origin: 'user', property_type: 'casa', listing_type: 'sale', city: 'Asunción', raw_data: { paid_listing: { state: 'active', until: '2026-10-12T00:00:00Z' } } },
    ],
    users: [{ id: U1, email: 'ana@example.com', full_name: 'Ana Pérez', active: true }],
    email_log: [],
  };
  const db = fakeDb(tables);
  const sent = [];
  const templates = [
    { id: 't-end', subject: 'Termina {{property_title}}', heading: 'h', body: '{{extend_url}} {{price}}', is_active: true },
    { id: 't-ended', subject: 'Terminó', heading: 'h', body: '{{extend_url}}', is_active: true },
    { id: 't-agent', subject: 'Plan para agentes', heading: 'h', body: '{{business_url}}', is_active: true },
  ];
  const automation = { id: 'paid_listings', enabled: true, enabled_at: '2026-07-01T00:00:00Z', remind_days_before: 3, template_id: 't-end', reminder_template_id: 't-ended', gift_template_id: 't-agent' };
  const deliver = async (m) => { sent.push(m); return { ok: true, id: 'r' }; };
  const r = await runPaidListings({ db, automation, templates, now, deliver, frame: {}, siteUrl: 'https://casa-libre.com.py' });
  assert.equal(r.reminded, 1);
  assert.equal(r.ended, 1);
  assert.equal(r.agentEmails, 1);
  const L2 = tables.properties.find((p) => p.id === 'L2');
  assert.equal(L2.status, 'expired');
  assert.equal(L2.admin_status, 'inactive');
  assert.equal(L2.raw_data.paid_listing.state, 'expired');
  assert.ok(sent.some((m) => m.html.includes('/cuenta/publicaciones?extend=L1')));
  // Run again: nothing is sent twice.
  const again = await runPaidListings({ db, automation, templates, now, deliver, frame: {}, siteUrl: 'https://casa-libre.com.py' });
  assert.equal(again.reminded + again.ended + again.agentEmails, 0);
  assert.equal(sent.length, 3);
});

test('cron: does nothing while the paywall is off', async () => {
  const r = await runPaidListings({ db: fakeDb({}), automation: { id: 'paid_listings', enabled: false }, templates: [], deliver: async () => ({ ok: true }) });
  assert.equal(r.skippedReason, 'off');
});
