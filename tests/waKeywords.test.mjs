import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isYes, isBaja, publishLink, yesReply, formulaContext, FORMULA_TEMPLATES, SHORT_LINKS, shortLink, recipientRef } from '../lib/waKeywords.js';

test('SÍ / BAJA are recognised however they arrive (button text or typed)', () => {
  for (const s of ['SÍ', 'Sí', 'si', 'SI!', ' sí. ']) assert.equal(isYes(s), true, s);
  for (const s of ['sin', 'sí, pero', 'no', '']) assert.equal(isYes(s), false, s);
  for (const s of ['BAJA', 'baja', 'Baja.']) assert.equal(isBaja(s), true, s);
  assert.equal(isBaja('bajar precio'), false);
});

test("the message shows a short link; it opens /publicar with Roland's UTM tags", () => {
  assert.equal(shortLink('agentes'), 'https://casa-libre.com.py/r/si-ag');
  assert.equal(shortLink('duenos'), 'https://casa-libre.com.py/r/si-du');
  const u = new URL(publishLink('agentes'));
  assert.equal(u.origin + u.pathname, 'https://casa-libre.com.py/publicar');
  assert.equal(u.searchParams.get('utm_source'), 'whatsapp');
  assert.equal(u.searchParams.get('utm_medium'), 'mensaje');
  assert.equal(u.searchParams.get('utm_campaign'), 'agentes_lanzamiento');
  assert.equal(u.searchParams.get('utm_content'), 'respuesta_si');
  for (const [code, aud] of Object.entries(SHORT_LINKS)) assert.equal(shortLink(aud).endsWith(`/r/${code}`), true);
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
  assert.deepEqual(formulaContext([yes, tpl], { now }), { template: 'cl_inmobiliarias_cartera', audience: 'inmobiliarias', sentAt: '2026-11-03T10:00:00.000Z', alreadyAnswered: false });
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
