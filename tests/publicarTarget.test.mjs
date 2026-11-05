import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicarTarget } from '../lib/publicarTarget.js';

test('/publicar → home page with the sell form open, every tracking tag kept', () => {
  assert.equal(publicarTarget({}), '/?sell=1');
  const u = new URLSearchParams(publicarTarget({ utm_source: 'whatsapp', utm_medium: 'assistant', utm_campaign: 'ai_reply', utm_content: 'e6b58b1238', utm_term: '0vkq83t' }).slice(2));
  assert.equal(u.get('sell'), '1');
  for (const [k, v] of [['utm_source', 'whatsapp'], ['utm_medium', 'assistant'], ['utm_campaign', 'ai_reply'], ['utm_content', 'e6b58b1238'], ['utm_term', '0vkq83t']]) assert.equal(u.get(k), v, k);
});

test('/publicar keeps how the form should open (back from Google, resume) and the app params', () => {
  assert.equal(publicarTarget({ sell: 'resume' }), '/?sell=resume');
  assert.equal(publicarTarget({ auth_error: 'x' }), '/?auth_error=x');
  assert.equal(publicarTarget({ publicar: '1' }), '/?publicar=1');
  const u = new URLSearchParams(publicarTarget({ app: '1', ret: 'casalibre://x' }).slice(2));
  assert.equal(u.get('app'), '1'); assert.equal(u.get('ret'), 'casalibre://x'); assert.equal(u.get('sell'), '1');
});
