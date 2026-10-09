import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import {
  runDraftReminders, DRAFTS_AUTOMATION_ID, dueStep, normalizeSteps, draftTitle, draftLocation, draftLink, draftPhoto, LATE_GRACE_HOURS,
} from '../lib/automations/draftReminders.js';
import { guestOwnerId } from '../lib/guestDrafts.js';

const H = 3600e3;
const T0 = Date.parse('2026-10-01T12:00:00Z');   // automation switched on
const iso = (ms) => new Date(ms).toISOString();
const SITE = 'https://casa-libre.com.py';

// The template seeded by migrations/013_draft_reminders.sql.
const TPL = {
  id: 'tpl-draft', key: 'draft-reminder', name: 'Borrador sin terminar — recordatorio',
  subject: 'Te falta poco para publicar tu propiedad', heading: 'Tu propiedad está casi lista',
  body: 'Hola {{name}},\n\nEmpezaste a publicar **{{property_title}}** en Casa Libre y quedó guardada como borrador. Lo que cargaste sigue ahí.\n\n![{{property_title}}]({{photo_url}})\n\nTe falta poco: tocá el botón y seguí justo donde lo dejaste. Publicar es gratis.',
  button_label: 'Continuar mi publicación', button_url: '{{draft_url}}', is_active: true,
};

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const D1 = 'd1d1d1d1-0000-4000-8000-000000000001';
const D2 = 'd2d2d2d2-0000-4000-8000-000000000002';
const D3 = 'd3d3d3d3-0000-4000-8000-000000000003';
const PHOTO = (owner, draft) => ({ key: `drafts/${owner}/${draft}/aaaaaaaa-0000-4000-8000-00000000000a.webp`, url: `/api/media/drafts/${owner}/${draft}/aaaaaaaa-0000-4000-8000-00000000000a.webp` });

function setup({ enabled = true, steps = [24, 72, 168], users = null } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [TPL]);
  db.seed('automations', [{ id: DRAFTS_AUTOMATION_ID, enabled, enabled_at: iso(T0), milestones: steps, template_id: TPL.id }]);
  db.seed('users', users || [
    { id: U1, email: 'ana@x.com', full_name: 'Ana Pérez', active: true },
    { id: U2, email: 'bo@x.com', full_name: 'Bo Ruiz', active: true },
  ]);
  const sent = [];
  let fail = false;
  const run = async (atMs, extra = {}) => {
    const [automation] = await db.select('automations', `id=eq.${DRAFTS_AUTOMATION_ID}`);
    const templates = await db.select('email_templates', '');
    return runDraftReminders({
      db, automation, templates, now: new Date(atMs),
      deliver: async (m) => { if (fail) return { ok: false, error: 'boom' }; sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
      frame: { brand: 'Casa Libre', tld: '.py', countryName: 'Paraguay' },
      siteUrl: SITE,
      ...extra,
    });
  };
  const draft = (id, owner, updatedMs, data = {}) => db.seed('listing_drafts', [{ id, user_id: owner, created_at: iso(updatedMs), updated_at: iso(updatedMs), data: { mode: 'venta', ptype: 'casa', neighborhood: 'Villa Morra', city: 'Asunción', ...data } }]);
  const touch = (id, atMs) => db.update('listing_drafts', `id=eq.${id}`, { updated_at: iso(atMs) });
  return { db, sent, run, draft, touch, setFail: (v) => { fail = v; } };
}

// ── pure helpers ──────────────────────────────────────────────────────────────

test('normalizeSteps: whole hours, 1 h – 60 days, unique, ascending, at most 5', () => {
  assert.deepEqual(normalizeSteps([168, '24', 72, 72, 0, -3, 1.5, 'x']), [24, 72, 168]);
  assert.deepEqual(normalizeSteps([1, 1440, 1441]), [1, 1440]);
  assert.deepEqual(normalizeSteps([1, 2, 3, 4, 5, 6, 7]), [1, 2, 3, 4, 5]);
  assert.deepEqual(normalizeSteps(null), []);
});

