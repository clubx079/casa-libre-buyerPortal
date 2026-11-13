import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// lib/marketplace.js is server-only; the rule is copied here and checked against the source.
const src = readFileSync(new URL('../lib/marketplace.js', import.meta.url), 'utf8');
const ACCENT_CLASS = { a: '[aáàâä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôö]', u: '[uúùûü]', n: '[nñ]' };
const accentRegex = (v) => [...String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
  .map((ch) => ACCENT_CLASS[ch] || (/[a-z0-9 ]/.test(ch) ? ch : '.')).join('');
const re = (q) => new RegExp(accentRegex(q), 'i');

test('search ignores accents but nothing else (phones type "asuncion")', () => {
  assert.ok(src.includes("const ACCENT_CLASS = { a: '[aáàâä]'"), 'rule in lib/marketplace.js changed');
  for (const [typed, stored] of [['asuncion', 'Asunción'], ['Asunción', 'Asunción'], ['Encarnacion', 'Encarnación'], ['Lambare', 'Lambaré'], ['nemby', 'Ñemby'], ['Capiata', 'Capiatá'], ['luque', 'Luque'], ['san lorenzo', 'San Lorenzo']]) {
    assert.ok(re(typed).test(stored), `${typed} → ${stored}`);
  }
  assert.ok(!re('asuncion').test('Cañada del Carmen casi Calle Florida, Encarnación'), 'no loose matches');
  assert.ok(!re('Luque').test('Limpio'));
  assert.equal(accentRegex('a,b(c)'), '[aáàâä].b.c.', 'punctuation cannot break the query');
});
