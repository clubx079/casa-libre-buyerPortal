import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentFollowupConfig, normalizeSteps, giftsUsed, personListings, runPaymentFollowup, claimListingGift, PAYMENT_FOLLOWUP_ID, DEFAULT_STEPS } from '../lib/automations/paymentFollowup.js';
import { runListingHeld } from '../lib/automations/listingHeld.js';

const H = 3600e3;
const D = 24 * H;

test('settings from the automations row', () => {
  assert.deepEqual(normalizeSteps([168, '24', 0, 9999, 24]), [24, 168]);
  const none = paymentFollowupConfig(null);
  assert.equal(none.enabled, false);
  assert.deepEqual(none.steps, DEFAULT_STEPS);
  assert.equal(none.giftAfterDays, 8);
  const c = paymentFollowupConfig({ enabled: true, enabled_at: 'x', milestones: [24, 72], wait_days: 0, first_tier_count: 2, free_tiers: [{ gift_window_days: 90 }], free_days: 60, template_id: 'r', gift_template_id: 'g' });
  assert.equal(c.enabled, true);
  assert.equal(c.giftAfterDays, 0);   // saved row with 0 = no gift
  assert.equal(c.giftsPerPerson, 2);
  assert.equal(c.giftWindowDays, 90);
  assert.equal(c.giftDays, 60);
  assert.equal(paymentFollowupConfig({ enabled: true }).enabled, false);   // never switched on
});

test('gifts that count against the limit', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  const iso = (ms) => new Date(now.getTime() + ms).toISOString();
  const L = (id, gift) => ({ id, raw_data: { paid_listing: { state: 'pending', gift } } });
  const list = [
    L('claimed', { offered_at: iso(-40 * D), expires_at: iso(-26 * D), claimed_at: iso(-39 * D) }),
    L('open', { offered_at: iso(-D), expires_at: iso(13 * D) }),
    L('lapsed', { offered_at: iso(-30 * D), expires_at: iso(-16 * D) }),
    L('none', null),
  ];
  assert.equal(giftsUsed(list, { now }), 2);                        // claimed + open; lapsed doesn't count
  assert.equal(giftsUsed(list, { now, exceptId: 'open' }), 1);
  assert.equal(giftsUsed(list, { now, windowDays: 30 }), 1);        // the claimed one is older than 30 days
});

test('same person = same account or same listing phone', () => {
  const all = [
    { id: 'a', created_by: 'u1', contact_phone: '0981 111222' },
    { id: 'b', created_by: 'u2', contact_phone: '+595981111222' },
    { id: 'c', created_by: 'u3', contact_phone: '0971 999888' },
  ];
  assert.deepEqual(personListings(all, all[0], '595').map((x) => x.id), ['a', 'b']);
});

// ---- the cron run against a fake DB --------------------------------------------------
function fakeDb({ now, props, users, giftRow }) {
  const log = [];
  const updates = [];
  return {
    log, updates, props,
    async select(table, q) {
      if (table === 'properties') {
        if (q.includes('status=eq.payment_pending')) return props.filter((p) => p.status === 'payment_pending');
        if (q.includes('offered_at=not.is.null')) return props.filter((p) => p.raw_data?.paid_listing?.gift?.offered_at);
        if (q.includes('id=eq.')) { const id = decodeURIComponent(q.split('id=eq.')[1].split('&')[0]); return props.filter((p) => p.id === id); }
        return props;
      }
      if (table === 'users') return users;
      if (table === 'email_log') return log.filter((r) => r.status !== 'removed').map((r) => ({ dedupe_key: r.dedupe_key }));
      if (table === 'automations') {
        if (q.includes('paid_listings')) return [{ id: 'paid_listings', enabled: true, first_tier_count: 2, free_days: 90, milestones: [2900, 80, 500, 2] }];
        if (q.includes(PAYMENT_FOLLOWUP_ID)) return giftRow ? [giftRow] : [];
        return [];
      }
      return [];
    },
    async insert(table, rows) {
      const r = rows[0];
      if (log.some((x) => x.dedupe_key === r.dedupe_key)) { const e = new Error('dup'); e.code = '23505'; throw e; }
      const row = { id: `l${log.length}`, ...r }; log.push(row); return [row];
    },
    async update(table, q, patch) {
      if (table === 'email_log') { const id = decodeURIComponent(q.split('eq.')[1]); Object.assign(log.find((x) => x.id === id) || {}, patch); return; }
      const id = decodeURIComponent(q.split('id=eq.')[1].split('&')[0]);
      const p = props.find((x) => x.id === id);
      if (!p || (q.includes('status=eq.payment_pending') && p.status !== 'payment_pending')) return [];
      Object.assign(p, patch); updates.push({ id, patch }); return [p];
    },
    async remove() {},
  };
}
const tpl = (id, key) => ({ id, key, subject: key, heading: '', body: 'Hola {{name}} {{property_title}} {{price}} {{claim_url}}', button_label: 'Ir', button_url: '{{my_listings_url}}', is_active: true });
const templates = [tpl('t-rem', 'listing-held-payment'), tpl('t-gift', 'payment-gift')];
const row = (over = {}) => ({ id: PAYMENT_FOLLOWUP_ID, enabled: true, enabled_at: '2026-10-01T00:00:00Z', milestones: [24, 72, 168], wait_days: 8, first_tier_count: 1, free_tiers: [{ gift_window_days: 0 }], free_days: 90, template_id: 't-rem', gift_template_id: 't-gift', ...over });

