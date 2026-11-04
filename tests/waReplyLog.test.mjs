import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replyRow, keywordOf, replyLabel } from '../lib/waReplyLog.js';

test('every tap and opt-out becomes one history row (never counted as a message we sent)', () => {
  assert.equal(keywordOf('si_sent'), 'si');
  assert.equal(keywordOf('baja_already'), 'baja');
  assert.equal(keywordOf('plan_sent'), 'plan');
  assert.equal(keywordOf(null), null);
  assert.equal(keywordOf('other'), null);
  const r = replyRow({ phone: '+595981000000', email: 'a@x.com', keyword: 'cartera', text: 'CARTERA', how: 'button', messageId: 'msg_1', now: new Date('2026-11-04T12:00:00Z') });
  assert.equal(r.automation_id, 'wa_reply');
  assert.equal(r.channel, 'event');
  assert.equal(r.subject, 'Tapped CARTERA (has a portfolio)');
  assert.equal(r.dedupe_key, 'wa_reply:msg_1');
  assert.deepEqual(JSON.parse(r.error), { keyword: 'cartera', text: 'CARTERA', how: 'button', message_id: 'msg_1' });
  assert.equal(replyLabel('optout', 'No recibir más'), 'Opted out: replied “No recibir más”');
  assert.equal(replyLabel('baja'), 'Opted out: replied BAJA');
  assert.equal(replyRow({ phone: '+595981000000', keyword: 'si', now: new Date('2026-11-04T12:00:30Z') }).dedupe_key, 'wa_reply:+595981000000:si:2026-11-04T12:00');
});
