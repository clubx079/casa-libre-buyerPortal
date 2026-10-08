import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVerdict, scanOutcome, FAIL_CATEGORIES } from '../lib/scanVerdict.js';

test('the model answer → a verdict', () => {
  assert.deepEqual(parseVerdict('PASS'), { verdict: 'pass' });
  assert.deepEqual(parseVerdict('  pass.\n'), { verdict: 'pass' });
  assert.deepEqual(parseVerdict('FAIL: adult'), { verdict: 'fail', category: 'adult' });
  assert.deepEqual(parseVerdict('FAIL - violence'), { verdict: 'fail', category: 'violence' });
  assert.deepEqual(parseVerdict('Fail: hate symbols'), { verdict: 'fail', category: 'hate' });
  assert.deepEqual(parseVerdict('FAIL: something else'), { verdict: 'fail', category: 'unrelated' });   // unknown → unrelated
  assert.equal(parseVerdict('I think this is a kitchen').verdict, 'error');                            // unclear → ask again
  assert.equal(parseVerdict('').verdict, 'error');
  assert.deepEqual(FAIL_CATEGORIES, ['adult', 'violence', 'hate', 'unrelated']);
});

test('a listing: any failed photo rejects it; an unchecked photo means retry; never let through', () => {
  const pass = { verdict: 'pass' }, fail = { verdict: 'fail', category: 'adult' }, err = { verdict: 'error', error: 'groq_http_503' };
  assert.equal(scanOutcome([pass, pass]), 'published');
  assert.equal(scanOutcome([]), 'published');                 // no photos → nothing to check
  assert.equal(scanOutcome([pass, fail]), 'rejected');
  assert.equal(scanOutcome([err, fail]), 'rejected');         // a sure failure wins
  assert.equal(scanOutcome([pass, err]), 'retry');            // AI down for one photo → ask again later
  assert.equal(scanOutcome([pass, undefined]), 'retry');
});
