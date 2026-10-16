import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maybeSendQuotaAlert, alertRecipients, alertKey, localDate } from '../lib/scanAlert.js';

// A tiny fake email_log with the unique dedupe_key constraint.
function fakeDb(scanning = 3) {
  const log = [];
  return {
    log,
    insert: async (t, rows) => {
      if (log.some((l) => l.dedupe_key === rows[0].dedupe_key)) { const e = new Error('duplicate key'); e.code = '23505'; throw e; }
      const r = { id: String(log.length + 1), ...rows[0] }; log.push(r); return [r];
    },
    update: async (t, f, patch) => { const id = f.split('eq.')[1]; Object.assign(log.find((l) => l.id === id), patch); },
    remove: async (t, f) => { const id = f.split('eq.')[1]; log.splice(log.findIndex((l) => l.id === id), 1); },
    select: async () => Array.from({ length: scanning }, (_, i) => ({ id: i })),
  };
}

test('recipients: SCAN_ALERT_EMAIL, else ADMIN_EMAIL, else omar@', () => {
  assert.deepEqual(alertRecipients({ SCAN_ALERT_EMAIL: 'A@x.com, b@y.com' }), ['a@x.com', 'b@y.com']);
  assert.deepEqual(alertRecipients({ ADMIN_EMAIL: 'boss@x.com' }), ['boss@x.com']);
  assert.deepEqual(alertRecipients({}), ['omar@airosofts.com']);
});

test('one key per country per LOCAL day', () => {
  // 02:00 UTC on Oct 17 is still Oct 16 in Asunción (UTC-3)
  assert.equal(localDate('py', new Date('2026-10-17T02:00:00Z')), '2026-10-16');
  assert.equal(alertKey('py', new Date('2026-10-17T02:00:00Z')), 'scan-quota:py:2026-10-16');
  assert.notEqual(alertKey('bo', new Date('2026-10-16T15:00:00Z')), alertKey('py', new Date('2026-10-16T15:00:00Z')));
});

test('sends once a day, then already_sent; next day sends again', async () => {
  const db = fakeDb(4);
  const sent = [];
  const send = async (m) => { sent.push(m); return { ok: true, id: 're_1', subject: 's' }; };
  const base = { db, send, countryCode: 'py', countryName: 'Paraguay', used: 5000, quota: 5000, env: {} };
  const d1 = new Date('2026-10-16T15:00:00Z');
  assert.equal(await maybeSendQuotaAlert({ ...base, now: d1 }), 'sent');
  assert.equal(await maybeSendQuotaAlert({ ...base, now: d1 }), 'already_sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].queued, 4);
  assert.equal(db.log[0].status, 'sent');
  assert.equal(await maybeSendQuotaAlert({ ...base, now: new Date('2026-10-17T15:00:00Z') }), 'sent');
  assert.equal(sent.length, 2);
});

test('a failed send frees the key so the next attempt retries', async () => {
  const db = fakeDb();
  let fail = true;
  const send = async () => (fail ? { ok: false } : { ok: true });
  const base = { db, send, countryCode: 'py', used: 5000, quota: 5000, env: {}, now: new Date('2026-10-16T15:00:00Z') };
  assert.equal(await maybeSendQuotaAlert(base), 'failed');
  assert.equal(db.log.length, 0);
  fail = false;
  assert.equal(await maybeSendQuotaAlert(base), 'sent');
});
