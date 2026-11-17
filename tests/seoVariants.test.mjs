import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTS, isVariantSlug, statsOf, inVariant, variantFilter, variantState, fillCount, median } from '../lib/seoVariants.js';
import { statsLine, faqFor, fillGuide, fillText, placeholderPaths, monthEs } from '../lib/seoContent.js';

const rows = Array.from({ length: 12 }, (_, i) => ({ price_usd: 300 + i * 50, bedrooms: i % 3 === 0 ? 2 : 1, created_at: `2026-11-${String(10 + i).padStart(2, '0')}T00:00:00Z` }));
const money = (u) => `US$ ${Math.round(u)}`;

test('variant slugs are the real filters only (a barrio slug is never a variant)', () => {
  assert.equal(isVariantSlug('baratos'), true);
  assert.equal(isVariantSlug('2-dormitorios'), true);
  assert.equal(isVariantSlug('villa-morra'), false);
  assert.equal(isVariantSlug('toString'), false);
  assert.deepEqual(Object.keys(VARIANTS), ['baratos', '1-dormitorio', '2-dormitorios', '3-dormitorios']);
});

test('live stats: count, median, range, newest', () => {
  const s = statsOf(rows);
  assert.deepEqual(s, { count: 12, priced: 12, median: median(rows.map((r) => r.price_usd)), min: 300, max: 850, newest: '2026-11-21T00:00:00Z' });
  assert.equal(statsOf([]).median, null);
  assert.equal(statsOf([{ price_usd: null }]).priced, 0);
});

test('baratos = under the city median; bedrooms exact; filters for the listing grid', () => {
  const m = statsOf(rows).median;
  assert.equal(rows.filter((r) => inVariant(r, 'baratos', m)).length, 6);
  assert.equal(rows.filter((r) => inVariant(r, '2-dormitorios', m)).length, 4);
  assert.equal(inVariant({ price_usd: null }, 'baratos', m), false);
  assert.deepEqual(variantFilter('baratos', 575), { priceMax: 574 });
  assert.deepEqual(variantFilter('1-dormitorio', 575), { bedsExact: 1 });
});

test('the 5-listing gate for variants: index / noindex / off (404)', () => {
  assert.equal(variantState({ slug: 'baratos', count: 6, enabled: ['baratos'] }), 'index');
  assert.equal(variantState({ slug: 'baratos', count: 4, enabled: ['baratos'] }), 'noindex');
  assert.equal(variantState({ slug: 'baratos', count: 6, retired: ['baratos'] }), 'noindex');
  assert.equal(variantState({ slug: 'baratos', count: 60 }), 'off');                 // not switched on → 404
  assert.equal(variantState({ slug: 'baratos', count: 0, enabled: ['baratos'] }), 'off');
  assert.equal(variantState({ slug: 'piscina', count: 9, enabled: ['piscina'] }), 'off');
});

test('override titles can carry {count}', () => {
  assert.equal(fillCount('Departamentos en alquiler — {count} opciones', 12), 'Departamentos en alquiler — 12 opciones');
  assert.equal(fillCount(null, 3), null);
});

test('intro stats line + FAQ from data', () => {
  const stats = statsOf(rows);
  const ctx = { op: 'alquiler', sing: 'departamento', plural: 'departamentos', opLabel: 'en alquiler', place: 'Asunción', stats, money };
  const line = statsLine(ctx);
  assert.match(line, /Hoy hay 12 departamentos en alquiler en Asunción; el precio típico es US\$ 575 por mes; van de US\$ 300 a US\$ 850\./);
  assert.match(line, /21 de noviembre de 2026/);
  const faq = faqFor(ctx);
  assert.equal(faq[0].q, '¿Cuánto cuesta alquilar un departamento en Asunción?');
  assert.match(faq[0].a, /US\$ 575 por mes, con opciones desde US\$ 300 hasta US\$ 850/);
  assert.equal(faqFor({ ...ctx, stats: statsOf([]) }).length, 0);
  assert.equal(statsLine({ ...ctx, stats: statsOf([]) }), null);
});

test('guide placeholders are filled from live stats (monthly)', () => {
  const g = {
    title: 'Precios {{month}}', h1: '¿Cuánto cuesta?', answer: 'Típico {{median:/alquiler/departamentos/asuncion}} ({{count:/alquiler/departamentos/asuncion}} avisos), {{range:/alquiler/departamentos/asuncion}}.',
    sections: [{ h2: 'Rango', paras: ['Desde {{min:/alquiler/departamentos/asuncion}} hasta {{max:/alquiler/departamentos/asuncion}}; casas {{count:/venta/casas/asuncion}}.'] }],
    faq: [{ q: '¿Cuántos?', a: '{{count:/venta/casas/luque}} casas. Último: {{newest:/alquiler/departamentos/asuncion}}' }],
  };
  assert.deepEqual(placeholderPaths(g).sort(), ['/alquiler/departamentos/asuncion', '/venta/casas/asuncion', '/venta/casas/luque']);
  const out = fillGuide(g, { '/alquiler/departamentos/asuncion': statsOf(rows), '/venta/casas/asuncion': statsOf([]) }, money, monthEs(new Date('2026-11-18T00:00:00Z')));
  assert.equal(out.title, 'Precios noviembre de 2026');
  assert.equal(out.answer, 'Típico US$ 575 (12 avisos), US$ 300 a US$ 850.');
  assert.equal(out.sections[0].paras[0], 'Desde US$ 300 hasta US$ 850; casas 0.');
  assert.equal(out.faq[0].a, '0 casas. Último: 21 de noviembre de 2026');
  assert.equal(fillText('sin tokens', {}, money, 'x'), 'sin tokens');
});
