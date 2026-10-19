import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heldReason, missingDetails, normalizeSteps, heldConfig, runListingHeld } from '../lib/automations/listingHeld.js';

test('why a user listing is held', () => {
  assert.equal(heldReason({ status: 'payment_pending', admin_status: 'inactive' }), 'payment');
  assert.equal(heldReason({ status: 'rejected', admin_status: 'inactive' }), 'photos');
  assert.equal(heldReason({ status: 'published', admin_status: 'inactive', is_complete: true }), 'paused');
  assert.equal(heldReason({ status: 'published', admin_status: 'active', is_complete: false }), 'incomplete');
  assert.equal(heldReason({ status: 'published', admin_status: 'active', is_complete: true }), null);   // live
  for (const s of ['duplicate_review', 'expired', 'scanning']) assert.equal(heldReason({ status: s, admin_status: 'inactive' }), null);
});

test('missing details in plain Spanish', () => {
  assert.equal(missingDetails({ price: 0, floor_area: 0, neighborhood: 'Luque', contact_phone: '0981123456', feature_image_url: 'x' }), 'precio y superficie');
  assert.equal(missingDetails({ price: 1, floor_area: 50, city: 'Luque', contact_phone: '0981123456', feature_image_url: null }), 'fotos');
  assert.equal(missingDetails({ price: 1, floor_area: 50, city: 'Luque', contact_phone: '0981123456', feature_image_url: 'x' }), 'algunos datos de la propiedad');
});

test('steps in hours', () => {
  assert.deepEqual(normalizeSteps([48, '3', 0, 9999, 3]), [3, 48]);
  assert.deepEqual(heldConfig({ enabled: true, enabled_at: 'x', milestones: [] }).steps, [3, 48]);
  assert.equal(heldConfig({ enabled: true }).enabled, false);   // never switched on → no enabled_at
});

// Fake DB: three held listings of one owner, one live, one older than the switch-on.
function fakeDb(now) {
  const h = (n) => new Date(now - n * 3600e3).toISOString();
  const log = [];
  const props = [
    { id: 'p1', created_by: 'u1', created_at: h(5), status: 'payment_pending', admin_status: 'inactive', is_complete: true, property_type: 'Casa', city: 'Capiatá', raw_data: {} },
    { id: 'p2', created_by: 'u1', created_at: h(10), status: 'rejected', admin_status: 'inactive', is_complete: true, property_type: 'Terreno', city: 'Luque', raw_data: { moderation: { checked_at: h(1) } } },
    { id: 'p3', created_by: 'u1', created_at: h(6), status: 'published', admin_status: 'active', is_complete: true, property_type: 'Casa', city: 'Asunción', raw_data: {} },
  ];
  return {
    log,
    async select(table, q) {
      if (table === 'properties') return props;
      if (table === 'users') return [{ id: 'u1', email: 'ana@example.com', full_name: 'Ana Prueba', active: true }];
      if (table === 'email_log') return log.map((r) => ({ dedupe_key: r.dedupe_key }));
      if (table === 'automations') return q.includes('paid_listings') ? [{ id: 'paid_listings', first_tier_count: 2, free_days: 60, milestones: [2900, 80, 500, 2] }] : [];
      return [];
    },
    async insert(table, rows) { const r = rows[0]; if (log.some((x) => x.dedupe_key === r.dedupe_key)) { const e = new Error('dup'); e.code = '23505'; throw e; } const row = { id: `l${log.length}`, ...r }; log.push(row); return [row]; },
    async update(table, q, patch) { const id = decodeURIComponent(q.split('eq.')[1]); Object.assign(log.find((x) => x.id === id) || {}, patch); },
    async remove() {},
  };
}
const tpl = (key, subject) => ({ id: `t-${key}`, key, subject, heading: '', body: 'Hola {{name}}, {{property_title}} — {{price}} {{paid_days}} días', button_label: 'Ir', button_url: '{{my_listings_url}}', is_active: true });
const templates = [tpl('listing-held-payment', 'Tu publicación está lista, falta el pago'), tpl('listing-held-photos', 'Revisá las fotos')];

test('runs once per listing and reason, with the My listings button; a second run sends nothing', async () => {
  const now = Date.parse('2026-10-19T15:00:00Z');   // 12:00 in Paraguay (daytime)
  const db = fakeDb(now);
  const sent = [];
  const deps = { db, automation: { id: 'listing_held', enabled: true, enabled_at: '2026-10-01T00:00:00Z', milestones: [3, 48] }, templates, now: new Date(now), deliver: async (m) => { sent.push(m); return { ok: true, id: 'r' }; }, frame: {}, siteUrl: 'https://casa-libre.com.py', countryCode: 'py' };
  const r1 = await runListingHeld(deps);
  assert.equal(r1.checked, 2);           // p1 waiting for payment, p2 photos rejected (p3 is live)
  assert.equal(r1.sent, 1);              // p1 is 5 h held (≥ 3 h); p2 was rejected only 1 h ago
  assert.equal(db.log[0].dedupe_key, 'held:p1:payment:1');
  assert.match(sent[0].subject, /falta el pago/);
  assert.match(sent[0].html, /cuenta\/publicaciones/);
  assert.match(sent[0].text, /US\$5\.80 60 días/);
  const r2 = await runListingHeld(deps);
  assert.equal(r2.sent, 0);
});

test('switched off or at night: nothing', async () => {
  const now = Date.parse('2026-10-19T15:00:00Z');
  const base = { db: fakeDb(now), templates, deliver: async () => ({ ok: true }), siteUrl: '', countryCode: 'py' };
  assert.equal((await runListingHeld({ ...base, automation: { enabled: false }, now: new Date(now) })).skippedReason, 'disabled');
  assert.equal((await runListingHeld({ ...base, automation: { enabled: true, enabled_at: '2026-10-01T00:00:00Z' }, now: new Date('2026-10-19T05:00:00Z') })).skippedReason, 'night');
});
