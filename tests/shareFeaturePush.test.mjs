import test from 'node:test';
import assert from 'node:assert/strict';
import { runShareFeaturePush, sharePushMessage, SHARE_PUSH_TEXT } from '../lib/automations/shareFeaturePush.js';

const ON = { id: 'share_feature_promo', enabled: true, enabled_at: '2026-11-24T00:00:00Z', template_id: 't1', free_tiers: [{}] };

function fakeDb({ tokens, users, props = [], log = [] }) {
  return {
    select: async (t, qs) => {
      if (t === 'push_tokens') return tokens;
      if (t === 'push_log') return log;
      if (t === 'users') return users.filter((u) => qs.includes(`"${u.id}"`));
      if (t === 'properties') return props.filter((p) => qs.includes(`"${p.created_by}"`));
      return [];
    },
  };
}
const user = (id, extra = {}) => ({ id, email: `${id}@mail.com`, full_name: id, active: true, ...extra });

test('wording: owner vs everyone else, Spanish by default', () => {
  assert.deepEqual(sharePushMessage(null, true), { ...SHARE_PUSH_TEXT.es.owner, url: '/my-listings' });
  assert.deepEqual(sharePushMessage('en', false), { ...SHARE_PUSH_TEXT.en.other, url: '/(tabs)' });
  assert.equal(sharePushMessage('xx', true).title, 'Nuevo: botón Compartir 📤');
  assert.equal(SHARE_PUSH_TEXT.en.owner.body, 'You can now share your property on WhatsApp, Instagram and Facebook with one tap, from My listings.');
});

test('sends once per person, right version, skips team / closed / already sent', async () => {
  const db = fakeDb({
    tokens: [{ user_id: 'a' }, { user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }, { user_id: 'd' }, { user_id: 'e' }],
    users: [user('a'), user('b'), user('c', { email: 'x@airosofts.com' }), user('d', { blocked: true }), user('e')],
    props: [{ created_by: 'a' }],
    log: [{ user_id: 'e' }],
  });
  const calls = [];
  const send = async (_db, o) => { calls.push(o); return { sent: 1 }; };
  const r = await runShareFeaturePush({ db, automation: ON, send });
  assert.equal(r.sent, 2);
  assert.equal(r.owners, 1);
  assert.equal(r.others, 1);
  assert.equal(r.excluded, 2);
  assert.equal(r.already, 1);
  const a = calls.find((c) => c.userIds[0] === 'a');
  assert.equal(a.data.url, '/my-listings');
  assert.equal(a.dedupeKey, 'sharefeature-push:a');
  assert.equal(a.channel, 'news');
  assert.equal(calls.find((c) => c.userIds[0] === 'b').data.url, '/(tabs)');
});

test('nothing at night, when the automation is off, or with push switched off', async () => {
  const db = fakeDb({ tokens: [{ user_id: 'a' }], users: [user('a')] });
  const send = async () => { throw new Error('must not send'); };
  assert.equal((await runShareFeaturePush({ db, automation: ON, send, quiet: true })).skippedReason, 'quiet_hours');
  assert.equal((await runShareFeaturePush({ db, automation: { ...ON, enabled: false }, send })).skippedReason, 'disabled');
  assert.equal((await runShareFeaturePush({ db, automation: { ...ON, free_tiers: [{ push: false }] }, send })).skippedReason, 'push_off');
});
