import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessLang } from '../lib/descLang.js';
import { cleanDescription, translateText, createCache, createLimiter, MAX_CHARS } from '../lib/translate.js';

const ES = 'Hermosa casa en venta con 3 dormitorios, 2 baños y cocina amplia. Ubicada a 2 cuadras del Shopping del Sol, en una zona muy tranquila.';
const EN = 'Beautiful house for sale with 3 bedrooms, 2 bathrooms and a large kitchen. Located 2 blocks from the mall in a quiet area.';

test('guessLang tells Spanish from English listing text', () => {
  assert.equal(guessLang(ES), 'es');
  assert.equal(guessLang(EN), 'en');
});

test('guessLang returns null when it cannot tell', () => {
  assert.equal(guessLang(''), null);
  assert.equal(guessLang(null), null);
  assert.equal(guessLang('Villa Morra 450 m2'), null);
});

test('cleanDescription strips html, keeps line breaks, caps the length', () => {
  assert.equal(cleanDescription('Linda casa<br/>con <b>piscina</b>&nbsp;y   patio'), 'Linda casa\ncon piscina y patio');
  assert.equal(cleanDescription('a\n\n\n\nb'), 'a\n\nb');
  assert.equal(cleanDescription('Baño con mueble, \r\nLote de 180 m2\rZona'), 'Baño con mueble,\nLote de 180 m2\nZona');
  assert.equal(cleanDescription('x'.repeat(MAX_CHARS + 50)).length, MAX_CHARS);
  assert.equal(cleanDescription(undefined), '');
});

// Fake Groq: records the request, answers with `reply`.
function fakeFetch(reply, { ok = true, finish = 'stop' } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok, json: async () => ({ choices: [{ message: { content: reply }, finish_reason: finish }] }) };
  };
  fn.calls = calls;
  return fn;
}

test('translateText calls Groq with the model, target language and the cleaned text', async () => {
  const f = fakeFetch('  Beautiful house for sale  ');
  const out = await translateText('Hermosa casa<br>en venta', 'en', { apiKey: 'k', model: 'openai/gpt-oss-20b', fetchImpl: f });
  assert.equal(out, 'Beautiful house for sale');
  const { url, init, body } = f.calls[0];
  assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(init.headers.Authorization, 'Bearer k');
  assert.equal(body.model, 'openai/gpt-oss-20b');
  assert.equal(body.reasoning_effort, 'low');            // reasoning model → low effort + room to think
  assert.ok(body.max_tokens >= 1024);
  assert.match(body.messages[0].content, /English/);
  assert.equal(body.messages[1].content, 'Hermosa casa\nen venta');
});

test('translateText drops the trailing spaces the model leaves at line ends', async () => {
  const out = await translateText('Casa\nTerreno', 'en', { apiKey: 'k', model: 'm', fetchImpl: fakeFetch('House  \nLand  ') });
  assert.equal(out, 'House\nLand');
});

test('translateText gives an instruct model no reasoning settings', async () => {
  const f = fakeFetch('Hola');
  await translateText('Hello', 'es', { apiKey: 'k', model: 'llama-3.1-8b-instant', fetchImpl: f });
  assert.equal(f.calls[0].body.reasoning_effort, undefined);
  assert.match(f.calls[0].body.messages[0].content, /Spanish/);
});

test('translateText returns null instead of throwing on every failure', async () => {
  const opts = (fetchImpl) => ({ apiKey: 'k', model: 'm', fetchImpl });
  assert.equal(await translateText('Hola', 'en', { apiKey: '', fetchImpl: fakeFetch('x') }), null);   // no key
  assert.equal(await translateText('Hola', 'pt', opts(fakeFetch('x'))), null);                       // unknown target
  assert.equal(await translateText('   ', 'en', opts(fakeFetch('x'))), null);                        // nothing to translate
  assert.equal(await translateText('Hola', 'en', opts(fakeFetch('x', { ok: false }))), null);        // HTTP error
  assert.equal(await translateText('Hola', 'en', opts(fakeFetch('Hel', { finish: 'length' }))), null); // cut off
  assert.equal(await translateText('Hola', 'en', opts(fakeFetch(''))), null);                        // empty answer
  assert.equal(await translateText('Hola', 'en', opts(async () => { throw new Error('net'); })), null);
});

test('cache keys on the cleaned text + target and drops the oldest entry when full', () => {
  const c = createCache(2);
  c.set('Hola<br>mundo', 'en', 'Hello\nworld');
  assert.equal(c.get('Hola\nmundo', 'en'), 'Hello\nworld');
  assert.equal(c.get('Hola\nmundo', 'es'), null);
  c.set('b', 'en', 'B');
  c.set('c', 'en', 'C');
  assert.equal(c.get('Hola\nmundo', 'en'), null);
  assert.equal(c.get('c', 'en'), 'C');
});

test('limiter allows max requests per window per IP, then resets', () => {
  const l = createLimiter({ max: 2, windowMs: 1000 });
  assert.equal(l.allow('1.1.1.1', 0), true);
  assert.equal(l.allow('1.1.1.1', 10), true);
  assert.equal(l.allow('1.1.1.1', 20), false);
  assert.equal(l.allow('2.2.2.2', 20), true);            // other visitors unaffected
  assert.equal(l.allow('1.1.1.1', 1001), true);          // window over
  assert.equal(l.allow(null, 0), true);                  // unknown IP still works
});