function scenario(now, ageH, extra = []) {
  const at = (h) => new Date(now.getTime() - h * H).toISOString();
  return [
    { id: 'p3', created_by: 'u1', created_at: at(ageH), status: 'payment_pending', property_type: 'Casa', city: 'Luque', contact_phone: '0981111222', raw_data: { paid_listing: { state: 'pending' } } },
    ...extra,
  ];
}
const users = [{ id: 'u1', email: 'ana@example.com', full_name: 'Ana Prueba', active: true }];
const sent = [];
const deliver = async (m) => { sent.push(m); return { ok: true, id: `re_${sent.length}` }; };

test('reminders on their own schedule, then ONE gift, then nothing', async () => {
  const now = new Date('2026-10-29T14:00:00Z');
  const props = scenario(now, 25);
  const db = fakeDb({ now, props, users });
  const go = (t) => runPaymentFollowup({ db, automation: row(), templates, now: t, deliver, siteUrl: 'https://s', phonePrefix: '595', claimUrl: (p) => `https://s/api/listing-gift/claim?token=T-${p.id}` });

  let r = await go(now);
  assert.equal(r.reminders, 1);                             // 25 h → step 1 (24 h)
  assert.ok(db.log.some((l) => l.dedupe_key === 'payrem:p3:1'));
  r = await go(now);
  assert.equal(r.reminders, 0);                             // never twice
  r = await go(new Date(now.getTime() + 48 * H));           // 73 h → step 2
  assert.equal(r.reminders, 1);
  r = await go(new Date(now.getTime() + 8 * D));            // past 8 days → the gift
  assert.equal(r.gifts, 1);
  const g = props[0].raw_data.paid_listing.gift;
  assert.ok(g.offered_at && g.expires_at && !g.claimed_at);
  assert.equal(props[0].raw_data.paid_listing.state, 'pending');   // still pending until they claim
  assert.ok(db.log.some((l) => l.dedupe_key === 'paygift:p3'));
  r = await go(new Date(now.getTime() + 9 * D));
  assert.equal(r.gifts + r.reminders, 0);                   // after the gift: nothing more
});

test('the per-person limit: a second pending listing gets no gift while one is open or claimed', async () => {
  const now = new Date('2026-10-29T14:00:00Z');
  const at = (d) => new Date(now.getTime() - d * D).toISOString();
  const props = scenario(now, 10 * 24, [
    // same person (same phone, other account) already claimed a gift last month
    { id: 'old', created_by: 'u9', created_at: at(40), status: 'published', contact_phone: '+595981111222', raw_data: { paid_listing: { state: 'active', gift: { offered_at: at(39), expires_at: at(25), claimed_at: at(38) } } } },
  ]);
  const db = fakeDb({ now, props, users });
  const r = await runPaymentFollowup({ db, automation: row(), templates, now, deliver, phonePrefix: '595' });
  assert.equal(r.gifts, 0);
  assert.equal(r.giftLimit, 1);
  // allow 2 per person → it gets one
  const r2 = await runPaymentFollowup({ db, automation: row({ first_tier_count: 2 }), templates, now, deliver, phonePrefix: '595' });
  assert.equal(r2.gifts, 1);
  // a 30-day window → last month's gift no longer counts
  const props3 = scenario(now, 10 * 24, [props[1]]);
  const db3 = fakeDb({ now, props: props3, users });
  const r3 = await runPaymentFollowup({ db: db3, automation: row({ free_tiers: [{ gift_window_days: 30 }] }), templates, now, deliver, phonePrefix: '595' });
  assert.equal(r3.gifts, 1);
});

