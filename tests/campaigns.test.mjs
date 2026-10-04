import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGNS, ALIASES, resolveSlug, campaignUrl } from '../lib/campaigns.js';

const O = 'https://casa-libre.com.py';

test('one link per channel', () => {
  assert.deepEqual(Object.keys(CAMPAIGNS), ['rd', 'fb', 'ig', 'x', 'tt', 'meta', 'gads', 'wa', 'mail']);
  const sources = Object.values(CAMPAIGNS).map((c) => c.source);
  assert.equal(new Set(sources).size, sources.length, 'each channel has its own utm_source');
  for (const c of Object.values(CAMPAIGNS)) assert.ok(c.label, 'every channel has a label for the admin');
});

test('old links already posted keep working and count under their channel', () => {
  for (const old of ['rda', 'rdsell', 'rdbuy', 'rdrent']) assert.equal(resolveSlug(old), 'rd', old);
  assert.equal(resolveSlug('IGS'), 'ig');
  assert.equal(resolveSlug('metasell'), 'meta');
  assert.equal(resolveSlug('x'), 'x');
  assert.equal(resolveSlug('zzz'), null);
  assert.equal(resolveSlug(''), null);
  for (const target of Object.values(ALIASES)) assert.ok(CAMPAIGNS[target], `alias points at a real channel: ${target}`);
});

test('every link goes to the home page with its channel tags', () => {
  assert.equal(campaignUrl(O, 'rd'), `${O}/?utm_source=reddit&utm_medium=social&utm_campaign=reddit`);
  assert.equal(campaignUrl(O + '/', 'rdbuy'), `${O}/?utm_source=reddit&utm_medium=social&utm_campaign=reddit`);
  assert.equal(campaignUrl(O, 'x'), `${O}/?utm_source=x&utm_medium=social&utm_campaign=x`);
  assert.equal(campaignUrl(O, 'meta'), `${O}/?utm_source=meta&utm_medium=cpc&utm_campaign=meta_ads`);
  assert.equal(campaignUrl(O, 'nope'), null);
});
