import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rentPriceOk, RENT_FLOOR_PYG, RENT_FLOOR_USD } from '../lib/rentFloor.js';

test('Paraguay keeps its guaraní rent floor', () => {
  assert.equal(rentPriceOk({ usd: 50, pyg: 350000 }, 'PYG'), true);
  assert.equal(rentPriceOk({ usd: 40, pyg: 250000 }, 'PYG'), false);
  assert.equal(rentPriceOk({ usd: null, pyg: null }, 'PYG'), false);
  assert.equal(RENT_FLOOR_PYG, 300000);
});

test('Bolivia / Uruguay / Venezuela use the US$ floor, not 300,000 local units', () => {
  // 4,200 Bs ≈ US$ 350 — a normal rent that the old rule hid (4,200 < 300,000)
  assert.equal(rentPriceOk({ usd: 350, pyg: 4200 }, 'BOB'), true);
  assert.equal(rentPriceOk({ usd: 560, pyg: 22800 }, 'UYU'), true);
  assert.equal(rentPriceOk({ usd: 900, pyg: 900 }, 'USD'), true);
  assert.equal(rentPriceOk({ usd: 20, pyg: 240 }, 'BOB'), false);   // under US$ 40
  assert.equal(rentPriceOk({ usd: null, pyg: null }, 'UYU'), false);
  assert.equal(RENT_FLOOR_USD, 40);
});
