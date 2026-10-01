import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletePosthogPerson } from '../lib/posthogPerson.js';

const ENV = { POSTHOG_PERSONAL_API_KEY: 'phx_test', POSTHOG_PROJECT_ID: '565899', POSTHOG_HOST: 'https://us.posthog.com/' };
const reply = (status, body) => async (url, init) => {
  reply.last = { url, init };
  return { ok: status >= 200 && status < 300, status, json: async () => body };
};

test('asks PostHog to delete the person, their events and recordings by our user id', async () => {
  const r = await deletePosthogPerson('user-1', { env: ENV, fetchImpl: reply(202, { persons_found: 1, persons_queued_for_deletion: 1, deletion_errors: [] }) });
  assert.deepEqual(r, { ok: true, queued: 1 });
  assert.equal(reply.last.url, 'https://us.posthog.com/api/projects/565899/persons/bulk_delete/');
  assert.equal(reply.last.init.method, 'POST');
  assert.equal(reply.last.init.headers.Authorization, 'Bearer phx_test');
  assert.deepEqual(JSON.parse(reply.last.init.body), { distinct_ids: ['user-1'], delete_events: true, delete_recordings: true });
});

test('a person PostHog never saw is fine', async () => {
  const r = await deletePosthogPerson('user-2', { env: ENV, fetchImpl: reply(202, { persons_found: 0, persons_queued_for_deletion: 0, deletion_errors: [] }) });
  assert.equal(r.ok, true);
});

test('failures are reported, never thrown', async () => {
  assert.match((await deletePosthogPerson('u', { env: ENV, fetchImpl: reply(403, { detail: 'scope' }) })).error, /needs_person_write_scope/);
  assert.equal((await deletePosthogPerson('u', { env: ENV, fetchImpl: reply(202, { deletion_errors: [{ person_uuid: 'x' }] }) })).ok, false);
  const boom = await deletePosthogPerson('u', { env: ENV, fetchImpl: async () => { throw new Error('offline'); } });
  assert.match(boom.error, /posthog_network/);
});

test('not configured → skipped without calling PostHog', async () => {
  let called = false;
  const r = await deletePosthogPerson('u', { env: {}, fetchImpl: async () => { called = true; } });
  assert.equal(r.skipped, true);
  assert.equal(called, false);
});
