import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sendOnce } from '../lib/automations/sendOnce.js';
import { _resetWhatsappCache, sentWhatsAppBefore } from '../lib/automations/whatsappSend.js';

// In-memory DB: the automation row (channel whatsapp_first), a user with consent, and an
// email_log that answers the "already WhatsApp'd?" lookup.
function fakeDb({ repeat = null } = {}) {
  const log = [];
  const wa = { tpl1: 'cl_visitas', ...(repeat ? { __repeat_days: repeat } : {}) };
  return {
    log,
    async select(table, q) {
      if (table === 'automations') return [{ id: 'listing_views_milestone', channel: 'whatsapp_first', wa_templates: wa }];
      if (table === 'users') return q.includes(encodeURIComponent('ana@example.com')) ? [{ id: 'u1', email: 'ana@example.com', phone: '0981 123 456', whatsapp_opt_in_at: '2026-10-19T00:00:00Z' }] : [];
      if (table === 'email_log') {
        const get = (k) => decodeURIComponent((q.match(new RegExp(`${k}=(?:eq|gte)\\.([^&]+)`)) || [])[1] || '');
        const since = get('created_at');
        return log.filter((r) => r.channel === 'whatsapp' && r.automation_id === get('automation_id') && r.to_email === get('to_email')
          && ['sending', 'sent', 'delivered', 'read'].includes(r.status) && (!since || r.created_at >= since));
      }
      return [];
    },
    async insert(table, rows) {
      const r = rows[0];
      if (log.some((x) => x.dedupe_key === r.dedupe_key)) { const e = new Error('dup'); e.code = '23505'; throw e; }
      const row = { id: `l${log.length + 1}`, created_at: new Date().toISOString(), channel: 'email', ...r };
      log.push(row);
      return [row];
    },
    async update(table, q, patch) { const id = decodeURIComponent(q.split('eq.')[1]); const r = log.find((x) => x.id === id); if (r) Object.assign(r, patch); },
    async remove(table, q) { const id = decodeURIComponent(q.split('eq.')[1]); const i = log.findIndex((x) => x.id === id); if (i >= 0) log.splice(i, 1); },
  };
}

let relay = [];
let relayOk = true;
beforeEach(() => {
  _resetWhatsappCache();
  relay = []; relayOk = true;
  process.env.RELAY_API_KEY = 'rk_test_x';
  delete process.env.WHATSAPP_TEST_TO;
  globalThis.fetch = async (url, init) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    relay.push(JSON.parse(init.body));
    return relayOk ? new Response(JSON.stringify({ id: 'msg_1', status: 'queued' }), { status: 202 }) : new Response('{}', { status: 500 });
  };
});

const tpl = { id: 'tpl1', key: 'listing-views', subject: 'Tu propiedad ya tiene {{views}} visitas', heading: '', body: 'Hola {{name}}', button_label: '', button_url: '' };
const vars = { name: 'Ana', property_title: 'Casa · Luque', views: '50', property_url: 'https://casa-libre.com.py/propiedad/abc-123' };
const run = (db, key, emails) => sendOnce({ db, automationId: 'listing_views_milestone', dedupeKey: key, tpl, vars, to: 'ana@example.com', frame: {}, deliver: async (m) => { emails.push(m); return { ok: true, id: 'r' }; } });

test('first message on WhatsApp, the follow-ups by email', async () => {
  const db = fakeDb();
  const emails = [];
  assert.equal(await run(db, 'views:p1:50', emails), 'sent');
  assert.equal(relay.length, 1);                 // 1st: WhatsApp
  assert.equal(emails.length, 0);
  assert.equal(await run(db, 'views:p1:100', emails), 'sent');
  assert.equal(await run(db, 'views:p1:500', emails), 'sent');
  assert.equal(relay.length, 1);                 // never a 2nd WhatsApp
  assert.equal(emails.length, 2);                // follow-ups by email
  assert.deepEqual(db.log.map((r) => r.channel), ['whatsapp', 'email', 'email']);
});

test('WhatsApp again once the last one is older than the repeat days (monthly WhatsApp)', async () => {
  const db = fakeDb({ repeat: 30 });
  const emails = [];
  await run(db, 'views:p1:50', emails);
  db.log[0].created_at = new Date(Date.now() - 31 * 86400000).toISOString();   // a month ago
  await run(db, 'views:p1:100', emails);
  assert.equal(relay.length, 2);                 // WhatsApp again
  await run(db, 'views:p1:500', emails);
  assert.equal(relay.length, 2);                 // then email until next month
  assert.equal(emails.length, 1);
});

test("can't reach them on WhatsApp → the email instead (and the next one tries WhatsApp again)", async () => {
  const db = fakeDb();
  const emails = [];
  relayOk = false;
  assert.equal(await run(db, 'views:p1:50', emails), 'sent');
  assert.equal(emails.length, 1);                // failed WhatsApp → email
  relayOk = true;
  await run(db, 'views:p1:100', emails);
  assert.equal(relay.length, 2);                 // no WhatsApp went out before, so it's tried again
});

test('the lookup: any WhatsApp ever, or within N days; a broken lookup means "yes" (email)', async () => {
  const db = fakeDb();
  db.log.push({ id: 'x', channel: 'whatsapp', automation_id: 'a1', to_email: 'b@x.com', status: 'read', created_at: new Date(Date.now() - 40 * 86400000).toISOString() });
  assert.equal(await sentWhatsAppBefore(db, 'a1', 'B@x.com'), true);
  assert.equal(await sentWhatsAppBefore(db, 'a1', 'b@x.com', 30), false);
  assert.equal(await sentWhatsAppBefore(db, 'a2', 'b@x.com'), false);
  assert.equal(await sentWhatsAppBefore({ select: async () => { throw new Error('down'); } }, 'a1', 'b@x.com'), true);
});
