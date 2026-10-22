import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSavesMilestone, dueMilestone, SAVES_AUTOMATION_ID } from '../lib/automations/savesMilestone.js';

const ON = '2026-10-20T00:00:00Z';
const t = (day, h = 12) => `2026-10-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`;

test('the number reached = time of the Nth save; only numbers reached after the switch-on', () => {
  const since = Date.parse(ON);
  assert.deepEqual(dueMilestone([t(21), t(21), t(22)], [2, 5], since), { due: 2, total: 3 });
  assert.deepEqual(dueMilestone([t(1), t(2), t(22)], [2, 5], since), { due: 0, total: 3 });      // 2 reached before → nothing
  assert.deepEqual(dueMilestone([t(1), t(2), t(21), t(22), t(23)], [2, 5], since), { due: 5, total: 5 }); // 5 is new
  assert.deepEqual(dueMilestone([t(21), t(21), t(21), t(21), t(21), t(21)], [2, 5], since), { due: 5, total: 6 }); // jump → highest only
  assert.deepEqual(dueMilestone([], [2], since), { due: 0, total: 0 });
});

function fakeDb({ favorites = [], guests = [], listings, users }) {
  const log = [];
  return {
    log,
    select: async (table, q) => {
      if (table === 'properties') return listings;
      if (table === 'favorites') return favorites;
      if (table === 'guest_favorites') return guests;
      if (table === 'users') return users;
      return [];
    },
    insert: async (table, rows) => {
      const r = { id: `l${log.length + 1}`, ...rows[0] };
      if (log.some((x) => x.dedupe_key === r.dedupe_key)) { const e = new Error('dup'); e.code = '23505'; throw e; }
      log.push(r); return [r];
    },
    update: async (table, filter, patch) => { const id = (filter.match(/^id=eq\.(.+)$/) || [])[1]; for (const r of log) if (r.id === id) Object.assign(r, patch); },
    remove: async () => {},
  };
}

const tpl = { id: 't1', key: 'listing-saves', subject: '{{name}}, {{saves}} personas guardaron tu propiedad', heading: '', body: '{{property_title}}: {{property_url}}', button_label: 'Ver', button_url: '{{property_url}}', is_active: true };
const automation = { id: SAVES_AUTOMATION_ID, enabled: true, enabled_at: ON, milestones: [2, 5], template_id: 't1' };

test('emails the seller once per number, counting account + guest saves', async () => {
  const db = fakeDb({
    listings: [{ id: 'p1', created_by: 'u1', property_type: 'Casa', city: 'Luque' }, { id: 'p2', created_by: 'u1', property_type: 'Terreno', city: 'Limpio' }],
    favorites: [{ property_id: 'p1', created_at: t(21) }],
    guests: [{ property_id: 'p1', created_at: t(22) }, { property_id: 'p2', created_at: t(22) }],
    users: [{ id: 'u1', email: 'ana@x.com', full_name: 'Ana Paz' }],
  });
  const sent = [];
  const deliver = async (m) => { sent.push(m); return { ok: true, id: 'r' }; };
  const r1 = await runSavesMilestone({ db, automation, templates: [tpl], deliver, siteUrl: 'https://casa-libre.com.py' });
  assert.equal(r1.sent, 1);                                        // p1 reached 2 (1 account + 1 guest); p2 has 1
  assert.equal(sent[0].to, 'ana@x.com');
  assert.equal(sent[0].subject, 'Ana, 2 personas guardaron tu propiedad');
  assert.match(sent[0].html, /casa-libre\.com\.py\/propiedad\/p1/);
  assert.equal(db.log[0].dedupe_key, 'saves:p1:2');
  const r2 = await runSavesMilestone({ db, automation, templates: [tpl], deliver, siteUrl: 'https://casa-libre.com.py' });
  assert.equal(r2.sent, 0);                                        // never twice
  assert.equal(r2.duplicate, 1);
});

test('off, no numbers or no template: nothing is sent', async () => {
  const db = fakeDb({ listings: [], users: [] });
  const deliver = async () => ({ ok: true });
  assert.equal((await runSavesMilestone({ db, automation: { ...automation, enabled: false }, templates: [tpl], deliver })).skippedReason, 'disabled');
  assert.equal((await runSavesMilestone({ db, automation: { ...automation, milestones: [] }, templates: [tpl], deliver })).skippedReason, 'no_milestones');
  assert.equal((await runSavesMilestone({ db, automation, templates: [], deliver })).skippedReason, 'no_template');
});