test('dueStep: the latest step whose time has come, after the last one sent', () => {
  const steps = [24, 72, 168];
  assert.equal(dueStep(23 * H, steps, 0), 0);
  assert.equal(dueStep(24 * H, steps, 0), 1);
  assert.equal(dueStep(30 * H, steps, 1), 0);        // step 1 already sent
  assert.equal(dueStep(72 * H, steps, 1), 2);
  assert.equal(dueStep(100 * H, steps, 0), 2);       // two due at once → only the latest
  assert.equal(dueStep(200 * H, steps, 3), 0);       // all sent
  assert.equal(dueStep(200 * H, steps, 5), 0);       // steps removed since → nothing
});

test('dueStep: hours work as well as days', () => {
  assert.equal(dueStep(59 * 60e3, [1, 6], 0), 0);
  assert.equal(dueStep(61 * 60e3, [1, 6], 0), 1);
  assert.equal(dueStep(6 * H, [1, 6], 1), 2);
});

test('dueStep: a step more than 7 days overdue is skipped (long-abandoned draft)', () => {
  assert.equal(dueStep((168 + LATE_GRACE_HOURS) * H, [24, 72, 168], 0), 3);
  assert.equal(dueStep((168 + LATE_GRACE_HOURS) * H + 1, [24, 72, 168], 0), 0);
  assert.equal(dueStep(30 * 24 * H, [24], 0), 0);
});

test('draft title, location, link and photo', () => {
  assert.equal(draftTitle({ ptype: 'casa', mode: 'venta', neighborhood: 'Villa Morra', city: 'Asunción' }), 'Casa en venta · Villa Morra, Asunción');
  assert.equal(draftTitle({ ptype: 'departamento', mode: 'alquiler', city: 'Luque' }), 'Departamento en alquiler · Luque');
  assert.equal(draftTitle({ neighborhood: 'Centro', city: 'centro' }), 'Centro');
  assert.equal(draftTitle({}), 'Tu propiedad');
  assert.equal(draftLocation({ neighborhood: 'Carmelitas', city: 'Asunción' }), 'Carmelitas, Asunción');
  assert.equal(draftLink('https://uy.casa-libre.com', D1), `https://uy.casa-libre.com/cuenta/publicaciones?tab=borradores&draft=${D1}`);
  assert.equal(draftPhoto({ photos: [PHOTO(U1, D1)] }, SITE), `${SITE}/api/media/drafts/${U1}/${D1}/aaaaaaaa-0000-4000-8000-00000000000a.webp`);
  assert.equal(draftPhoto({ photos: [{ key: 'junk', url: 'https://x/y.jpg' }] }, SITE), '');
  assert.equal(draftPhoto({}, SITE), '');
});

// ── the run ───────────────────────────────────────────────────────────────────

test('disabled, no steps or no template → does nothing', async () => {
  let s = setup({ enabled: false });
  s.draft(D1, U1, T0);
  assert.equal((await s.run(T0 + 30 * H)).skippedReason, 'disabled');
  s = setup({ steps: [] });
  s.draft(D1, U1, T0);
  assert.equal((await s.run(T0 + 30 * H)).skippedReason, 'no_steps');
  s = setup();
  await s.db.update('email_templates', `id=eq.${TPL.id}`, { is_active: false });
  s.draft(D1, U1, T0);
  assert.equal((await s.run(T0 + 30 * H)).skippedReason, 'no_template');
  assert.equal(s.sent.length, 0);
});

test('a signed-in draft gets each step once, at the right time, never twice', async () => {
  const s = setup();
  s.draft(D1, U1, T0);
  await s.run(T0 + 23 * H);
  assert.equal(s.sent.length, 0, 'not before 1 day');
  let r = await s.run(T0 + 25 * H);
  assert.equal(r.sent, 1);
  assert.equal(s.sent[0].to, 'ana@x.com');
  for (const h of [26, 30, 71]) await s.run(T0 + h * H);
  assert.equal(s.sent.length, 1, 'no repeat between steps');
  r = await s.run(T0 + 73 * H);
  assert.equal(r.sent, 1);
  await s.run(T0 + 74 * H);
  r = await s.run(T0 + 169 * H);
  assert.equal(r.sent, 1);
  for (const h of [170, 200, 300]) await s.run(T0 + h * H);
  assert.equal(s.sent.length, 3, 'three steps → three emails');
  const keys = (await s.db.select('email_log', `automation_id=eq.${DRAFTS_AUTOMATION_ID}&order=created_at.asc`)).map((l) => [l.dedupe_key, l.run_id, l.status]);
  assert.deepEqual(keys, [[`draft:${D1}:1`, D1, 'sent'], [`draft:${D1}:2`, D1, 'sent'], [`draft:${D1}:3`, D1, 'sent']]);
});

