import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isYes, isBaja, publishLink, yesReply, formulaContext, FORMULA_TEMPLATES } from '../lib/waKeywords.js';

test('SÍ / BAJA are recognised however they arrive (button text or typed)', () => {
  for (const s of ['SÍ', 'Sí', 'si', 'SI!', ' sí. ']) assert.equal(isYes(s), true, s);
  for (const s of ['sin', 'sí, pero', 'no', '']) assert.equal(isYes(s), false, s);
  for (const s of ['BAJA', 'baja', 'Baja.']) assert.equal(isBaja(s), true, s);
  assert.equal(isBaja('bajar precio'), false);
});

test("the link: /publicar with Roland's UTM tags (lowercase, underscores) + the batch", () => {
  const u = new URL(publishLink('agentes', { batch: 'wc-Agentes-1-abcd' }));
  assert.equal(u.origin + u.pathname, 'https://casa-libre.com.py/publicar');
  assert.equal(u.searchParams.get('utm_source'), 'whatsapp');
  assert.equal(u.searchParams.get('utm_medium'), 'mensaje');
  assert.equal(u.searchParams.get('utm_campaign'), 'agentes_lanzamiento');
  assert.equal(u.searchParams.get('utm_content'), 'respuesta_si');
  assert.equal(u.searchParams.get('utm_term'), 'wc-agentes-1-abcd');
  assert.equal(new URL(publishLink('duenos')).searchParams.has('utm_term'), false);
});

test('each audience gets its reply, no emojis, always with the link', () => {
  for (const a of new Set(Object.values(FORMULA_TEMPLATES))) {
    const r = yesReply(a);
    assert.match(r, /utm_campaign=/);
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
  const answered = msg('outbound', 'text', '2026-11-03T10:05:02Z', { text: 'x https://casa-libre.com.py/publicar?utm_content=respuesta_si' });
  assert.equal(formulaContext([answered, yes, tpl], { now }).alreadyAnswered, true);
  // another template last → not ours
  const other = msg('outbound', 'template', '2026-11-03T11:00:00Z', { template: { name: 'cl_porfin_texto' } });
  assert.equal(formulaContext([other, yes, tpl], { now }), null);
  // too old
  assert.equal(formulaContext([tpl], { now: Date.parse('2026-11-20T00:00:00Z') }), null);
});
