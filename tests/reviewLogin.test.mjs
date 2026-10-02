import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewLogin, isReviewEmail, reviewCodeMatches, REVIEW_EMAIL, REVIEW_CODE } from '../lib/reviewLogin.js';

test('on by default with the values in the code (no env needed)', () => {
  assert.deepEqual(reviewLogin({}), { email: 'review@casa-libre.com.py', code: '395171' });
  assert.equal(REVIEW_EMAIL, 'review@casa-libre.com.py');
  assert.equal(REVIEW_CODE, '395171');
  assert.equal(isReviewEmail(' REVIEW@casa-libre.com.py ', {}), true);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '395171', {}), true);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', ' 395171 ', {}), true);
});

test('wrong code or any other email is refused', () => {
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '395172', {}), false);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '', {}), false);
  assert.equal(reviewCodeMatches('someone@example.com', '395171', {}), false);
  assert.equal(isReviewEmail('someone@example.com', {}), false);
});

test('env can override or switch it off', () => {
  const over = { REVIEW_LOGIN_EMAIL: 'Other@Casa-Libre.com.py', REVIEW_LOGIN_CODE: '111222' };
  assert.equal(reviewCodeMatches('other@casa-libre.com.py', '111222', over), true);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '395171', over), false);
  assert.equal(reviewLogin({ REVIEW_LOGIN: 'off' }), null);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '395171', { REVIEW_LOGIN: 'OFF' }), false);
  assert.equal(reviewLogin({ REVIEW_LOGIN_CODE: '1234' }), null, 'a bad override fails closed');
});
