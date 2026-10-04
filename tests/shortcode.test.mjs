import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCode, buildCode, encodeUuidB62, contactShortLink } from '../lib/shortcode.js';

const PID = '73d2787c-d169-4a22-bd30-7e236a7e9752';

test('listing short code + contact token: /s/0017ls-AbC1234', () => {
  assert.deepEqual(parseCode('0017ls-AbC1234'), { propertyId: null, shortCode: '0017ls', token: 'AbC1234' });
  // the mobile app's tokens look like m3k9x2a1b0c8d
  assert.deepEqual(parseCode('z91iee-m3k9x2a1b0c8d'), { propertyId: null, shortCode: 'z91iee', token: 'm3k9x2a1b0c8d' });
});

test('self-encoding uuid + token still works', () => {
  const code = buildCode(PID, 'AbC1234');
  assert.equal(code, `${encodeUuidB62(PID)}-AbC1234`);
  assert.deepEqual(parseCode(code), { propertyId: PID, shortCode: null, token: 'AbC1234' });
});

test('bare listing short code: no token', () => {
  assert.deepEqual(parseCode('0017ls'), { propertyId: null, shortCode: '0017ls', token: null });
});

test('legacy token-only links and junk', () => {
  assert.deepEqual(parseCode('AbC1234XYZ'), { propertyId: null, shortCode: null, token: 'AbC1234XYZ' });
  assert.deepEqual(parseCode(''), { propertyId: null, shortCode: null, token: null });
});

test('the WhatsApp contact link carries the listing code AND the contact token', () => {
  assert.equal(contactShortLink('https://casa-libre.com.py', '0017ls', 'AbC1234'), 'https://casa-libre.com.py/s/0017ls-AbC1234');
  assert.equal(contactShortLink('https://casa-libre.com.py/', '0017ls', null), 'https://casa-libre.com.py/s/0017ls');
  assert.equal(contactShortLink('https://casa-libre.com.py', null, 'AbC1234'), null);
});
