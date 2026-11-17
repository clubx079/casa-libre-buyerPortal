import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreementRecord, withAgreement, agreed, AGREEMENT_VERSION, AGREEMENT_URL } from '../lib/listingAgreement.js';

test('agreement: version 2026-11-17, the Listing Agreement anchor', () => {
  assert.equal(AGREEMENT_VERSION, '2026-11-17');
  assert.equal(AGREEMENT_URL, '/terminos#acuerdo-de-publicacion');
});

test('agreement: first acceptance → accepted_at, version, ip, via, count 1', () => {
  const now = new Date('2026-11-17T10:00:00Z');
  const r = agreementRecord(null, { ip: '181.1.1.1', via: 'publish', now });
  assert.deepEqual(r, { accepted_at: now.toISOString(), version: '2026-11-17', ip: '181.1.1.1', via: 'publish', count: 1, first_accepted_at: now.toISOString() });
});

test('agreement: later acceptances keep the latest + count + the first date', () => {
  const t1 = new Date('2026-11-17T10:00:00Z'), t2 = new Date('2026-12-01T10:00:00Z'), t3 = new Date('2027-01-20T10:00:00Z');
  const a = agreementRecord(null, { ip: '1.1.1.1', via: 'publish', now: t1 });
  const b = agreementRecord(a, { ip: '2.2.2.2', via: 'edit', now: t2 });
  const c = agreementRecord(b, { ip: null, via: 'renew', now: t3 });
  assert.equal(c.count, 3);
  assert.equal(c.accepted_at, t3.toISOString());
  assert.equal(c.first_accepted_at, t1.toISOString());
  assert.equal(c.via, 'renew');
  assert.equal(c.ip, null);
  // an older record without a count still counts as one acceptance
  assert.equal(agreementRecord({ accepted_at: t1.toISOString() }, { now: t2 }).count, 2);
});

test('agreement: withAgreement keeps the rest of raw_data', () => {
  const raw = withAgreement({ signals: { ip: 'x' }, paid_listing: { until: 'u' } }, { via: 'renew', now: new Date('2026-11-17T00:00:00Z') });
  assert.deepEqual(raw.signals, { ip: 'x' });
  assert.deepEqual(raw.paid_listing, { until: 'u' });
  assert.equal(raw.listing_agreement.via, 'renew');
  assert.equal(withAgreement(null, {}).listing_agreement.count, 1);
});

test('agreement: the flag the clients send', () => {
  for (const v of [true, 1, '1', 'true', 'on']) assert.equal(agreed(v), true);
  for (const v of [false, 0, '', '0', 'false', undefined, null]) assert.equal(agreed(v), false);
});
