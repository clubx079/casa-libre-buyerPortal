import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './support/fakePostgrest.mjs';
import { registerToken, unregisterToken, sendPush, getPrefs, setPrefs, isExpoToken, cleanData, EXPO_PUSH_URL } from '../lib/push.js';

const SCHEMA = { unique: { push_tokens: ['token'], push_log: ['dedupe_key'], notification_prefs: ['user_id'] }, defaults: { push_tokens: { enabled: true } } };
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const T1 = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]';
const T2 = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbb]';
const T3 = 'ExponentPushToken[cccccccccccccccccccc]';

// Fake Expo push API: records requests, answers one ticket per message.
function fakeExpo(ticketFor = () => ({ status: 'ok', id: 'tkt' })) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const msgs = JSON.parse(init.body);
    calls.push({ url, init, msgs });
    return { ok: true, status: 200, json: async () => ({ data: msgs.map((m, i) => ({ id: `tkt-${i}`, ...ticketFor(m) })) }) };
  };
  return { calls, fetchImpl };
}

test('token format check', () => {
  assert.equal(isExpoToken(T1), true);
  assert.equal(isExpoToken('ExpoPushToken[xxxxxxxxxxxxxxxx]'), true);
  assert.equal(isExpoToken('not-a-token'), false);
  assert.equal(isExpoToken('ExponentPushToken[short]'), false);
});

test('register creates a row, re-register moves the phone to the new user and re-enables it', async () => {
  const db = createStore(SCHEMA);
  assert.deepEqual(await registerToken(db, U1, { token: T1, platform: 'android', appVersion: '1.3.0' }), { ok: true });
  assert.equal(db.tables.push_tokens.length, 1);
  await unregisterToken(db, T1);
  assert.equal(db.tables.push_tokens[0].enabled, false);
  await registerToken(db, U2, { token: T1, platform: 'android' });
  assert.equal(db.tables.push_tokens.length, 1);
  assert.equal(db.tables.push_tokens[0].user_id, U2);
  assert.equal(db.tables.push_tokens[0].enabled, true);
});

test('register rejects bad input', async () => {
  const db = createStore(SCHEMA);
  assert.equal((await registerToken(db, null, { token: T1, platform: 'ios' })).error, 'unauthorized');
  assert.equal((await registerToken(db, U1, { token: 'x', platform: 'ios' })).error, 'invalid_token');
  assert.equal((await registerToken(db, U1, { token: T1, platform: 'web' })).error, 'invalid_platform');
});

test('sendPush sends to every enabled device of the users, with channel + safe data', async () => {
  const db = createStore(SCHEMA);
  await registerToken(db, U1, { token: T1, platform: 'android' });
  await registerToken(db, U1, { token: T2, platform: 'ios' });
  await registerToken(db, U2, { token: T3, platform: 'android' });
  await unregisterToken(db, T3);
  const { calls, fetchImpl } = fakeExpo();
  const r = await sendPush(db, { userIds: [U1, U2], title: 'Hola', body: 'Prueba', channel: 'listings', kind: 'test', data: { url: '/property/abc', evil: 'x' } }, { fetchImpl, accessToken: 'tok' });
  assert.equal(r.sent, 2);
  assert.equal(r.failed, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, EXPO_PUSH_URL);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(calls[0].msgs.map((m) => m.to).sort(), [T1, T2].sort());
  assert.equal(calls[0].msgs[0].channelId, 'listings');
  assert.deepEqual(calls[0].msgs[0].data, { url: '/property/abc', kind: 'test' });
  assert.equal(db.tables.push_log.length, 2);
});

test('users who switched the channel off are skipped', async () => {
  const db = createStore(SCHEMA);
  await registerToken(db, U1, { token: T1, platform: 'android' });
  await setPrefs(db, U1, { news: false });
  assert.deepEqual(await getPrefs(db, U1), { listings: true, saved: true, news: false });
  const { calls, fetchImpl } = fakeExpo();
  const r = await sendPush(db, { userIds: [U1], title: 'a', body: 'b', channel: 'news' }, { fetchImpl });
  assert.equal(r.skipped, 1);
  assert.equal(calls.length, 0);
  const r2 = await sendPush(db, { userIds: [U1], title: 'a', body: 'b', channel: 'listings' }, { fetchImpl });
  assert.equal(r2.sent, 1);
});

test('DeviceNotRegistered disables the token', async () => {
  const db = createStore(SCHEMA);
  await registerToken(db, U1, { token: T1, platform: 'android' });
  const { fetchImpl } = fakeExpo(() => ({ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }));
  const r = await sendPush(db, { userIds: [U1], title: 'a', body: 'b' }, { fetchImpl });
  assert.equal(r.failed, 1);
  assert.equal(r.disabledTokens, 1);
  assert.equal(db.tables.push_tokens[0].enabled, false);
  assert.equal(db.tables.push_log[0].status, 'error');
});

test('dedupeKey sends at most once', async () => {
  const db = createStore(SCHEMA);
  await registerToken(db, U1, { token: T1, platform: 'android' });
  const { calls, fetchImpl } = fakeExpo();
  await sendPush(db, { userIds: [U1], title: 'a', body: 'b', dedupeKey: 'views:listing-1:50' }, { fetchImpl });
  const again = await sendPush(db, { userIds: [U1], title: 'a', body: 'b', dedupeKey: 'views:listing-1:50' }, { fetchImpl });
  assert.equal(again.duplicate, true);
  assert.equal(calls.length, 1);
});

test('network failure is logged, never thrown', async () => {
  const db = createStore(SCHEMA);
  await registerToken(db, U1, { token: T1, platform: 'android' });
  const r = await sendPush(db, { userIds: [U1], title: 'a', body: 'b' }, { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(r.failed, 1);
  assert.match(db.tables.push_log[0].error, /network:offline/);
});

test('no devices / missing text / bad channel', async () => {
  const db = createStore(SCHEMA);
  const { fetchImpl } = fakeExpo();
  assert.equal((await sendPush(db, { userIds: [U1], title: 'a', body: 'b' }, { fetchImpl })).noDevices, true);
  assert.equal((await sendPush(db, { userIds: [U1], title: '', body: 'b' }, { fetchImpl })).error, 'title_and_body_required');
  assert.equal((await sendPush(db, { userIds: [U1], title: 'a', body: 'b', channel: 'spam' }, { fetchImpl })).error, 'invalid_channel');
});

test('cleanData only forwards in-app paths', () => {
  assert.deepEqual(cleanData({ url: '/property/abc-123' }), { url: '/property/abc-123' });
  assert.deepEqual(cleanData({ url: '/(tabs)/saved' }), { url: '/(tabs)/saved' });
  assert.deepEqual(cleanData({ url: 'https://evil.com' }), {});
  assert.deepEqual(cleanData({ url: '/x?y=<script>' }), {});
});
