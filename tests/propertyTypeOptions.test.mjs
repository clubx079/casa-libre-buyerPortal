import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROPERTY_TYPES, normalizeTypeKey, typeOptions, typeLabel, dbType, typeKeywords, isLandType, areaRange } from '../lib/propertyTypeOptions.js';

test('one list of 11 types, the same for the filter and the "List a property" form', () => {
  assert.deepEqual(PROPERTY_TYPES.map((t) => t.key), ['casa', 'depto', 'duplex', 'terreno', 'comercial', 'oficina', 'deposito', 'edificio', 'condominio', 'campo', 'otro']);
  assert.deepEqual(typeOptions('en').map(([, l]) => l), ['House', 'Apartment', 'Duplex', 'Lot', 'Commercial', 'Office', 'Warehouse', 'Building', 'Condo', 'Rural land', 'Other']);
  assert.deepEqual(typeOptions('es').map(([, l]) => l), ['Casa', 'Departamento', 'Dúplex', 'Terreno', 'Local comercial', 'Oficina', 'Depósito', 'Edificio', 'Condominio', 'Campo', 'Otro']);
});

test("older forms, drafts and the app send 'departamento' — it is the apartment type", () => {
  assert.equal(normalizeTypeKey('departamento'), 'depto');
  assert.equal(normalizeTypeKey(' Casa '), 'casa');
  assert.equal(normalizeTypeKey(''), '');
  assert.equal(normalizeTypeKey('castle'), '');
  assert.equal(dbType('departamento'), 'Departamento');
  assert.equal(typeLabel('departamento', 'en'), 'Apartment');
});

test('stored property_type for each published type', () => {
  assert.equal(dbType('casa'), 'Casa');
  assert.equal(dbType('comercial'), 'Local comercial');
  assert.equal(dbType('campo'), 'Campo');
  assert.equal(dbType('nope'), null);
});

test('every type has match words for the marketplace filter (Lot, Rural land and Other filtered nothing before)', () => {
  for (const t of PROPERTY_TYPES) assert.ok(typeKeywords(t.key).length > 0, t.key);
  assert.ok(typeKeywords('terreno').includes('lote'));
  assert.ok(typeKeywords('campo').includes('estancia'));
  assert.deepEqual(typeKeywords('otro'), ['otro', 'other']);
  assert.deepEqual(typeKeywords('all'), []);
});

test('land types and size limits', () => {
  assert.equal(isLandType('terreno'), true);
  assert.equal(isLandType('campo'), true);
  assert.equal(isLandType('casa'), false);
  assert.equal(areaRange('terreno'), null, 'land: any size');
  assert.deepEqual(areaRange('casa'), [5, 2000]);
  assert.deepEqual(areaRange('edificio'), [5, 50000]);
  assert.deepEqual(areaRange('deposito'), [5, 50000]);
});
