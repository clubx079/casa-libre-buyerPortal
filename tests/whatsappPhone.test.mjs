import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toE164 } from '../lib/whatsappPhone.js';

test('local numbers get the country prefix (leading 0 dropped)', () => {
  assert.equal(toE164('0981 123 456', '595'), '+595981123456');
  assert.equal(toE164('981123456', '595'), '+595981123456');
  assert.equal(toE164('(0981) 123-456', '595'), '+595981123456');
  assert.equal(toE164('7 123 4567', '591'), '+59171234567');
});

test('international numbers keep their own country', () => {
  assert.equal(toE164('+595 981 123-456', '595'), '+595981123456');
  assert.equal(toE164('00595981123456', '595'), '+595981123456');
  assert.equal(toE164('+591 71234567', '595'), '+59171234567');
  assert.equal(toE164('595981123456', '595'), '+595981123456');
});

test('junk is refused', () => {
  assert.equal(toE164('', '595'), null);
  assert.equal(toE164('abc', '595'), null);
  assert.equal(toE164('12', '595'), null);
  assert.equal(toE164('+1234567890123456', '595'), null);
});
