import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paidConfig, freeUntil, listingUntil, freeListingAction, freeOverdue, canExtend, extendBase, paidWindow, chargeCents, isFreeListing, countFreeThisMonth } from '../lib/paidListings.js';
import { runPaidListings, expireFreeListings, makeMailVars } from '../lib/automations/paidListings.js';

const DAY = 86400000;
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
// The owner's settings: 2 free a month, live 60 days, +30 days for US$5, email 3 days before.
const ROW = { id: 'paid_listings', enabled: true, enabled_at: '2026-07-01T00:00:00Z', first_tier_count: 2, free_days: 60, later_free_days: 30, remind_days_before: 3, milestones: [2900, 80, 500, 2], template_id: 't-end', reminder_template_id: 't-ended', gift_template_id: null };
const cfg = paidConfig(ROW);
const NOW = new Date('2026-11-17T12:00:00Z');
const ago = (d) => new Date(NOW.getTime() - d * DAY).toISOString();
const free = (id, days, extra = {}) => ({ id, created_by: U1, created_at: ago(days), source_id: null, status: 'published', admin_status: 'active', property_type: 'casa', listing_type: 'sale', city: 'Asunción', raw_data: {}, ...extra });

test('free listing end date = publish date (created_at) + free_days', () => {
  const p = free('a', 10);
  assert.equal(freeUntil(p, cfg), new Date(Date.parse(p.created_at) + 60 * DAY).toISOString());
  assert.equal(listingUntil(p, cfg), freeUntil(p, cfg));
  // a paid listing keeps its own until; a scraped listing never ends
  const paid = free('b', 100, { raw_data: { paid_listing: { state: 'active', until: '2027-01-01T00:00:00Z' } } });
  assert.equal(freeUntil(paid, cfg), null);
  assert.equal(listingUntil(paid, cfg), '2027-01-01T00:00:00Z');
  assert.equal(freeUntil(free('c', 400, { source_id: 'src-1' }), cfg), null);
  assert.equal(isFreeListing(free('d', 1, { created_by: null })), false);
});

test('free listing: nothing before the window, ends-soon inside remind_days_before, end at free_days', () => {
  assert.equal(freeListingAction(free('a', 56), cfg, NOW), null);        // 4 days left
  assert.equal(freeListingAction(free('a', 58), cfg, NOW), 'remind');    // 2 days left
  assert.equal(freeListingAction(free('a', 57.01), cfg, NOW), 'remind'); // just under 3 days
  assert.equal(freeListingAction(free('a', 60), cfg, NOW), 'end');
  assert.equal(freeListingAction(free('a', 61), cfg, NOW), 'end');
});

test('free listing: only live listings; payment_pending / scanning / rejected / expired untouched; paywall off = nothing ends', () => {
  for (const status of ['payment_pending', 'scanning', 'rejected', 'expired', 'duplicate_review']) assert.equal(freeListingAction(free('a', 90, { status }), cfg, NOW), null, status);
  assert.equal(freeListingAction(free('a', 90), paidConfig({ ...ROW, enabled: false }), NOW), null);
  assert.equal(freeListingAction(free('a', 90, { source_id: 'scraper' }), cfg, NOW), null);
  assert.equal(freeListingAction(free('a', 90, { raw_data: { paid_listing: { state: 'active', until: ago(-10) } } }), cfg, NOW), null);
  assert.deepEqual(freeOverdue([free('x', 61), free('y', 59), free('z', 70, { status: 'scanning' })], cfg, NOW).map((p) => p.id), ['x']);
});

