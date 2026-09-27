import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneRule } from '../lib/zoning/asuncionRules.js';
import { CATEGORIES, categoryLabel, zoningFilterPart, zoningFromRow, zoningEnabled } from '../lib/zoning/categories.js';

const fc = (code) => [zoneRule(code).maxFloors, zoneRule(code).category];

test('residential zones map to the ordinance floors (+1 nivel) and category', () => {
  assert.deepEqual(fc('AR1A'), [3, 'baja']);
  assert.deepEqual(fc('AR1B'), [4, 'baja']);
  assert.deepEqual(fc('AR2A'), [5, 'media']);
  assert.deepEqual(fc('AR2B'), [6, 'media']);
  assert.deepEqual(fc('AR2B MOD'), [6, 'media']);
  assert.deepEqual(fc('AR3A_1'), [6, 'media']);
  assert.deepEqual(fc('AR3B'), [8, 'alta']);
});

test('central/mixed zones are alta with no fixed floors; industrial/parks are otro', () => {
  for (const c of ['CENTRAL', 'EJE VILLA MORRA', 'FM1A', 'FM1B', 'FM2', 'FM3', 'EH', 'AT', 'ZUC']) {
    assert.equal(zoneRule(c).category, 'alta', c);
    assert.equal(zoneRule(c).maxFloors, null, c);
  }
  for (const c of ['AI1', 'AI2', 'AI3', 'AP', 'AUE', 'CEM', 'P', 'ZE']) assert.equal(zoneRule(c).category, 'otro', c);
});

test('unknown or messy codes: otro; codes are trimmed and upper-cased', () => {
  assert.equal(zoneRule('XYZ').category, 'otro');
  assert.equal(zoneRule(null).category, 'otro');
  assert.equal(zoneRule(' ar1a ').maxFloors, 3);
});

test('filter fragment only for known categories', () => {
  assert.equal(zoningFilterPart('baja'), 'zoning_category=eq.baja');
  assert.equal(zoningFilterPart('all'), null);
  assert.equal(zoningFilterPart('baja&admin_status=eq.x'), null);
  assert.equal(zoningFilterPart(undefined), null);
  assert.equal(CATEGORIES.map((c) => c.id).join(','), 'baja,media,alta,otro');
  assert.match(categoryLabel('baja', 'es'), /hasta 4 pisos/);
  assert.match(categoryLabel('alta', 'en'), /7\+/);
});

test('zoningFromRow only when enabled and categorised', () => {
  assert.equal(zoningFromRow({ zoning_category: 'baja' }, false), null);
  assert.equal(zoningFromRow({ zoning_category: null }, true), null);
  assert.deepEqual(
    zoningFromRow({ zoning_code: 'AR1A', zoning_category: 'baja', zoning_max_floors: 3, zoning_source: 'asuncion' }, true),
    { code: 'AR1A', category: 'baja', maxFloors: 3, source: 'asuncion' },
  );
  assert.equal(typeof zoningEnabled(), 'boolean');
});
