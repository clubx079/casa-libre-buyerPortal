import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ptAlias, foldText, parseSearch } from '../lib/searchAliases.js';

// lib/marketplace.js is server-only: its accentRegex is copied here (as in
// accentFreeSearch.test.mjs) with the alias step, and checked against the source.
const src = readFileSync(new URL('../lib/marketplace.js', import.meta.url), 'utf8');
const ACCENT_CLASS = { a: '[aáàâä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôö]', u: '[uúùûü]', n: '[nñ]' };
const accentRegex = (v) => [...ptAlias(v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]
  .map((ch) => ACCENT_CLASS[ch] || (/[a-z0-9 ]/.test(ch) ? ch : '.')).join('');
const re = (q) => new RegExp(accentRegex(q), 'i');

// What baseParts does with a query: the place text (loose match on neighborhood/city/
// address/property_type), the op filter and the property_type keywords (ilike).
function finds(q, { place = '', type = '', rent = false, op = 'all' } = {}) {
  const s = parseSearch(q);
  const o = op === 'all' && s.op ? s.op : op;
  if (o === 'alquiler' && !rent) return false;
  if (o === 'venta' && rent) return false;
  if (s.typeKw.length && !s.typeKw.some((k) => type.toLowerCase().includes(k))) return false;
  if (s.text && ![place, type].some((col) => re(s.text).test(col))) return false;
  return true;
}

test('marketplace search runs the aliases before accentRegex and parses the query', () => {
  assert.match(src, /import \{ ptAlias, parseSearch \} from '\.\/searchAliases'/);
  assert.match(src, /const t = ptAlias\(v\)/);
  assert.match(src, /const qs = !place && has\(p\.q\) \? parseSearch\(p\.q\) : null;/);   // a picked place (lib/placeFilter.js) replaces the text
  assert.match(src, /if \(op === 'all' && qs\?\.op\) op = qs\.op;/);
});

test('Portuguese spellings and misspellings find the places', () => {
  for (const [typed, stored] of [
    ['Assunção', 'Asunción'], ['Assuncao', 'Asunción'], ['Assunsão', 'Asunción'], ['Asunsion', 'Asunción'], ['ASSUNÇÃO', 'Asunción'],
    ['Assun', 'Asunción'], ['assunc', 'Asunción'], ['Asunção', 'Asunción'],
    ['Cidade do Leste', 'Ciudad del Este'], ['Ciudad del Leste', 'Ciudad del Este'], ['CDE', 'Ciudad del Este'], ['Ciudad del Este', 'Ciudad del Este'],
    ['Encarnação', 'Encarnación'], ['Encarnacao', 'Encarnación'], ['Encarnación', 'Encarnación'],
    ['São Lourenço', 'San Lorenzo'], ['Hernandárias', 'Hernandarias'], ['hernandarias', 'Hernandarias'],
    ['Salto do Guaíra', 'Salto del Guairá'], ['Salto del Guaira', 'Salto del Guairá'],
    ['Pedro Juan', 'Pedro Juan Caballero'], ['PJC', 'Pedro Juan Caballero'], ['Presidente Franco', 'Presidente Franco'],
    ['Lambaré', 'Lambaré'], ['lambare', 'Lambaré'], ['Luque', 'Luque'],
    ['Fernando de la Mora', 'Fernando de la Mora'], ['Fernando da Mora', 'Fernando de la Mora'],
    ['Villa Morra', 'Villa Morra'], ['Vila Morra', 'Villa Morra'], ['Carmelitas', 'Carmelitas'],
    ['Mariano Roque Alonso', 'Mariano Roque Alonso'], ['San Bernardino', 'San Bernardino'], ['São Bernardino', 'San Bernardino'],
    ['Areguá', 'Areguá'], ['aregua', 'Areguá'], ['Capiatá', 'Capiatá'], ['capiata', 'Capiatá'], ['Ñemby', 'Ñemby'], ['Nemby', 'Ñemby'],
    ['Concepção', 'Concepción'], ['Gran Asunción', 'Gran Asunción'],
  ]) {
    assert.ok(finds(typed, { place: stored }), `${typed} → ${stored}`);
  }
});

test('Portuguese property words become the property_type filter', () => {
  for (const [typed, type] of [
    ['apartamento', 'Departamento'], ['apto', 'Departamento'], ['apartamentos', 'Departamento'],
    ['kitnet', 'Monoambiente'], ['quitinete', 'Monoambiente'],
    ['sobrado', 'Dúplex'], ['chácara', 'Casa quinta'], ['sítio', 'Quinta'],
    ['galpão', 'Depósito'], ['galpão', 'Galpón'], ['barracão', 'Depósito'],
    ['sala comercial', 'Oficina'], ['loja', 'Local comercial'], ['ponto comercial', 'Local comercial'],
    ['condomínio fechado', 'Barrio cerrado'], ['condomínio fechado', 'Condominio'],
    ['casa térrea', 'Casa'], ['cobertura', 'Penthouse'],
    // words Spanish shares only act as a filter once the query is Portuguese
    ['ap venda', 'Departamento'], ['studio venda', 'Monoambiente'], ['terreno venda', 'Terreno'], ['lote venda', 'Lote'],
    ['casa venda', 'Casa'],
  ]) {
    assert.ok(finds(typed, { type, place: 'Asunción' }), `${typed} → ${type}`);
  }
  assert.ok(!finds('apartamento', { type: 'Casa', place: 'Asunción' }), 'apartamento does not find houses');
  assert.ok(!finds('cobertura', { type: 'Departamento', place: 'Asunción' }));
});

test('operation words set the operation instead of being searched as text', () => {
  const s = parseSearch('apartamento aluguel assunção');
  assert.deepEqual({ text: s.text, op: s.op }, { text: 'asuncion', op: 'alquiler' });
  assert.ok(s.typeKw.includes('departamento'));
  assert.ok(finds('apartamento aluguel assunção', { place: 'Asunción', type: 'Departamento', rent: true }));
  assert.ok(!finds('apartamento aluguel assunção', { place: 'Asunción', type: 'Departamento', rent: false }));
  assert.equal(parseSearch('casa para alugar em Luque').op, 'alquiler');
  assert.equal(parseSearch('casa para alugar em Luque').text, 'luque');
  assert.equal(parseSearch('alugar').op, 'alquiler');
  assert.equal(parseSearch('casa à venda Encarnação').op, 'venta');
  assert.equal(parseSearch('casa à venda Encarnação').text, 'encarnacion');
  assert.equal(parseSearch('venda terreno Hernandárias').op, 'venta');
  assert.equal(parseSearch('venda terreno Hernandárias').text, 'hernandarias');
  assert.equal(parseSearch('comprar apartamento Assunção').op, 'venta');
  // a filter the visitor picked wins over a word in the box
  assert.ok(finds('apartamento aluguel assunção', { place: 'Asunción', type: 'Departamento', rent: false, op: 'venta' }));
});

test('feature words are dropped (the search does not read descriptions)', () => {
  assert.equal(parseSearch('apartamento 2 quartos com garagem em Assunção').text, 'asuncion');
  assert.equal(parseSearch('casa com piscina mobiliada Luque').text, 'luque');
  assert.equal(parseSearch('apartamento 3 dormitórios 2 banheiros vaga Vila Morra').text, 'villa morra');
  assert.equal(parseSearch('kitnet mobiliado').text, '');
});

test('Spanish searches are untouched', () => {
  for (const q of ['asuncion', 'Asunción', 'Encarnacion', 'Lambare', 'nemby', 'Luque', 'san lorenzo', 'Villa Morra', 'Sajonia',
    'Ciudad del Este', 'hernandarias', 'Encarnación', 'casa', 'departamento', 'terreno en venta', 'casa en alquiler Luque',
    'casa con piscina', 'Fernando de la Mora', 'Salto del Guairá', 'duplex', 'local comercial', 'oficina', 'Carmelitas',
    'monoambiente', 'quinta', 'Gran Asunción']) {
    const s = parseSearch(q);
    assert.equal(s.pt, false, q);
    assert.equal(s.text, q, q);
    assert.equal(s.op, null, q);
    assert.deepEqual(s.typeKw, [], q);
  }
  for (const q of ['asuncion', 'Asunción', 'Encarnacion', 'Lambare', 'nemby', 'Luque', 'san lorenzo', 'Villa Morra', 'Sajonia', 'Villa Elisa']) {
    assert.equal(ptAlias(q), foldText(q), q);
  }
  assert.equal(ptAlias('Saotome'), 'saotome');          // "sao" only as a word
  assert.ok(!re('Assunção').test('Cañada del Carmen casi Calle Florida, Encarnación'));
  assert.ok(!re('asuncion').test('Cañada del Carmen casi Calle Florida, Encarnación'), 'no loose matches');
  assert.ok(!re('Luque').test('Limpio'));
  assert.equal(accentRegex('a,b(c)'), '[aáàâä].b.c.', 'punctuation still cannot break the query');
});
