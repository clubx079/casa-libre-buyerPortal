import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, groupPrice, priceShown, nextPriceInput } from '../lib/priceInput.js';

test('dots and commas are thousands marks, never decimals', () => {
  assert.equal(parsePrice('290.000'), 290000);          // the bug: this was read as 290
  assert.equal(parsePrice('290,000'), 290000);
  assert.equal(parsePrice('290000'), 290000);
  assert.equal(parsePrice('1.500.000.000'), 1500000000); // a price in guaraníes
  assert.equal(parsePrice('4,500,000'), 4500000);
  assert.equal(parsePrice('US$ 145 000'), 145000);
});

test('a cents part at the end is dropped, never multiplied in', () => {
  assert.equal(parsePrice('145000.50'), 145000);
  assert.equal(parsePrice('145000,00'), 145000);
  assert.equal(parsePrice('145.000,00'), 145000);
  assert.equal(parsePrice('2,500.5'), 2500);
});

test('empty or no digits → not a price', () => {
  assert.ok(Number.isNaN(parsePrice('')));
  assert.ok(Number.isNaN(parsePrice('abc')));
  assert.ok(Number.isNaN(parsePrice(null)));
});

test('shown with commas', () => {
  assert.equal(groupPrice(290000), '290,000');
  assert.equal(groupPrice(4500000), '4,500,000');
  assert.equal(groupPrice(950), '950');
  assert.equal(priceShown('145.000'), '145,000');        // an older draft
  assert.equal(priceShown(''), '');
});

test('typing: commas appear by themselves; a typed dot just disappears', () => {
  let v = '';
  for (const ch of '290.000') v = nextPriceInput(v, v + ch);
  assert.equal(v, '290,000');
  v = '';
  for (const ch of '1500000') v = nextPriceInput(v, v + ch);
  assert.equal(v, '1,500,000');
  assert.equal(nextPriceInput('290,000', '290,00'), '29,000');   // backspace
  assert.equal(nextPriceInput('5', ''), '');
});

test('paste: read whole, so cents stay out', () => {
  assert.equal(nextPriceInput('', '145000.00'), '145,000');
  assert.equal(nextPriceInput('', '290.000'), '290,000');
});
