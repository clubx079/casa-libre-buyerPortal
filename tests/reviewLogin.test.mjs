import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewLogin, isReviewEmail, reviewCodeMatches } from '../lib/reviewLogin.js';

const ENV = { REVIEW_LOGIN_EMAIL: 'Review@Casa-Libre.com.py', REVIEW_LOGIN_CODE: '482915' };

test('only the review email, with the exact code', () => {
  assert.equal(isReviewEmail('review@casa-libre.com.py', ENV), true);
  assert.equal(isReviewEmail(' REVIEW@casa-libre.com.py ', ENV), true);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '482915', ENV), true);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', ' 482915 ', ENV), true);
});

test('wrong code or any other email is refused', () => {
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '482916', ENV), false);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '', ENV), false);
  assert.equal(reviewCodeMatches('someone@example.com', '482915', ENV), false);
  assert.equal(isReviewEmail('someone@example.com', ENV), false);
});

test('off unless both settings are valid', () => {
  assert.equal(reviewLogin({}), null);
  assert.equal(reviewLogin({ REVIEW_LOGIN_EMAIL: 'review@casa-libre.com.py' }), null);
  assert.equal(reviewLogin({ REVIEW_LOGIN_EMAIL: 'review@casa-libre.com.py', REVIEW_LOGIN_CODE: '1234' }), null);
  assert.equal(reviewLogin({ REVIEW_LOGIN_EMAIL: 'not-an-email', REVIEW_LOGIN_CODE: '123456' }), null);
  assert.equal(reviewCodeMatches('review@casa-libre.com.py', '482915', {}), false);
  assert.equal(isReviewEmail('review@casa-libre.com.py', {}), false);
});
