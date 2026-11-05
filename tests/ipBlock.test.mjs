import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeBlockedIps, clientIp } from '../lib/ipBlock.js';

test('the blocked IPs right now: not unblocked, not expired', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const ft = [{ blocked_ips: [
    { ip: '1.1.1.1', until: '2026-12-06T00:00:00Z' },
    { ip: '2.2.2.2', until: '2026-11-01T00:00:00Z' },                 // expired
    { ip: '3.3.3.3', until: '2026-12-06T00:00:00Z', unblocked: true }, // an admin unblocked it
    { ip: ' 4.4.4.4 ', until: '2026-12-06T00:00:00Z' },
  ], suspensions: [] }];
  assert.deepEqual([...activeBlockedIps(ft, now)], ['1.1.1.1', '4.4.4.4']);
  assert.equal(activeBlockedIps(null, now).size, 0);
  assert.equal(activeBlockedIps([{}], now).size, 0);
});

test('the visitor IP: Cloudflare header first, then the first forwarded one', () => {
  assert.equal(clientIp(new Headers({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' })), '1.2.3.4');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' })), '5.6.7.8');
  assert.equal(clientIp(new Headers({})), '');
});
