import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import { runDuplicateListings, DUPLICATES_AUTOMATION_ID, fingerprint, findDuplicateSets, setKey } from '../lib/automations/duplicateListings.js';
import { renderTemplate } from '../lib/emailTemplateRender.js';

const T0 = Date.parse('2026-10-10T12:00:00Z');   // automation switched on
const iso = (ms) => new Date(ms).toISOString();
const SITE = 'https://casa-libre.com.py';
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const TPL = {
  id: 'tpl-dup', key: 'duplicate-listing', subject: 'Publicaste la misma propiedad más de una vez', heading: 'Notamos una publicación repetida',
  body: 'Hola {{name}},\n\nNotamos que publicaste **{{property_title}}** {{listing_count}} veces:\n\n{{listing_links}}',
  button_label: 'Ir a Mis publicaciones', button_url: '{{my_listings_url}}', is_active: true,
};
const base = { listing_type: 'sale', property_type: 'casa', price: 120000, currency: 'USD', neighborhood: 'Villa Morra', city: 'Asunción', covered_area: 180, bedrooms: 3, bathrooms: 2, contact_phone: '+595 981 111111', description: 'Linda casa', origin: 'user' };
const P = (id, owner, atMs, extra = {}) => ({ id, created_by: owner, created_at: iso(atMs), ...base, ...extra });

function setup({ enabled = true, listings = [] } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [TPL]);
  db.seed('automations', [{ id: DUPLICATES_AUTOMATION_ID, enabled, enabled_at: iso(T0), template_id: TPL.id }]);
  db.seed('users', [
    { id: U1, email: 'ana@x.com', full_name: 'Ana Pérez', active: true },
    { id: U2, email: 'bo@x.com', full_name: 'Bo Ruiz', active: true, blocked: true },
  ]);
  db.seed('properties', listings);
  const sent = [];
  const run = async () => {
    const [automation] = await db.select('automations', `id=eq.${DUPLICATES_AUTOMATION_ID}`);
    const templates = await db.select('email_templates', '');
    return runDuplicateListings({ db, automation, templates, deliver: async (m) => { sent.push(m); return { ok: true, id: `re_${sent.length}` }; }, frame: { brand: 'Casa Libre' }, siteUrl: SITE });
  };
  return { db, sent, run };
}

test('fingerprint ignores case, spaces and number formats, but not a real difference', () => {
  assert.equal(fingerprint({ ...base, city: ' asunción ', price: '120000' }), fingerprint(base));
  assert.notEqual(fingerprint({ ...base, price: 125000 }), fingerprint(base));
  assert.notEqual(fingerprint({ ...base, bedrooms: 4 }), fingerprint(base));
});

test('findDuplicateSets: same owner + same data only', () => {
  const sets = findDuplicateSets([P('a', U1, T0), P('b', U1, T0 + 1000), P('c', U1, T0, { price: 1 }), P('d', U2, T0)]);
  assert.equal(sets.length, 1);
  assert.deepEqual(sets[0].ids, ['a', 'b']);
});

test('emails the owner once per set, with a link to each copy and My listings', async () => {
  const s = setup({ listings: [P('a', U1, T0 - 86400e3), P('b', U1, T0 + 3600e3)] });
  const r = await s.run();
  assert.equal(r.sent, 1);
  assert.equal(s.sent[0].to, 'ana@x.com');
  assert.match(s.sent[0].html, /propiedad\/a/);
  assert.match(s.sent[0].html, /propiedad\/b/);
  assert.match(s.sent[0].html, /cuenta\/publicaciones/);
  assert.equal((await s.run()).sent, 0);                       // never twice
  const [log] = await s.db.select('email_log', '');
  assert.equal(log.dedupe_key, setKey(['a', 'b']));
});

test('a third copy is a new set → one more email', async () => {
  const s = setup({ listings: [P('a', U1, T0 + 1), P('b', U1, T0 + 2)] });
  await s.run();
  s.db.seed('properties', [P('c', U1, T0 + 3)]);
  assert.equal((await s.run()).sent, 1);
});

test('old duplicates (before it was switched on), blocked accounts and a disabled automation send nothing', async () => {
  assert.equal((await setup({ listings: [P('a', U1, T0 - 2), P('b', U1, T0 - 1)] }).run()).sent, 0);
  assert.equal((await setup({ listings: [P('a', U2, T0 + 1), P('b', U2, T0 + 2)] }).run()).skipped, 1);
  assert.equal((await setup({ enabled: false, listings: [P('a', U1, T0 + 1), P('b', U1, T0 + 2)] }).run()).skippedReason, 'disabled');
});

test('the links render as real links in the email', () => {
  const m = renderTemplate(TPL, { name: 'Ana', property_title: 'Casa', listing_count: '2', listing_links: `[Publicación 1](${SITE}/propiedad/a)\n[Publicación 2](${SITE}/propiedad/b)`, my_listings_url: `${SITE}/cuenta/publicaciones` }, {});
  assert.match(m.html, /<a href="https:\/\/casa-libre\.com\.py\/propiedad\/a"/);
  assert.match(m.html, /href="https:\/\/casa-libre\.com\.py\/cuenta\/publicaciones"/);
});
