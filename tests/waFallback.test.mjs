import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sendOnce, sendEmailFallback } from '../lib/automations/sendOnce.js';
import { _resetWhatsappCache } from '../lib/automations/whatsappSend.js';
import { keepFallback, takeFallback, FALLBACK_ID, KEEP_HOURS } from '../lib/automations/waFallback.js';

// In-memory DB: automations (one automation + the wa_fallbacks row), users, email_log (unique dedupe_key).
function fakeDb({ channel = 'whatsapp_first' } = {}) {
  const log = [];
  const autos = new Map([['listing_views_milestone', { id: 'listing_views_milestone', channel, wa_templates: { tpl1: 'cl_visitas' } }]]);
  const idOf = (q) => decodeURIComponent((q.match(/id=eq\.([^&]+)/) || [])[1] || '');
  return {
    log, autos,
    async select(table, q) {
      if (table === 'automations') { const r = autos.get(idOf(q)); return r ? [r] : []; }
      if (table === 'users') return q.includes(encodeURIComponent('priscila@example.com')) ? [{ id: 'u1', email: 'priscila@example.com', phone: '+595693953978' }] : [];
      return [];
    },
    async insert(table, rows) {
      const r = rows[0];
      if (table === 'automations') { autos.set(r.id, { ...r }); return [r]; }
      if (log.some((x) => x.dedupe_key === r.dedupe_key)) { const e = new Error('dup'); e.code = '23505'; throw e; }
      const row = { id: `l${log.length + 1}`, ...r }; log.push(row); return [row];
    },
    async update(table, q, patch) {
      if (table === 'automations') { Object.assign(autos.get(idOf(q)), patch); return; }
      Object.assign(log.find((x) => x.id === idOf(q)), patch);
    },
    async remove(table, q) { log.splice(log.findIndex((x) => x.id === idOf(q)), 1); },
  };
}

beforeEach(() => {
  _resetWhatsappCache();
  process.env.RELAY_API_KEY = 'rk_test_x';
  delete process.env.WHATSAPP_TEST_TO;
  // Relay accepts the message (Meta's "undeliverable" only comes later, by webhook)
  globalThis.fetch = async (url, init) => (init?.body ? new Response(JSON.stringify({ id: 'msg_relay_1', status: 'queued' }), { status: 202 }) : new Response(JSON.stringify({ data: [] }), { status: 200 }));
});

const tpl = { id: 'tpl1', key: 'listing-views', subject: 'Tu propiedad ya tiene {{views}} visitas', heading: '', body: 'Hola {{name}}', button_label: '', button_url: '' };
const vars = { name: 'Priscila', property_title: 'Casa · Itauguá', views: '10', property_url: 'https://casa-libre.com.py/propiedad/abc' };

test('WhatsApp accepted, then Meta says undeliverable → the email goes out, once', async () => {
  const db = fakeDb();
  const emails = [];
  const deliver = async (m) => { emails.push(m); return { ok: true, id: 'res_1' }; };
  const base = { db, automationId: 'listing_views_milestone', dedupeKey: 'views:p1:10', tpl, vars, to: 'priscila@example.com', frame: {}, deliver };
  assert.equal(await sendOnce(base), 'sent');                 // the WhatsApp (accepted by Relay)
  assert.equal(emails.length, 0);
  const entry = await takeFallback(db, 'msg_relay_1');        // webhook: message.failed (131026)
  assert.equal(entry.dedupeKey, 'views:p1:10');
  assert.equal(entry.to, 'priscila@example.com');
  assert.equal(await sendEmailFallback({ db, entry, tpl, frame: {}, deliver }), 'sent');
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /10 visitas/);
  assert.equal(await takeFallback(db, 'msg_relay_1'), null);  // a second "failed" event: nothing left
  // and the automation's own email with the same key can never duplicate it
  assert.equal(await sendEmailFallback({ db, entry, tpl, frame: {}, deliver }), 'duplicate');
  assert.equal(emails.length, 1);
});

test('delivered → the waiting email is dropped; old entries expire', async () => {
  const db = fakeDb();
  const now = Date.parse('2026-10-26T12:00:00Z');
  await keepFallback(db, { relayId: 'a', automationId: 'x', dedupeKey: 'k1', templateId: 't', vars: {}, to: 'p@x.com' }, now - (KEEP_HOURS + 1) * 3600e3);
  await keepFallback(db, { relayId: 'b', automationId: 'x', dedupeKey: 'k2', templateId: 't', vars: {}, to: 'p@x.com' }, now);
  assert.equal(await takeFallback(db, 'a', now), null);       // too old
  assert.ok(await takeFallback(db, 'b', now));                // delivered → taken (dropped)
  assert.deepEqual(db.autos.get(FALLBACK_ID).free_tiers[0].pending, []);
});

test('channel "both" sends the email anyway → nothing kept', async () => {
  const db = fakeDb({ channel: 'both' });
  const deliver = async () => ({ ok: true, id: 'r' });
  await sendOnce({ db, automationId: 'listing_views_milestone', dedupeKey: 'views:p2:10', tpl, vars, to: 'priscila@example.com', frame: {}, deliver });
  assert.equal(db.autos.get(FALLBACK_ID), undefined);
});
