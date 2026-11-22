import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUserType, isSeller, isBuyer, inSellerAudience, userTypeGroup, hasListed, shouldAskUserType,
  userTypePatch, typeShares, typeFromAuthBody, ASK_WINDOW_DAYS,
} from '../lib/userType.js';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

test('normalizeUserType: seller/buyer in en/es, anything else null', () => {
  assert.equal(normalizeUserType('Seller'), 'seller');
  assert.equal(normalizeUserType('vendedor'), 'seller');
  assert.equal(normalizeUserType('comprador'), 'buyer');
  assert.equal(normalizeUserType(' buyer '), 'buyer');
  assert.equal(normalizeUserType('agent'), null);
  assert.equal(normalizeUserType(null), null);
});

test('isSeller: seller type or anyone who listed; isBuyer only the type', () => {
  assert.equal(isSeller({ user_type: 'seller' }), true);
  assert.equal(isSeller({ user_type: 'buyer' }), false);
  assert.equal(isSeller({ user_type: 'buyer', first_listed_at: iso(NOW) }), true);
  assert.equal(isSeller({ user_type: 'buyer' }, 2), true);
  assert.equal(isSeller({}), false);
  assert.equal(isBuyer({ user_type: 'buyer' }), true);
  assert.equal(hasListed({}, 0), false);
});

test('inSellerAudience: only a buyer who never listed is left out; unknown keeps getting seller emails', () => {
  assert.equal(inSellerAudience({ user_type: null }), true);
  assert.equal(inSellerAudience({}), true);
  assert.equal(inSellerAudience({ user_type: 'seller' }), true);
  assert.equal(inSellerAudience({ user_type: 'buyer' }), false);
  assert.equal(inSellerAudience({ user_type: 'buyer', first_listed_at: iso(NOW) }), true);
  assert.equal(inSellerAudience({ user_type: 'buyer' }, 1), true);
});

test('userTypeGroup: the four groups + unknown', () => {
  assert.equal(userTypeGroup({ user_type: 'seller', first_listed_at: iso(NOW) }), 'seller_listed');
  assert.equal(userTypeGroup({ user_type: 'seller' }), 'seller_never_listed');
  assert.equal(userTypeGroup({ user_type: 'seller' }, 3), 'seller_listed');
  assert.equal(userTypeGroup({ user_type: 'buyer' }), 'buyer');
  assert.equal(userTypeGroup({ user_type: 'buyer' }, 1), 'buyer_listed');
  assert.equal(userTypeGroup({}), 'unknown');
});

test('shouldAskUserType: column present, empty, account newer than the window', () => {
  const fresh = { user_type: null, created_at: iso(NOW - 3600e3) };
  assert.equal(shouldAskUserType(fresh, NOW), true);
  assert.equal(shouldAskUserType({ created_at: fresh.created_at }, NOW), false);                 // no column (migration not run)
  assert.equal(shouldAskUserType({ ...fresh, user_type: 'buyer' }, NOW), false);
  assert.equal(shouldAskUserType({ user_type: null, created_at: iso(NOW - (ASK_WINDOW_DAYS + 1) * 864e5) }, NOW), false);
  assert.equal(shouldAskUserType(null, NOW), false);
});

test('userTypePatch: normalized type, known source, timestamp', () => {
  const p = userTypePatch('Vendedor', 'sell_funnel', new Date(NOW));
  assert.deepEqual(p, { user_type: 'seller', user_type_source: 'sell_funnel', user_type_at: iso(NOW) });
  assert.equal(userTypePatch('x', 'sell_funnel'), null);
  assert.equal(userTypePatch('buyer', 'made-up').user_type_source, null);
});

test('typeFromAuthBody: sell funnel wins, then the log-in pick', () => {
  assert.deepEqual(typeFromAuthBody({ signupSource: 'sell', userType: 'buyer' }), { type: 'seller', source: 'sell_funnel' });
  assert.deepEqual(typeFromAuthBody({ signupSource: 'app_sell' }), { type: 'seller', source: 'app_sell' });
  assert.deepEqual(typeFromAuthBody({ userType: 'buyer' }), { type: 'buyer', source: 'login_choice' });
  assert.equal(typeFromAuthBody({}), null);
  assert.equal(typeFromAuthBody(undefined), null);
});

test('typeShares: percentages over known types', () => {
  const s = typeShares(['seller_listed', 'seller_never_listed', 'seller_never_listed', 'buyer', 'buyer_listed', 'unknown', { group: 'buyer' }]);
  assert.equal(s.known, 6);
  assert.equal(s.total, 7);
  assert.equal(s.pctSellers, 50);
  assert.equal(s.pctBuyers, 50);
  assert.equal(s.pctSellersNeverListed, 66.7);
  assert.equal(s.pctBuyersListed, 33.3);
  assert.equal(typeShares([]).pctSellers, 0);
});