test('the email: subject, what they started, first photo and the button that opens THIS draft', async () => {
  const s = setup();
  s.draft(D1, U1, T0, { photos: [PHOTO(U1, D1)] });
  await s.run(T0 + 25 * H);
  const m = s.sent[0];
  assert.equal(m.subject, 'Te falta poco para publicar tu propiedad');
  assert.match(m.html, /Hola Ana,/);
  assert.match(m.html, /<strong>Casa en venta · Villa Morra, Asunción<\/strong>/);
  assert.match(m.html, new RegExp(`<img src="${SITE}/api/media/drafts/${U1}/${D1}/[^"]+\\.webp" alt="Casa en venta · Villa Morra, Asunción"`));
  assert.match(m.html, new RegExp(`<a href="${SITE.replace(/\./g, '\\.')}/cuenta/publicaciones\\?tab=borradores&amp;draft=${D1}"[^>]*>Continuar mi publicación</a>`));
  assert.match(m.text, new RegExp(`Continuar mi publicación: ${SITE}/cuenta/publicaciones\\?tab=borradores&draft=${D1}`));
  assert.ok(!m.text.includes('!['), 'no image markup in the text part');
});

test('no photo → no image, no empty paragraph', async () => {
  const s = setup();
  s.draft(D1, U1, T0);
  await s.run(T0 + 25 * H);
  assert.ok(!s.sent[0].html.includes('<img src="https://casa-libre'), 'no draft image');
  assert.ok(!/<p[^>]*>\s*<\/p>/.test(s.sent[0].html), 'no empty paragraph');
  assert.ok(!s.sent[0].html.includes('!['));
});

test('several steps due at once (switched on late) → ONE email, for the latest', async () => {
  const s = setup();
  s.draft(D1, U1, T0 - 100 * H);    // idle 4 days when the first run happens
  const r = await s.run(T0 + H);
  assert.equal(r.sent, 1);
  const [log] = await s.db.select('email_log', '');
  assert.equal(log.dedupe_key, `draft:${D1}:2`);
  await s.run(T0 + 2 * H);
  assert.equal(s.sent.length, 1, 'step 1 is not sent afterwards');
  await s.run(T0 - 100 * H + 169 * H);
  assert.equal(s.sent.length, 2, 'step 3 still comes on time');
});

test('drafts abandoned long ago get nothing when it is switched on', async () => {
  const s = setup();
  s.draft(D1, U1, T0 - 20 * 24 * H);
  const r = await s.run(T0 + H);
  assert.equal(r.sent, 0);
  assert.equal(s.sent.length, 0);
});

test('editing the draft pushes the next reminder back; sent ones are not repeated', async () => {
  const s = setup();
  s.draft(D1, U1, T0);
  await s.run(T0 + 25 * H);                 // step 1
  await s.touch(D1, T0 + 30 * H);           // they came back and changed something
  await s.run(T0 + 73 * H);                 // 43 h after the edit — too soon for step 2 (72 h)
  await s.run(T0 + 90 * H);
  assert.equal(s.sent.length, 1);
  const r = await s.run(T0 + 103 * H);      // 73 h after the edit
  assert.equal(r.sent, 1);
  const keys = (await s.db.select('email_log', 'order=created_at.asc')).map((l) => l.dedupe_key);
  assert.deepEqual(keys, [`draft:${D1}:1`, `draft:${D1}:2`]);
});

