import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg } from '../lib/qr.js';

// Decoding was checked with OpenCV's QRCodeDetector for v1, v3 and v6 codes; here the
// structure is checked so a change that breaks it fails fast.
test('qr: version by length, finder patterns, timing, dark module', () => {
  const a = qrMatrix('hi');
  assert.equal(a.version, 1);
  assert.equal(a.size, 21);
  const link = qrMatrix('https://casa-libre.com.py/l/0abc12xy?c=qr');
  assert.equal(link.version, 3);
  const m = link.modules;
  const n = link.size;
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    for (let i = 0; i < 7; i++) {
      assert.equal(m[r0][c0 + i], true);                 // finder outer ring
      assert.equal(m[r0 + 6][c0 + i], true);
      assert.equal(m[r0 + i][c0], true);
    }
    assert.equal(m[r0 + 3][c0 + 3], true);               // finder centre
    assert.equal(m[r0 + 1][c0 + 1], false);
  }
  for (let i = 8; i < n - 8; i++) assert.equal(m[6][i], i % 2 === 0);   // timing
  assert.equal(m[n - 8][8], true);                        // dark module
  assert.throws(() => qrMatrix('x'.repeat(200)));
  assert.deepEqual(qrMatrix('same').modules, qrMatrix('same').modules);
  assert.match(qrSvg('hi'), /^<svg/);
});
