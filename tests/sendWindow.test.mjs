import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inSendWindow, localHour } from '../lib/sendWindow.js';

test('local hour per country', () => {
  const t = new Date('2026-10-26T12:00:00Z');
  assert.equal(localHour(t, 'py'), 9);    // Paraguay UTC−3
  assert.equal(localHour(t, 'bo'), 8);    // Bolivia UTC−4
  assert.equal(localHour(t, 'sv'), 6);    // El Salvador UTC−6
});

test('messages only 09:00–19:00 local', () => {
  assert.equal(inSendWindow(new Date('2026-10-26T12:00:00Z'), 'py'), true);    // 09:00 PY
  assert.equal(inSendWindow(new Date('2026-10-26T11:59:00Z'), 'py'), false);   // 08:59 PY
  assert.equal(inSendWindow(new Date('2026-10-26T21:59:00Z'), 'py'), true);    // 18:59 PY
  assert.equal(inSendWindow(new Date('2026-10-26T22:00:00Z'), 'py'), false);   // 19:00 PY
  assert.equal(inSendWindow(new Date('2026-10-26T05:00:00Z'), 'py'), false);   // 02:00 PY
  assert.equal(inSendWindow(new Date('2026-10-26T12:00:00Z'), 'bo'), false);   // 08:00 BO
});
