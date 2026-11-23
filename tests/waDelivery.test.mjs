import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryState } from '../lib/waDelivery.js';

const otp = (status, created, code) => ({ direction: 'outbound', kind: 'otp', status, error: code ? { code } : null, timestamps: { created } });
const since = Date.parse('2026-11-23T10:00:00Z');

test('a code Meta refused as undeliverable = no WhatsApp on that number', () => {
  assert.equal(deliveryState([otp('failed', '2026-11-23T10:00:02Z', 131026)], since), 'no_whatsapp');
  assert.equal(deliveryState([otp('failed', '2026-11-23T10:00:02Z', 131049)], since), 'failed');
  assert.equal(deliveryState([otp('read', '2026-11-23T10:00:02Z')], since), 'delivered');
  assert.equal(deliveryState([otp('sent', '2026-11-23T10:00:02Z')], since), 'pending');
});

test('only codes sent since the click count, newest first; other messages are ignored', () => {
  assert.equal(deliveryState([otp('failed', '2026-11-22T10:00:00Z', 131026)], since), 'pending');
  assert.equal(deliveryState([otp('delivered', '2026-11-23T10:01:00Z'), otp('failed', '2026-11-23T10:00:01Z', 131026)], since), 'delivered');
  assert.equal(deliveryState([{ direction: 'inbound', kind: 'text', status: 'received', timestamps: { created: '2026-11-23T10:00:05Z' } }], since), 'pending');
  assert.equal(deliveryState(null, since), 'pending');
});
