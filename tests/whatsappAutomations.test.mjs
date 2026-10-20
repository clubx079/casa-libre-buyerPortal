import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sendOnce } from '../lib/automations/sendOnce.js';
import { _resetWhatsappCache } from '../lib/automations/whatsappSend.js';
import { waVariables, waAllowed } from '../lib/whatsappTemplates.js';

// A tiny in-memory DB: one automation row, users, and email_log with a unique dedupe_key.
function fakeDb({ channel = 'email', wa = { tpl1: 'cl_visitas' }, user = {} } = {}) {
  const log = [];
  return {
    log,
    async select(table, q) {
      if (table === 'automations') return [{ id: 'listing_views_milestone', channel, wa_templates: wa }];
      if (table === 'users') return q.includes(encodeURIComponent('ana@example.com')) ? [{ id: 'u1', email: 'ana@example.com', phone: '0981 123 456', ...user }] : [];
      return [];
    },
    async insert(table, rows) {
      const r = rows[0];
      if (log.some((x) => x.dedupe_key === r.dedupe_key)) { const e = new Error('dup'); e.code = '23505'; throw e; }
      const row = { id: `l${log.length + 1}`, ...r };
      log.push(row);
      return [row];
    },
    async update(table, q, patch) { const id = decodeURIComponent(q.split('eq.')[1]); Object.assign(log.find((x) => x.id === id), patch); },
    async remove(table, q) { const id = decodeURIComponent(q.split('eq.')[1]); log.splice(log.findIndex((x) => x.id === id), 1); },
  };
}

const sentToRelay = [];
beforeEach(() => {
  _resetWhatsappCache();
  sentToRelay.length = 0;
  process.env.RELAY_API_KEY = 'rk_test_x';
  delete process.env.WHATSAPP_TEST_TO;
  globalThis.fetch = async (url, init) => { if (!init?.body) return new Response(JSON.stringify({ data: [] }), { status: 200 }); sentToRelay.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ id: 'msg_1', status: 'queued' }), { status: 202 }); };
});

const tpl = { id: 'tpl1', key: 'listing-views', subject: 'Tu propiedad ya tiene {{views}} visitas', heading: '', body: 'Hola {{name}}', button_label: '', button_url: '' };
const vars = { name: 'Ana', property_title: 'Casa · Luque', views: '50', property_url: 'https://casa-libre.com.py/propiedad/abc-123' };
const emails = [];
const deliver = async (m) => { emails.push(m); return { ok: true, id: 'res_1' }; };
const base = (db) => ({ db, automationId: 'listing_views_milestone', dedupeKey: 'views:p1:50', tpl, vars, to: 'ana@example.com', frame: {}, deliver });

test('email channel: only the email', async () => {
  emails.length = 0;
  const db = fakeDb({ channel: 'email' });
  assert.equal(await sendOnce(base(db)), 'sent');
  assert.equal(emails.length, 1);
  assert.equal(sentToRelay.length, 0);
});

test('whatsapp channel with consent: the WhatsApp template, no email', async () => {
  emails.length = 0;
  const db = fakeDb({ channel: 'whatsapp', user: { whatsapp_opt_in_at: '2026-10-19T00:00:00Z' } });
  assert.equal(await sendOnce(base(db)), 'sent');
  assert.equal(emails.length, 0);
  const msgs = sentToRelay.filter((x) => x.url.includes('/messages/'));
  assert.equal(msgs.length, 1);
  assert.deepEqual(msgs[0].body.variables, { body: ['Ana', 'Casa · Luque', '50'], buttons: [{ index: 0, text: 'abc-123?utm_source=whatsapp&utm_medium=whatsapp&utm_campaign=cl_visitas' }] });
  assert.equal(msgs[0].body.to, '+595981123456');
  const row = db.log[0];
  assert.equal(row.channel, 'whatsapp');
  assert.equal(row.status, 'sent');
  assert.equal(row.relay_message_id, 'msg_1');
  assert.equal(row.dedupe_key, 'views:p1:50:wa');
  // the same send again is a duplicate (never twice)
  assert.equal(await sendOnce(base(db)), 'duplicate');
  assert.equal(sentToRelay.length, 1);
});

test('whatsapp channel, nobody with that email / no number → falls back to email', async () => {
  emails.length = 0;
  const db = fakeDb({ channel: 'whatsapp', user: { phone: null } });
  assert.equal(await sendOnce(base(db)), 'sent');
  assert.equal(sentToRelay.length, 0);
  assert.equal(emails.length, 1);
});

