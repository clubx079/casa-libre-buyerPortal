import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './support/fakePostgrest.mjs';
import { deleteAccount, deletedEmailFor, isDeletedEmail } from '../lib/accountDeletion.js';

const U = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'ana@example.com';

function seeded() {
  const db = createStore({ unique: { users: ['email'] } });
  db.seed('users', [
    { id: U, email: EMAIL, full_name: 'Ana Pérez', phone: '0981 123456', password_hash: 'x', google_id: 'g-1', auth_provider: 'google', verified: true, active: true,
      stripe_customer_id: 'cus_1', card_brand: 'visa', card_last4: '4242', card_exp_month: 1, card_exp_year: 2030, card_pm_id: 'pm_1', registration_ip: '1.2.3.4', ip_address: '1.2.3.4' },
    { id: OTHER, email: 'other@example.com', full_name: 'Other', active: true },
  ]);
  db.seed('properties', [
    { id: 'p1', created_by: U, posted_by: U, contact_name: 'Ana', contact_phone: '0981123456', admin_status: 'active', origin: 'user',
      raw_data: { published_via: 'buyer-portal', user_id: U, user_email: EMAIL } },
    { id: 'p2', created_by: OTHER, posted_by: OTHER, contact_name: 'Other', contact_phone: '0981000000', raw_data: { user_id: OTHER } },
    { id: 'p3', created_by: null, posted_by: null, contact_name: 'RE/MAX', contact_phone: '021000000', origin: 'scraper' },
  ]);
  db.seed('payments', [{ id: 'pay1', user_id: U, amount_usd: 5, status: 'succeeded', card_last4: '4242' }]);
  db.seed('favorites', [{ user_id: U, property_id: 'p2' }, { user_id: OTHER, property_id: 'p1' }]);
  db.seed('listing_drafts', [{ user_id: U, data: { contact_phone: '0981' } }]);
  db.seed('push_tokens', [{ user_id: U, token: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]' }]);
  db.seed('notification_prefs', [{ user_id: U, news: false }]);
  db.seed('push_log', [{ user_id: U, title: 'Hola Ana' }]);
  db.seed('automation_runs', [{ automation_id: 'first-listing', user_id: U, status: 'gifted' }]);
  db.seed('listing_view_milestones', [{ property_id: 'p1', user_id: U, last_milestone: 50 }]);
  db.seed('email_log', [{ to_email: EMAIL, subject: 'Bienvenida' }, { to_email: 'other@example.com', subject: 'x' }]);
  db.seed('contact_link_clicks', [{ buyer_user_id: U, buyer_email: EMAIL, property_id: 'p2' }]);
  db.seed('feedback', [{ user_id: U, name: 'Ana', email: EMAIL, message: 'Me gusta' }]);
  db.seed('otp_codes', [{ identifier: EMAIL, purpose: 'login' }, { identifier: 'other@example.com', purpose: 'login' }]);
  return db;
}

test('the account row is anonymised and switched off (kept for payment records)', async () => {
  const db = seeded();
  const r = await deleteAccount(db, { uid: U, email: EMAIL });
  assert.equal(r.ok, true);
  const [u] = db.tables.users.filter((x) => x.id === U);
  assert.equal(u.email, deletedEmailFor(U));
  assert.equal(u.active, false);
  for (const k of ['full_name', 'phone', 'password_hash', 'google_id', 'card_brand', 'card_last4', 'card_exp_month', 'card_exp_year', 'card_pm_id', 'registration_ip', 'ip_address']) {
    assert.equal(u[k], null, k);
  }
  assert.equal(db.tables.payments.length, 1, 'payment history kept');
  assert.equal(db.tables.users.find((x) => x.id === OTHER).email, 'other@example.com');
});

test('their listings stay, without their name, phone or link to the account', async () => {
  const db = seeded();
  await deleteAccount(db, { uid: U, email: EMAIL });
  const p1 = db.tables.properties.find((p) => p.id === 'p1');
  assert.equal(p1.admin_status, 'active');
  assert.equal(p1.contact_name, null);
  assert.equal(p1.contact_phone, null);
  assert.equal(p1.created_by, null);
  assert.equal(p1.posted_by, null);
  assert.deepEqual(p1.raw_data, { published_via: 'buyer-portal', owner_account_deleted: true });
  const p2 = db.tables.properties.find((p) => p.id === 'p2');
  assert.equal(p2.contact_phone, '0981000000', 'other users untouched');
  assert.equal(db.tables.properties.find((p) => p.id === 'p3').contact_name, 'RE/MAX', 'agency listings untouched');
});

test('personal data elsewhere is deleted or blanked; other users untouched', async () => {
  const db = seeded();
  await deleteAccount(db, { uid: U, email: EMAIL });
  const mine = (t, col = 'user_id') => (db.tables[t] || []).filter((r) => r[col] === U);
  for (const t of ['listing_drafts', 'push_tokens', 'notification_prefs', 'push_log']) assert.equal(mine(t).length, 0, t);
  assert.deepEqual(db.tables.favorites.map((f) => f.user_id), [OTHER]);
  assert.equal(db.tables.automation_runs[0].status, 'skipped');
  assert.equal(db.tables.automation_runs[0].skip_reason, 'account_deleted');
  assert.equal(db.tables.listing_view_milestones[0].user_id, null);
  assert.deepEqual(db.tables.email_log.map((e) => e.to_email).sort(), [deletedEmailFor(U), 'other@example.com'].sort());
  assert.equal(db.tables.contact_link_clicks[0].buyer_user_id, null);
  assert.equal(db.tables.contact_link_clicks[0].buyer_email, null);
  const fb = db.tables.feedback[0];
  assert.equal(fb.user_id, null); assert.equal(fb.name, null); assert.equal(fb.email, null);
  assert.equal(fb.message, 'Me gusta');
  assert.deepEqual(db.tables.otp_codes.map((o) => o.identifier), ['other@example.com']);
});

test('running it twice is safe (a retry after a partial failure)', async () => {
  const db = seeded();
  assert.equal((await deleteAccount(db, { uid: U, email: EMAIL })).ok, true);
  assert.equal((await deleteAccount(db, { uid: U, email: deletedEmailFor(U) })).ok, true);
  assert.equal(db.tables.users.find((x) => x.id === U).active, false);
});

test('a table this country database does not have is skipped', async () => {
  const db = seeded();
  const missing = new Set(['push_tokens', 'notification_prefs', 'push_log', 'listing_drafts']);
  const gappy = { ...db };
  for (const fn of ['select', 'update', 'remove']) {
    gappy[fn] = async (table, ...a) => {
      if (missing.has(table)) { const e = new Error('relation does not exist'); e.status = 404; e.code = 'PGRST205'; throw e; }
      return db[fn](table, ...a);
    };
  }
  const r = await deleteAccount(gappy, { uid: U, email: EMAIL });
  assert.equal(r.ok, true);
  assert.equal(db.tables.users.find((x) => x.id === U).active, false);
});

test('a real failure stops BEFORE the account row is touched, so the user can retry', async () => {
  const db = seeded();
  const broken = { ...db, remove: async (table, f) => { if (table === 'favorites') { const e = new Error('boom'); e.status = 500; throw e; } return db.remove(table, f); } };
  const r = await deleteAccount(broken, { uid: U, email: EMAIL });
  assert.equal(r.ok, false);
  assert.ok(r.failed.some((s) => s.startsWith('favorites')));
  const u = db.tables.users.find((x) => x.id === U);
  assert.equal(u.active, true);
  assert.equal(u.email, EMAIL);
});

test('only columns the row actually has are written (older country databases)', async () => {
  const db = createStore();
  db.seed('users', [{ id: U, email: EMAIL, full_name: 'Ana', active: true }]);   // no card_*, ip, google columns
  const strict = { ...db, update: async (table, f, patch) => {
    const row = db.tables[table]?.[0] || {};
    const unknown = Object.keys(patch).filter((k) => !(k in row));
    if (table === 'users' && unknown.length) { const e = new Error(`column ${unknown[0]} does not exist`); e.status = 400; e.code = 'PGRST204'; throw e; }
    return db.update(table, f, patch);
  } };
  const r = await deleteAccount(strict, { uid: U, email: EMAIL });
  assert.equal(r.ok, true);
  assert.equal(db.tables.users[0].active, false);
});

test('deleted-account addresses are recognised (email sending skips them)', () => {
  assert.equal(isDeletedEmail(deletedEmailFor(U)), true);
  assert.equal(isDeletedEmail([deletedEmailFor(U)]), true);
  assert.equal(isDeletedEmail('ana@example.com'), false);
  assert.equal(isDeletedEmail(null), false);
});

test('refuses without a user id', async () => {
  const r = await deleteAccount(seeded(), { uid: '', email: EMAIL });
  assert.equal(r.ok, false);
});
