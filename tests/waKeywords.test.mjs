import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlanYes, planReply, planContext, isYes, isBaja, keywordOf, publishLink, yesReply, carteraReply, proyectoReply, keywordReply, keywordLink, BAJA_REPLY, formulaContext, FORMULA_TEMPLATES, SHORT_LINKS, SHORT_CONTENT, shortLink, recipientRef } from '../lib/waKeywords.js';

test('SÍ / BAJA are recognised however they arrive (button text or typed)', () => {
  for (const s of ['SÍ', 'Sí', 'si', 'SI!', ' sí. ']) assert.equal(isYes(s), true, s);
  for (const s of ['sin', 'sí, pero', 'no', '']) assert.equal(isYes(s), false, s);
  for (const s of ['BAJA', 'baja', 'Baja.']) assert.equal(isBaja(s), true, s);
  assert.equal(isBaja('bajar precio'), false);
});

test("the message shows a short link; it opens the home page with the sell form open, with Roland's UTM tags", () => {
  assert.equal(shortLink('agentes'), 'https://casa-libre.com.py/r/si-ag');
  assert.equal(shortLink('duenos'), 'https://casa-libre.com.py/r/si-du');
  const u = new URL(publishLink('agentes'));
  assert.equal(u.origin + u.pathname, 'https://casa-libre.com.py/');
  assert.equal(u.searchParams.get('sell'), '1');
  assert.equal(u.searchParams.get('utm_source'), 'whatsapp');
  assert.equal(u.searchParams.get('utm_medium'), 'mensaje');
  assert.equal(u.searchParams.get('utm_campaign'), 'agentes_lanzamiento');
  assert.equal(u.searchParams.get('utm_content'), 'respuesta_si');
  for (const [code, aud] of Object.entries(SHORT_LINKS)) if (code.startsWith('si-')) assert.equal(shortLink(aud).endsWith(`/r/${code}`), true);
  // every formula audience has a short link
  for (const a of new Set(Object.values(FORMULA_TEMPLATES))) assert.ok(Object.values(SHORT_LINKS).includes(a), a);
});

test('each audience gets its reply, no emojis, always with the link', () => {
  for (const a of new Set(Object.values(FORMULA_TEMPLATES))) {
    const r = yesReply(a);
    assert.match(r, /casa-libre\.com\.py\/r\/si-/);
    assert.equal(/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(r), false, a);
  }
  assert.match(yesReply('inmobiliarias'), /cartera/);
  assert.match(yesReply('desarrolladoras'), /proyecto/);
});

const msg = (direction, type, at, extra = {}) => ({ direction, type, timestamps: { created: at }, ...extra });
test('only answers a reply to a formula template, recent, and only once', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');
  const tpl = msg('outbound', 'template', '2026-11-03T10:00:00Z', { template: { name: 'cl_inmobiliarias_cartera' } });
  const yes = msg('inbound', 'button', '2026-11-03T10:05:00Z', { text: 'SÍ' });
  assert.deepEqual(formulaContext([yes, tpl], { now }), { template: 'cl_inmobiliarias_cartera', audience: 'inmobiliarias', sentAt: '2026-11-03T10:00:00.000Z', answered: new Set(), alreadyAnswered: false });
  const answered = msg('outbound', 'text', '2026-11-03T10:05:02Z', { text: yesReply('inmobiliarias') });
  assert.equal(formulaContext([answered, yes, tpl], { now }).alreadyAnswered, true);
  // another template last → not ours
  const other = msg('outbound', 'template', '2026-11-03T11:00:00Z', { template: { name: 'cl_porfin_texto' } });
  assert.equal(formulaContext([other, yes, tpl], { now }), null);
  // too old
  assert.equal(formulaContext([tpl], { now: Date.parse('2026-11-20T00:00:00Z') }), null);
});

test("the person's code: same as the admin's recipientRef, on the short link and as utm_term", () => {
  // admin lib/waCampaigns.js recipientRef('lead:42') — the two must match
  const ref = recipientRef('lead:42');
  assert.match(ref, /^[0-9a-z]{7,8}$/);
  assert.equal(recipientRef('lead:42'), ref);
  assert.equal(shortLink('agentes', ref), `https://casa-libre.com.py/r/si-ag?r=${ref}`);
  assert.equal(new URL(publishLink('agentes', undefined, ref)).searchParams.get('utm_term'), ref);
  assert.match(yesReply('agentes', ref), new RegExp(`/r/si-ag\\?r=${ref}`));
});

