import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendAccountDeleted, ACCOUNT_DELETED_ID } from '../lib/automations/accountDeleted.js';

// In-memory db: automations / email_templates rows, and email_log writes.
function fakeDb({ automation = null, template = null } = {}) {
  const log = [];
  return {
    log,
    select: async (table) => (table === 'automations' ? (automation ? [automation] : []) : table === 'email_templates' ? (template ? [template] : []) : []),
    insert: async (table, rows) => { const r = { id: `l${log.length + 1}`, ...rows[0] }; if (log.some((x) => x.dedupe_key === r.dedupe_key)) { const e = new Error('dup'); e.code = '23505'; throw e; } log.push(r); return [r]; },
    update: async (table, filter, patch) => { const key = decodeURIComponent((filter.match(/dedupe_key=eq\.(.+)$/) || [])[1] || ''); const id = (filter.match(/^id=eq\.(.+)$/) || [])[1]; for (const r of log) if (r.dedupe_key === key || r.id === id) Object.assign(r, patch); },
    remove: async () => {},
  };
}

test('a goodbye email with the feedback button, then the address leaves our log', async () => {
  const db = fakeDb();
  const sent = [];
  const deliver = async (m) => { sent.push(m); return { ok: true, id: 'r1' }; };
  const r = await sendAccountDeleted({ db, uid: 'u1', email: 'ana@x.com', name: 'Ana Paz', deliver, siteUrl: 'https://casa-libre.com.py' });
  assert.equal(r, 'sent');
  assert.equal(sent[0].to, 'ana@x.com');
  assert.match(sent[0].subject, /Lamentamos que te vayas, Ana/);
  assert.match(sent[0].html, /https:\/\/casa-libre\.com\.py\/feedback\?origen=cuenta-eliminada/);
  assert.match(sent[0].html, /Contanos por qué/);
  assert.equal(db.log[0].automation_id, ACCOUNT_DELETED_ID);
  assert.equal(db.log[0].status, 'sent');
  assert.equal(db.log[0].to_email, 'deleted-u1@deleted.invalid');   // anonymized after sending
});

test('never twice, can be switched off, and uses the admin-edited template', async () => {
  const deliver = async () => ({ ok: true, id: 'r' });
  const db = fakeDb();
  assert.equal(await sendAccountDeleted({ db, uid: 'u2', email: 'b@x.com', deliver }), 'sent');
  assert.equal(await sendAccountDeleted({ db, uid: 'u2', email: 'b@x.com', deliver }), 'duplicate');
  assert.equal(await sendAccountDeleted({ db: fakeDb({ automation: { id: ACCOUNT_DELETED_ID, enabled: false } }), uid: 'u3', email: 'c@x.com', deliver }), 'off');
  const sent = [];
  const custom = { id: 't1', key: 'account-deleted', subject: 'Chau {{name}}', heading: '', body: 'Gracias', button_label: null, button_url: null, is_active: true };
  await sendAccountDeleted({ db: fakeDb({ template: custom }), uid: 'u4', email: 'd@x.com', name: 'Luis', deliver: async (m) => { sent.push(m); return { ok: true }; } });
  assert.equal(sent[0].subject, 'Chau Luis');
  assert.equal(await sendAccountDeleted({ db: fakeDb(), uid: 'u5', email: '', deliver }), 'no_email');
});