test('both: email and WhatsApp', async () => {
  emails.length = 0;
  const db = fakeDb({ channel: 'both', user: { whatsapp_opt_in_at: '2026-10-18T00:00:00Z' } });
  assert.equal(await sendOnce(base(db)), 'sent');
  assert.equal(emails.length, 1);
  assert.equal(sentToRelay.length, 1);
  assert.deepEqual(db.log.map((r) => r.channel || 'email').sort(), ['email', 'whatsapp']);
});

test('no WhatsApp template picked for this email → email only', async () => {
  emails.length = 0;
  const db = fakeDb({ channel: 'whatsapp', wa: {}, user: { whatsapp_opt_in_at: 'x' } });
  assert.equal(await sendOnce(base(db)), 'sent');
  assert.equal(sentToRelay.length, 0);
  assert.equal(emails.length, 1);
});

test('a Relay failure falls back to email and frees the WhatsApp claim', async () => {
  emails.length = 0;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'template_not_approved' } }), { status: 409 });
  const db = fakeDb({ channel: 'whatsapp', user: { whatsapp_opt_in_at: 'x' } });
  assert.equal(await sendOnce(base(db)), 'sent');
  assert.equal(emails.length, 1);
  assert.ok(!db.log.some((r) => r.channel === 'whatsapp'));
});

test('variables: a missing value means no WhatsApp; marketing needs consent', () => {
  assert.equal(waVariables('cl_visitas', { ...vars, views: '' }), null);
  assert.deepEqual(waVariables('cl_publicacion_vence', { name: 'Ana', property_title: 'Casa', listing_until: '10 de enero', free_days: '30', price: 'US$5', extend_url: 'https://casa-libre.com.py/cuenta/publicaciones?extend=p-9' }).buttons, [{ index: 0, text: 'p-9&utm_source=whatsapp&utm_medium=whatsapp&utm_campaign=cl_publicacion_vence' }]);
  assert.equal(waAllowed({ phone: '0981 123 456' }, 'marketing'), true);    // no consent box: a number is enough
  assert.equal(waAllowed({ phone: '0981 123 456', whatsapp_opted_out_at: 'y' }, 'utility'), false);
  assert.equal(waAllowed(null, 'utility'), false);
});

test('Relay webhook signature', async () => {
  const { verifyRelaySignature } = await import('../lib/relaySignature.js');
  const { createHmac } = await import('node:crypto');
  const body = '{"type":"message.read"}'; const t = 1760543152;
  const v1 = createHmac('sha256', 'whsec_x').update(`${t}.${body}`).digest('hex');
  assert.equal(verifyRelaySignature(body, `t=${t},v1=${v1}`, 'whsec_x', 300, t + 10), true);
  assert.equal(verifyRelaySignature(body + ' ', `t=${t},v1=${v1}`, 'whsec_x', 300, t + 10), false);
  assert.equal(verifyRelaySignature(body, `t=${t},v1=${v1}`, 'whsec_x', 300, t + 1000), false);
});

test('someone who opted out (STOP / No recibir más) gets the email, not WhatsApp', async () => {
  emails.length = 0;
  const db = fakeDb({ channel: 'whatsapp', user: { whatsapp_opted_out_at: '2026-10-18T00:00:00Z' } });
  assert.equal(await sendOnce(base(db)), 'sent');
  assert.equal(sentToRelay.filter((x) => x.url.includes('/messages/')).length, 0);
  assert.equal(emails.length, 1);
});

test('WhatsApp only (no email fallback): someone without a number gets nothing', async () => {
  emails.length = 0;
  const db = fakeDb({ channel: 'whatsapp', wa: { tpl1: 'cl_visitas', __no_fallback: true }, user: { phone: null } });
  assert.equal(await sendOnce(base(db)), 'no_email');
  assert.equal(emails.length, 0);
});

test('a DB without migration 017 (live today): plain email, the channel lookup asked once', async () => {
  emails.length = 0;
  let asked = 0;
  const db = fakeDb();
  db.select = async (table) => { if (table === 'automations') { asked++; const e = new Error('unknown column "channel"'); e.code = 'PGRST100'; throw e; } return []; };
  for (let i = 0; i < 3; i++) assert.equal(await sendOnce({ ...base(db), dedupeKey: `k${i}` }), 'sent');
  assert.equal(emails.length, 3);
  assert.equal(asked, 1);
  assert.ok(db.log.every((r) => !('channel' in r)));   // email rows look exactly as before
});
