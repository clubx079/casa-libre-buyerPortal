import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ptAlias, foldText } from '../lib/searchAliases.js';

// lib/marketplace.js is server-only: its accentRegex is copied here (as in
// accentFreeSearch.test.mjs) with the alias step, and checked against the source.
const src = readFileSync(new URL('../lib/marketplace.js', import.meta.url), 'utf8');
const ACCENT_CLASS = { a: '[aáàâä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôö]', u: '[uúùûü]', n: '[nñ]' };
const accentRegex = (v) => [...ptAlias(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
  .map((ch) => ACCENT_CLASS[ch] || (/[a-z0-9 ]/.test(ch) ? ch : '.')).join('');
const re = (q) => new RegExp(accentRegex(q), 'i');

test('marketplace search runs the Portuguese aliases before accentRegex', () => {
  assert.match(src, /import \{ ptAlias \} from '\.\/searchAliases'/);
  assert.match(src, /const t = ptAlias\(v\)/);
});

test('Portuguese spellings find the Spanish place names', () => {
  for (const [typed, stored] of [
    ['Assunção', 'Asunción'], ['assuncao', 'Asunción'], ['ASSUNÇÃO', 'Asunción'], ['Asunção', 'Asunción'],
    ['Encarnação', 'Encarnación'], ['encarnacao', 'Encarnación'],
    ['Cidade do Leste', 'Ciudad del Este'], ['São Lourenço', 'San Lorenzo'], ['Sao Bernardino', 'San Bernardino'],
    ['Concepção', 'Concepción'], ['Vila Morra', 'Villa Morra'], ['apartamento', 'Departamento'],
  ]) {
    assert.ok(re(typed).test(stored), `${typed} → ${stored}`);
  }
});

test('aliases change only whole words and leave Spanish searches alone', () => {
  for (const q of ['asuncion', 'Asunción', 'Encarnacion', 'Lambare', 'nemby', 'Luque', 'san lorenzo', 'Villa Morra', 'Sajonia']) {
    assert.equal(ptAlias(q), foldText(q), q);
  }
  assert.equal(ptAlias('Villa Elisa'), 'villa elisa');
  assert.equal(ptAlias('Saotome'), 'saotome');          // "sao" only as a word
  assert.ok(!re('Assunção').test('Cañada del Carmen casi Calle Florida, Encarnación'));
  assert.equal(accentRegex('a,b(c)'), '[aáàâä].b.c.', 'punctuation still cannot break the query');
});
