import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sendOnce } from '../lib/automations/sendOnce.js';
import { _resetWhatsappCache, preferV2 } from '../lib/automations/whatsappSend.js';

// An automation slot set to X sends X_v2 once Relay says X_v2 is APPROVED (and the registry
// knows X_v2); until then X keeps going out.

function fakeDb({ wa }) {
  const log = [];
  return {
    log,
    async select(table, q) {
      if (table === 'automations') return [{ id: 'auto1', channel: 'whatsapp', wa_templates: wa }];
      if (table === 'users') return q.includes(encodeURIComponent('ana@example.com')) ? [{ id: 'u1', email: 'ana@example.com', phone: '0981 123 456' }] : [];
      return [];
    },
    async insert(table, rows) { const row = { id: `l${log.length + 1}`, ...rows[0] }; log.push(row); return [row]; },
    async update(table, q, patch) { const id = decodeURIComponent(q.split('eq.')[1]); Object.assign(log.find((x) => x.id === id), patch); },
    async remove(table, q) { const id = decodeURIComponent(q.split('eq.')[1]); log.splice(log.findIndex((x) => x.id === id), 1); },
  };
}

let relayList = [];
const sent = [];
beforeEach(() => {
  _resetWhatsappCache();
  sent.length = 0;
  process.env.RELAY_API_KEY = 'rk_test_x';
  delete process.env.WHATSAPP_TEST_TO;
  globalThis.fetch = async (url, init) => {
    if (!init?.body) return new Response(JSON.stringify({ data: relayList }), { status: 200 });
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'msg_1', status: 'queued' }), { status: 202 });
  };
});

const tpl = { id: 'tpl1', key: 'listing-held-payment', subject: 'x', heading: '', body: 'Hola {{name}}', button_label: '', button_url: '' };
const vars = { name: 'Ana', property_title: 'Casa en Luque', price: 'US$5,80', paid_days: '90', pay_url: 'https://casa-libre.com.py/cuenta/publicaciones?pay_listing=abc-123' };
const run = (db, v = vars) => sendOnce({ db, automationId: 'auto1', dedupeKey: `k${Math.random()}`, tpl, vars: v, to: 'ana@example.com', frame: {}, deliver: async () => ({ ok: true, id: 'e1' }) });
const rel = (name, status, language = 'es_MX') => ({ name, status, language, category: 'marketing' });

test('preferV2: only an APPROVED, known _v2 replaces the pick', () => {
  const m = (entries) => new Map(entries.map(([n, s]) => [n, { status: s }]));
  assert.equal(preferV2('cl_pendiente_pago', m([['cl_pendiente_pago_v2', 'APPROVED']])), 'cl_pendiente_pago_v2');
  assert.equal(preferV2('cl_pendiente_pago', m([['cl_pendiente_pago_v2', 'PENDING']])), 'cl_pendiente_pago');
  assert.equal(preferV2('cl_pendiente_pago', m([['cl_pendiente_pago_v2', 'REJECTED']])), 'cl_pendiente_pago');
  assert.equal(preferV2('cl_pendiente_pago', m([])), 'cl_pendiente_pago');
  assert.equal(preferV2('cl_borrador', m([['cl_borrador_v2', 'APPROVED']])), 'cl_borrador');   // not in WA_TEMPLATES
  assert.equal(preferV2('cl_visitas_v2', m([['cl_visitas_v2_v2', 'APPROVED']])), 'cl_visitas_v2');
  assert.equal(preferV2(null, m([])), null);
});

test('v2 approved → sends X_v2 with its own variables (pay_url button)', async () => {
  relayList = [rel('cl_pendiente_pago', 'APPROVED'), rel('cl_pendiente_pago_v2', 'APPROVED')];
  const db = fakeDb({ wa: { tpl1: 'cl_pendiente_pago' } });
  assert.equal(await run(db), 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].template, 'cl_pendiente_pago_v2');
  assert.deepEqual(sent[0].variables, {
    body: ['Ana', 'Casa en Luque', 'US$5,80', '90'],
    buttons: [{ index: 0, text: 'abc-123&utm_source=whatsapp&utm_medium=whatsapp&utm_campaign=cl_pendiente_pago_v2' }],
  });
  assert.equal(db.log[0].template_key, 'cl_pendiente_pago_v2');
});

test('v2 still pending → keeps sending X', async () => {
  relayList = [rel('cl_pendiente_pago', 'APPROVED'), rel('cl_pendiente_pago_v2', 'PENDING')];
  const db = fakeDb({ wa: { tpl1: 'cl_pendiente_pago' } });
  assert.equal(await run(db), 'sent');
  assert.equal(sent[0].template, 'cl_pendiente_pago');
  assert.deepEqual(sent[0].variables, { body: ['Ana', 'Casa en Luque', 'US$5,80', '90'] });
});

test('v2 approved but this email has no value for its button → X as before', async () => {
  relayList = [rel('cl_pendiente_pago_v2', 'APPROVED')];
  const db = fakeDb({ wa: { tpl1: 'cl_pendiente_pago' } });
  const { pay_url, ...noPay } = vars;   // eslint-disable-line no-unused-vars
  assert.equal(await run(db, noPay), 'sent');
  assert.equal(sent[0].template, 'cl_pendiente_pago');
});

test('a v2 approved in another language does not count', async () => {
  relayList = [rel('cl_pendiente_pago_v2', 'APPROVED', 'en_US')];
  const db = fakeDb({ wa: { tpl1: 'cl_pendiente_pago' } });
  assert.equal(await run(db), 'sent');
  assert.equal(sent[0].template, 'cl_pendiente_pago');
});
