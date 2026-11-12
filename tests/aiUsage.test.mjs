import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, costUsd } from '../lib/aiPricing.js';
import { usageFromBody, usageRow } from '../lib/aiUsageCore.js';
import { makeTracker } from '../lib/aiUsageTrack.js';
import { refOf } from '../lib/campaigns.js';

const flush = () => new Promise((r) => setTimeout(r, 20));

test('prices for the website\'s Groq models', () => {
  assert.ok(priceFor('qwen/qwen3.8-27b'));
  assert.ok(priceFor('openai/gpt-oss-20b'));
  // one photo check ≈ 2,000 in + 40 out on qwen3.8 → about US$0.002
  assert.equal(costUsd('qwen/qwen3.8-27b', { input: 2000, output: 40 }), 0.00176);
});

test('a Groq answer → a website row', () => {
  const got = usageFromBody('groq', JSON.stringify({ model: 'qwen/qwen3.8-27b', usage: { prompt_tokens: 1900, completion_tokens: 3 } }));
  const row = usageRow({ app: 'website', provider: 'groq', model: got.model, feature: 'listing_photo_check', usage: got.usage, ref: 'listing:abc' });
  assert.equal(row.app, 'website');
  assert.equal(row.input_tokens, 1900);
  assert.equal(row.output_tokens, 3);
  assert.equal(row.ref, 'listing:abc');
  assert.ok(row.cost_usd > 0);
});

test('the tracked fetch logs in the background and hands the response back untouched', async () => {
  const rows = [];
  const t = makeTracker({ insert: async (table, r) => { rows.push({ table, row: r[0] }); } });
  const body = JSON.stringify({ model: 'qwen/qwen3.8-27b', usage: { prompt_tokens: 10, completion_tokens: 2 }, choices: [{ message: { content: 'PASS' } }] });
  const f = t.trackedFetch({ provider: 'groq', feature: 'listing_photo_check', ref: 'listing:1' }, async () => new Response(body));
  const res = await f('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'qwen/qwen3.8-27b' }) });
  assert.equal((await res.json()).choices[0].message.content, 'PASS');
  await flush();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].table, 'ai_usage_log');
  assert.equal(rows[0].row.feature, 'listing_photo_check');
  assert.equal(rows[0].row.ok, true);
});

test('errors are logged as failed; a missing table pauses logging and never breaks the call', async () => {
  const rows = [];
  let missing = true;
  const t = makeTracker({ insert: async (table, r) => { if (missing) throw Object.assign(new Error('relation "public.ai_usage_log" does not exist'), { code: '42P01' }); rows.push(r[0]); } });
  const f = t.trackedFetch({ provider: 'groq', feature: 'listing_translate' }, async () => new Response('{}', { status: 503 }));
  assert.equal((await f('u', { body: JSON.stringify({ model: 'openai/gpt-oss-20b' }) })).status, 503);
  await flush();
  missing = false;
  t.log({ provider: 'groq', model: 'openai/gpt-oss-20b', feature: 'listing_translate', usage: {} });
  await flush();
  assert.equal(rows.length, 0);   // paused after the missing-table error
  const g = makeTracker({ insert: async (table, r) => { rows.push(r[0]); } }).trackedFetch({ provider: 'groq', feature: 'x' }, async () => { throw new Error('offline'); });
  await assert.rejects(g('u', { body: '{}' }), /offline/);
  await flush();
  assert.equal(rows[0].ok, false);
});

test('the assistant\'s reply codes survive the /r/ai redirect (utm_content): ack… = sales reply, win… = window follow-up', () => {
  assert.equal(refOf('winb99a6ac2b6'), 'winb99a6ac2b6');
  assert.equal(refOf('ackb99a6ac2b6'), 'ackb99a6ac2b6');
});