test('gift off (wait_days 0): reminders only', async () => {
  const now = new Date('2026-10-29T14:00:00Z');
  const props = scenario(now, 20 * 24);
  const db = fakeDb({ now, props, users });
  const r = await runPaymentFollowup({ db, automation: row({ wait_days: 0, milestones: [24, 72, 168] }), templates, now, deliver });
  assert.equal(r.gifts, 0);
  assert.equal(r.reminders, 0);                             // 20 days: the last step is more than 7 days late
  assert.ok(!props[0].raw_data.paid_listing.gift);
});

test('claiming: only that seller, only that listing, once', async () => {
  const now = new Date('2026-10-29T14:00:00Z');
  const props = scenario(now, 9 * 24);
  props[0].raw_data.paid_listing.gift = { offered_at: new Date(now.getTime() - D).toISOString(), expires_at: new Date(now.getTime() + 13 * D).toISOString() };
  const db = fakeDb({ now, props, users, giftRow: row({ free_days: 60 }) });
  const scans = [];
  const startScan = (id) => scans.push(id);
  assert.deepEqual(await claimListingGift({ db, userId: 'u2', propertyId: 'p3', now, startScan }), { ok: false, reason: 'invalid' });   // someone else
  const ok = await claimListingGift({ db, userId: 'u1', propertyId: 'p3', now, startScan });
  assert.deepEqual(ok, { ok: true });
  assert.equal(props[0].status, 'scanning');
  const pl = props[0].raw_data.paid_listing;
  assert.equal(pl.state, 'active');
  assert.ok(pl.gift.claimed_at);
  assert.equal(Math.round((Date.parse(pl.until) - now.getTime()) / D), 60);
  assert.deepEqual(scans, ['p3']);
  assert.deepEqual(await claimListingGift({ db, userId: 'u1', propertyId: 'p3', now, startScan }), { ok: true, already: true });
  assert.equal(scans.length, 1);
});

test('claiming an expired offer / a listing with no offer', async () => {
  const now = new Date('2026-10-29T14:00:00Z');
  const props = scenario(now, 30 * 24, [{ id: 'p4', created_by: 'u1', created_at: now.toISOString(), status: 'payment_pending', raw_data: { paid_listing: { state: 'pending' } } }]);
  props[0].raw_data.paid_listing.gift = { offered_at: new Date(now.getTime() - 20 * D).toISOString(), expires_at: new Date(now.getTime() - 6 * D).toISOString() };
  const db = fakeDb({ now, props, users });
  assert.deepEqual(await claimListingGift({ db, userId: 'u1', propertyId: 'p3', now }), { ok: false, reason: 'expired' });
  assert.deepEqual(await claimListingGift({ db, userId: 'u1', propertyId: 'p4', now }), { ok: false, reason: 'invalid' });
  assert.equal(props[0].status, 'payment_pending');
});

test('"Listing not published" leaves the payment reason to this automation when asked', async () => {
  const now = new Date('2026-10-29T14:00:00Z');
  const props = [{ id: 'p1', created_by: 'u1', created_at: new Date(now.getTime() - 5 * H).toISOString(), status: 'payment_pending', admin_status: 'inactive', is_complete: true, raw_data: {} }];
  const db = fakeDb({ now, props, users });
  const heldRow = { id: 'listing_held', enabled: true, enabled_at: '2026-10-01T00:00:00Z', milestones: [3, 48] };
  const tpls = [tpl('h1', 'listing-held-payment')];
  const off = await runListingHeld({ db, automation: heldRow, templates: tpls, now, deliver, skipReasons: ['payment'] });
  assert.equal(off.checked, 0);
  const on = await runListingHeld({ db, automation: heldRow, templates: tpls, now, deliver });
  assert.equal(on.sent, 1);
});