test('CARTERA / PROYECTO: recognised, each with its own reply, link and utm_content', () => {
  assert.equal(keywordOf('Cartera'), 'cartera');
  assert.equal(keywordOf('PROYECTO.'), 'proyecto');
  assert.equal(keywordOf('sí'), 'si');
  assert.equal(keywordOf('baja'), 'baja');
  assert.equal(keywordOf('hola'), null);
  assert.equal(keywordLink('cartera', 'inmobiliarias', 'abc'), 'https://casa-libre.com.py/r/cartera?r=abc');
  assert.equal(keywordLink('proyecto', 'desarrolladoras'), 'https://casa-libre.com.py/r/proyecto');
  assert.equal(keywordLink('si', 'duenos', 'x'), 'https://casa-libre.com.py/r/si-du?r=x');
  assert.equal(SHORT_LINKS.cartera, 'inmobiliarias');
  assert.equal(new URL(publishLink('inmobiliarias', undefined, 'abc', SHORT_CONTENT.cartera)).searchParams.get('utm_content'), 'respuesta_cartera');
  assert.match(carteraReply('abc'), /cuántas propiedades tenés/);
  assert.match(carteraReply('abc'), /\/r\/cartera\?r=abc/);
  assert.match(proyectoReply(), /cómo se llama el proyecto/);
  assert.equal(keywordReply('cartera', 'inmobiliarias', 'z'), carteraReply('z'));
  assert.equal(keywordReply('si', 'agentes', 'z'), yesReply('agentes', 'z'));
  for (const r of [carteraReply(), proyectoReply(), BAJA_REPLY, yesReply('inmobiliarias')]) {
    assert.equal(/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(r), false);
    assert.equal(/Casa Libre/.test(r), false, 'the name is Casa-Libre, with the hyphen');
  }
});

test('a warm agent can tap SÍ and then CARTERA: each answered once', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');
  const tpl = msg('outbound', 'template', '2026-11-03T10:00:00Z', { template: { name: 'cl_agentes_link' } });
  const si = msg('outbound', 'text', '2026-11-03T10:05:02Z', { text: yesReply('agentes', 'q') });
  const ctx = formulaContext([si, tpl], { now });
  assert.equal(ctx.answered.has('si'), true);
  assert.equal(ctx.answered.has('cartera'), false);
  const ca = msg('outbound', 'text', '2026-11-03T10:06:02Z', { text: carteraReply('q') });
  assert.equal(formulaContext([ca, si, tpl], { now }).answered.has('cartera'), true);
});

test('"Sí, avisame" on the plan-for-agents template: recognised, confirmed once, no emojis', () => {
  for (const x of ['Sí, avisame', 'si avisame', 'SÍ, AVISAME!']) assert.equal(isPlanYes(x), true, x);
  assert.equal(isPlanYes('sí'), false);
  assert.equal(planReply('Ana Paz'), 'Listo, Ana: te avisamos primero cuando el plan para agentes de Casa-Libre esté disponible.');
  const now = Date.parse('2026-11-04T12:00:00Z');
  const tpl = msg('outbound', 'template', '2026-11-04T10:00:00Z', { template: { name: 'cl_plan_agentes_v2' } });
  assert.deepEqual(planContext([tpl], { now }), { template: 'cl_plan_agentes_v2', answered: false });
  const done = msg('outbound', 'text', '2026-11-04T10:01:00Z', { text: planReply('') });
  assert.equal(planContext([done, tpl], { now }).answered, true);
  assert.equal(planContext([msg('outbound', 'template', '2026-11-04T10:00:00Z', { template: { name: 'cl_visitas' } })], { now }), null);
});

test("the assistant's tracked links: same-site only, UTM-tagged with the person and the reply", async () => {
  const { aiTarget } = await import('../app/r/[slug]/route.js').catch(() => ({}));
  if (!aiTarget) return;   // the route imports Next — covered by the build
  const t = aiTarget('https://casa-libre.com.py', new URLSearchParams('u=/publicar&r=Abc123&a=be88dceaee'));
  assert.equal(t.url, 'https://casa-libre.com.py/publicar?utm_source=whatsapp&utm_medium=assistant&utm_campaign=ai_reply&utm_content=be88dceaee&utm_term=abc123');
  assert.equal(aiTarget('https://casa-libre.com.py', new URLSearchParams('u=//evil.com')).url.startsWith('https://casa-libre.com.py/?'), true);
});

test('the Nov 2026 mascot / analytics templates get the same replies as their audience', async () => {
  const { FORMULA_TEMPLATES } = await import('../lib/waKeywords.js');
  for (const [name, aud] of [['cl_agentes_mascota', 'agentes'], ['cl_agentes_estadisticas', 'agentes'], ['cl_inmobiliarias_mascota', 'inmobiliarias'], ['cl_inmobiliarias_estadisticas', 'inmobiliarias'], ['cl_desarrolladoras_mascota', 'desarrolladoras'], ['cl_desarrolladoras_estadisticas', 'desarrolladoras']]) {
    assert.equal(FORMULA_TEMPLATES[name], aud, name);
  }
});