test('renewal pricing: a free listing extends through the PAID extension (milestones[2] for later_free_days)', () => {
  assert.equal(chargeCents('extend', cfg), 500);
  // ended → 30 days from today
  const ended = free('e', 61, { status: 'expired', raw_data: { free_listing: { state: 'expired', until: ago(1) } } });
  assert.equal(canExtend(ended), true);
  assert.equal(paidWindow('extend', cfg, extendBase(ended, cfg), NOW), new Date(NOW.getTime() + 30 * DAY).toISOString());
  assert.equal(extendBase(ended, cfg).from_free, true);
  // still live (58 days old: 2 days left) → its free end + 30
  const live = free('l', 58);
  assert.equal(paidWindow('extend', cfg, extendBase(live, cfg), NOW), new Date(Date.parse(live.created_at) + 90 * DAY).toISOString());
  // admin settings drive it: US$7 for 15 days
  const c2 = paidConfig({ ...ROW, later_free_days: 15, milestones: [2900, 80, 700, 2] });
  assert.equal(chargeCents('extend', c2), 700);
  assert.equal(paidWindow('extend', c2, extendBase(ended, c2), NOW), new Date(NOW.getTime() + 15 * DAY).toISOString());
  // not renewable: waiting for payment / being checked / rejected / scraped
  for (const status of ['payment_pending', 'scanning', 'rejected']) assert.equal(canExtend(free('x', 1, { status })), false, status);
  assert.equal(canExtend(free('x', 1, { source_id: 's' })), false);
});

test('a free listing renewed later still counts as one of its month free listings', () => {
  const month = '2026-11-01T03:00:00.000Z';
  const rows = [
    { created_at: '2026-11-02T00:00:00Z', raw_data: {} },
    { created_at: '2026-11-03T00:00:00Z', raw_data: { paid_listing: { state: 'active', until: 'x', from_free: true } } },
    { created_at: '2026-11-04T00:00:00Z', raw_data: { paid_listing: { state: 'active', until: 'x' } } },
  ];
  assert.equal(countFreeThisMonth(rows, month), 2);
});