test('a published / deleted draft stops the sequence', async () => {
  const s = setup();
  s.draft(D1, U1, T0);
  await s.run(T0 + 25 * H);
  await s.db.remove('listing_drafts', `id=eq.${D1}`);   // /api/publish deletes it
  for (const h of [73, 169, 200]) await s.run(T0 + h * H);
  assert.equal(s.sent.length, 1);
});

test('guest drafts: emailed at the address typed in the wizard, with the contact name', async () => {
  const s = setup();
  const email = 'lucia@example.com';
  s.draft(D2, guestOwnerId(email), T0, { _guest_email: email, _guest_key: 'k', contact_name: 'Lucía Gómez' });
  // a guest draft whose stored email doesn't match its owner id is ignored
  s.draft(D3, guestOwnerId('other@example.com'), T0, { _guest_email: 'lucia2@example.com', _guest_key: 'k' });
  const r = await s.run(T0 + 25 * H);
  assert.equal(r.sent, 1);
  assert.equal(r.skipped, 1);
  assert.equal(s.sent[0].to, 'lucia@example.com');
  assert.match(s.sent[0].html, /Hola Lucía,/);
  assert.match(s.sent[0].html, new RegExp(`draft=${D2}`));
});

test('closed, blocked or suspended accounts and deleted addresses are skipped', async () => {
  const users = [
    { id: U1, email: 'ana@x.com', full_name: 'Ana', active: false },
    { id: U2, email: 'bo@x.com', full_name: 'Bo', blocked: true },
    { id: '33333333-3333-4333-8333-333333333333', email: 'cy@x.com', full_name: 'Cy', suspended: true },
    { id: '44444444-4444-4444-8444-444444444444', email: 'deleted-44@deleted.invalid', full_name: null, active: true },
    { id: '55555555-5555-4555-8555-555555555555', email: 'gone@x.com', full_name: 'Gone', active: false },
  ];
  const s = setup({ users });
  s.draft(D1, U1, T0);
  s.draft(D2, U2, T0);
  s.draft(D3, '33333333-3333-4333-8333-333333333333', T0);
  s.draft('d4d4d4d4-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', T0);
  // a guest draft for an email whose account was closed
  s.draft('d5d5d5d5-0000-4000-8000-000000000005', guestOwnerId('gone@x.com'), T0, { _guest_email: 'gone@x.com', _guest_key: 'k' });
  // a draft whose owner no longer exists at all
  s.draft('d6d6d6d6-0000-4000-8000-000000000006', '66666666-6666-4666-8666-666666666666', T0);
  const r = await s.run(T0 + 25 * H);
  assert.equal(r.sent, 0);
  assert.equal(r.skipped, 6);
  assert.equal(s.sent.length, 0);
});

test('one reminder per person per run — the next draft goes next hour', async () => {
  const s = setup();
  s.draft(D1, U1, T0);
  s.draft(D2, U1, T0 + 10 * 60e3);
  s.draft(D3, U2, T0);
  let r = await s.run(T0 + 25 * H);
  assert.equal(r.sent, 2);
  assert.deepEqual(s.sent.map((m) => m.to).sort(), ['ana@x.com', 'bo@x.com']);
  r = await s.run(T0 + 26 * H);
  assert.equal(r.sent, 1);
  assert.equal(s.sent[2].to, 'ana@x.com');
  r = await s.run(T0 + 27 * H);
  assert.equal(r.sent, 0);
});

test('a failed send is retried next run; the override inbox gets every email', async () => {
  const s = setup();
  s.draft(D1, U1, T0);
  s.setFail(true);
  let r = await s.run(T0 + 25 * H);
  assert.equal(r.failed, 1);
  assert.equal((await s.db.select('email_log', '')).length, 0, 'the claim is released');
  s.setFail(false);
  r = await s.run(T0 + 26 * H, { emailOverride: 'omar@airosofts.com' });
  assert.equal(r.sent, 1);
  assert.equal(s.sent[0].to, 'omar@airosofts.com');
});

test('a per-run limit caps how many emails one tick sends', async () => {
  const s = setup();
  s.draft(D1, U1, T0);
  s.draft(D3, U2, T0);
  const r = await s.run(T0 + 25 * H, { limit: 1 });
  assert.equal(r.sent, 1);
});
