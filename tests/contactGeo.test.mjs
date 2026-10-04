import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactGeo } from '../lib/contactGeo.js';

const H = (o) => new Headers(o);

test('IP + country (+ city when Cloudflare sends it) from the request', () => {
  assert.deepEqual(contactGeo(H({ 'cf-connecting-ip': '181.120.5.9', 'cf-ipcountry': 'py', 'cf-ipcity': 'Asunci%C3%B3n' })),
    { buyer_ip: '181.120.5.9', buyer_country: 'PY', buyer_city: 'Asunción' });
});

test('falls back to x-forwarded-for; unknown countries stay empty', () => {
  assert.deepEqual(contactGeo(H({ 'x-forwarded-for': '10.0.0.1, 172.16.0.1', 'cf-ipcountry': 'XX' })),
    { buyer_ip: '10.0.0.1', buyer_country: null, buyer_city: null });
  assert.deepEqual(contactGeo(H({})), { buyer_ip: null, buyer_country: null, buyer_city: null });
});

test('ignores junk', () => {
  assert.deepEqual(contactGeo(H({ 'cf-connecting-ip': 'x'.repeat(80), 'cf-ipcountry': 'T1', 'cf-ipcity': '%E0%A4%A' })),
    { buyer_ip: null, buyer_country: null, buyer_city: null });
});