function fakeDb(tables) {
  const filt = (rows, q) => {
    let out = rows;
    for (const part of q.split('&')) {
      const i = part.indexOf('='); const k = part.slice(0, i); const v = part.slice(i + 1);
      if (!v || ['select', 'order', 'limit', 'offset'].includes(k) || k.includes('->')) continue;
      const val = decodeURIComponent(v);
      if (val.startsWith('eq.')) out = out.filter((r) => String(r[k]) === val.slice(3));
      else if (val.startsWith('lte.')) out = out.filter((r) => String(r[k]) <= val.slice(4));
      else if (val.startsWith('in.(')) { const set = val.slice(4, -1).split(',').map((x) => x.replace(/"/g, '')); out = out.filter((r) => set.includes(String(r[k]))); }
      else if (val === 'not.is.null') out = out.filter((r) => r[k] != null);
      else if (val === 'is.null') out = out.filter((r) => r[k] == null);
    }
    return out;
  };
  return {
    select: async (t, q) => (q.includes('->') ? [] : filt(tables[t] || [], q)),
    update: async (t, q, patch) => { for (const r of filt(tables[t] || [], q)) Object.assign(r, patch); },
    insert: async (t, rows) => {
      const list = Array.isArray(rows) ? rows : [rows];
      if (t === 'email_log' && list.some((r) => (tables.email_log || []).some((x) => x.dedupe_key === r.dedupe_key))) throw Object.assign(new Error('dup'), { status: 409 });
      const made = list.map((r, i) => ({ id: `${t}-${(tables[t] || []).length + i}`, ...r })); (tables[t] = tables[t] || []).push(...made); return made;
    },
    remove: async (t, q) => { const del = new Set(filt(tables[t] || [], q)); tables[t] = (tables[t] || []).filter((r) => !del.has(r)); },
  };
}
const templates = [
  { id: 't-end', key: 'paid-listing-ending', subject: 'Tu publicación termina en {{days_left}} días', heading: 'h', body: '{{property_title}} hasta el {{listing_until}}. Extendela {{free_days}} días por {{price}}: {{extend_url}}', is_active: true },
  { id: 't-ended', key: 'paid-listing-ended', subject: 'Tu publicación terminó', heading: 'h', body: 'terminó el {{listing_until}}. {{free_days}} días por {{price}}: {{extend_url}}', is_active: true },
];

test('cron: free listing → ends-soon email at 58 days, then expired (never deleted) + ended email at 61; once each', async () => {
  const tables = {
    payments: [],
    properties: [
      free('F58', 58),
      free('F61', 61),
      free('F10', 10),
      free('SCR', 300, { source_id: 'remax' }),
      free('PEND', 300, { status: 'payment_pending' }),
      free('CLOSED', 70, { created_by: U2 }),
    ],
    users: [{ id: U1, email: 'ana@example.com', full_name: 'Ana Pérez', active: true }, { id: U2, email: 'gone@example.com', full_name: 'Gone', active: false }],
    email_log: [],
  };
  const db = fakeDb(tables);
  const sent = [];
  const deliver = async (m) => { sent.push(m); return { ok: true, id: `r${sent.length}` }; };
  const r = await runPaidListings({ db, automation: ROW, templates, now: NOW, deliver, frame: {}, siteUrl: 'https://casa-libre.com.py' });
  assert.equal(r.freeReminded, 1);
  assert.equal(r.freeEnded, 2);   // F61 + CLOSED (closed account: ends, no email)
  const byId = Object.fromEntries(tables.properties.map((p) => [p.id, p]));
  assert.equal(byId.F61.status, 'expired');
  assert.equal(byId.F61.admin_status, 'inactive');
  assert.equal(byId.F61.raw_data.free_listing.state, 'expired');
  assert.equal(byId.F61.raw_data.free_listing.until, new Date(Date.parse(byId.F61.created_at) + 60 * DAY).toISOString());
  assert.equal(byId.CLOSED.status, 'expired');
  for (const id of ['F58', 'F10', 'SCR']) assert.equal(byId[id].status, 'published', id);
  assert.equal(byId.PEND.status, 'payment_pending');
  assert.equal(tables.properties.length, 6);   // nothing deleted
  assert.equal(sent.length, 2);
  assert.ok(sent.every((m) => m.to === 'ana@example.com'));
  const ending = sent.find((m) => /termina en 2 días/.test(m.subject));
  assert.ok(ending && ending.html.includes('/cuenta/publicaciones?extend=F58') && ending.html.includes('US$5') && ending.html.includes('30 días'));
  assert.ok(sent.some((m) => m.subject === 'Tu publicación terminó' && m.html.includes('extend=F61')));
  assert.ok(tables.email_log.some((l) => l.dedupe_key.startsWith('free-ending:F58:')));
  assert.ok(tables.email_log.some((l) => l.dedupe_key.startsWith('free-ended:F61:')));
  const again = await runPaidListings({ db, automation: ROW, templates, now: NOW, deliver, frame: {}, siteUrl: 'https://casa-libre.com.py' });
  assert.equal(again.freeReminded + again.freeEnded, 0);
  assert.equal(sent.length, 2);
});

test('backfill mode (remind: false): only overdue ones end; ended email once (dedupe)', async () => {
  const tables = { properties: [free('A', 61), free('B', 58), free('C', 200)], users: [{ id: U1, email: 'ana@example.com', full_name: 'Ana', active: true }], email_log: [] };
  const db = fakeDb(tables);
  const sent = [];
  const args = { db, cfg, now: NOW, tpl: (id) => templates.find((t) => t.id === id), mailVars: makeMailVars({ site: 'https://x', cfg, now: NOW }), frame: {}, deliver: async (m) => { sent.push(m); return { ok: true, id: 'r' }; }, remind: false };
  const r = await expireFreeListings(args);
  assert.deepEqual(r.endedIds.sort(), ['A', 'C']);
  assert.equal(sent.length, 2);
  assert.equal(tables.properties.find((p) => p.id === 'B').status, 'published');
  // a second run (or the cron after the backfill) finds nothing more
  const r2 = await expireFreeListings(args);
  assert.equal(r2.ended, 0);
  assert.equal(sent.length, 2);
});

test('cron: paywall OFF → free listings never end', async () => {
  const tables = { payments: [], properties: [free('A', 300)], users: [], email_log: [] };
  const r = await runPaidListings({ db: fakeDb(tables), automation: { ...ROW, enabled: false }, templates, now: NOW, deliver: async () => ({ ok: true }), frame: {}, siteUrl: 'x' });
  assert.equal(r.skippedReason, 'off');
  assert.equal(tables.properties[0].status, 'published');
});
