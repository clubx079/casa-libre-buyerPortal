import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupAsuncionZone } from '../lib/zoning/asuncion.js';
import { providerForCity } from '../lib/zoning/providers.js';

function fakeFetch(features, { ok = true, text } = {}) {
  const f = async (url) => {
    f.last = url;
    return { ok, status: ok ? 200 : 500, text: async () => text ?? JSON.stringify({ features }) };
  };
  return f;
}

test('majority zone inside the 25 m box, mapped through the rules', async () => {
  const f = fakeFetch([{ attributes: { zona_reg: 'AR2A' } }, { attributes: { zona_reg: 'AR2A' } }, { attributes: { zona_reg: 'FM2' } }]);
  const z = await lookupAsuncionZone(-25.2907, -57.5803, { fetchImpl: f });
  assert.deepEqual([z.code, z.category, z.maxFloors], ['AR2A', 'media', 5]);
  assert.match(f.last, /PlanRegulador\/MapServer\/4\/query/);
  assert.match(f.last, /esriGeometryEnvelope/);
  assert.match(f.last, /returnGeometry=false/);
});

test('no features → null (outside the plan)', async () => {
  assert.equal(await lookupAsuncionZone(-25.3, -57.6, { fetchImpl: fakeFetch([]) }), null);
});

test('bad coordinates → null without calling the city', async () => {
  const f = fakeFetch([{ attributes: { zona_reg: 'AR1A' } }]);
  assert.equal(await lookupAsuncionZone(null, 'x', { fetchImpl: f }), null);
  assert.equal(f.last, undefined);
});

test('HTTP error, ArcGIS error or HTML page throws (so the job retries later)', async () => {
  await assert.rejects(lookupAsuncionZone(-25.3, -57.6, { fetchImpl: fakeFetch([], { ok: false }) }));
  await assert.rejects(lookupAsuncionZone(-25.3, -57.6, { fetchImpl: fakeFetch([], { text: '<html>error</html>' }) }));
  await assert.rejects(lookupAsuncionZone(-25.3, -57.6, { fetchImpl: fakeFetch([], { text: '{"error":{"code":500}}' }) }));
});

test('provider registry: Asunción spellings only', () => {
  for (const c of ['Asunción', 'asuncion', ' ASUNCIÓN ', 'Asuncion (Villa Morra)']) assert.equal(providerForCity(c)?.id, 'asuncion', c);
  for (const c of ['Luque', 'Lambaré', 'San Lorenzo', 'Gran Asunción', '', null]) assert.equal(providerForCity(c), null, String(c));
});
