import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import {
  runNewsletter, newsletterConfig, localParts, isoWeek, missingVars, pickIssue, planRun, audienceMatch, pickRecipients, userTypeOf,
  NEWSLETTER_ID,
} from '../lib/automations/newsletter.js';
import { insightVars, roundDown, viewMedian, joinEs } from '../lib/newsletter/insightsCore.js';
import { ISSUES, NEWSLETTER_TEMPLATES, PROFILE_TEMPLATES, STORIES, ILLUSTRATIVE_NOTE } from '../lib/newsletter/content.js';
import { renderTemplate, templateVars, splitPreheader } from '../lib/emailTemplateRender.js';

const SITE = 'https://casa-libre.com.py';
// Tuesday 2026-11-24 13:00 UTC = 10:00 in Asunción (UTC-3)
const TUE_10 = new Date('2026-11-24T13:00:00Z');

// ── content ───────────────────────────────────────────────────────────────────
test('content: 9 issues, unique keys, every variable known to the editor, button + newsletter link in each', () => {
  assert.ok(ISSUES.length >= 6 && ISSUES.length <= 10);
  assert.equal(new Set(NEWSLETTER_TEMPLATES.map((t) => t.key)).size, ISSUES.length);
  const known = new Set(templateVars.map((v) => v.key));
  for (const t of [...NEWSLETTER_TEMPLATES, ...PROFILE_TEMPLATES]) {
    for (const f of ['subject', 'heading', 'body', 'button_label', 'button_url']) {
      for (const m of String(t[f] || '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)) assert.ok(known.has(m[1]), `${t.key}: unknown {{${m[1]}}}`);
    }
    assert.ok(t.button_label && t.button_url, `${t.key}: button`);
    assert.ok(splitPreheader(t.body).preheader, `${t.key}: preheader`);
  }
  for (const t of NEWSLETTER_TEMPLATES) assert.match(t.body, /\{\{(newsletter_url|stories_url)\}\}/, `${t.key}: link to the newsletter page`);
});

test('content: banned claims and opt-out lines never appear; brand written Casa-Libre', () => {
  const all = JSON.stringify([ISSUES, STORIES, PROFILE_TEMPLATES]);
  for (const bad of [/mayor crecimiento/i, /gratis para siempre/i, /\bla mejor\b/i, /\bBAJA\b/, /unsubscribe/i, /darte de baja/i, /Casa Libre/]) assert.doesNotMatch(all, bad);
});

test('content: the illustrative line is off (user, Nov 22) and leaves no empty paragraph', () => {
  assert.equal(ILLUSTRATIVE_NOTE.es, '');
  for (const t of NEWSLETTER_TEMPLATES) assert.ok(!/\n\n\n\n/.test(t.body) && !/Historias ilustrativas/.test(t.body), t.key);
});

test('render: preheader hidden, stats, section titles, extra buttons, divider', () => {
  const tpl = { subject: 'S', heading: 'H', body: '>> Vista previa {{name}}\n\nHola\n\n!! 57 % | de las **visitas**\n\n## Título\n\n[[Ver más]]({{stories_url}})\n\n---', button_label: 'Publicar', button_url: '{{publish_url}}' };
  const m = renderTemplate(tpl, { name: 'Ana', stories_url: `${SITE}/newsletter#historias`, publish_url: `${SITE}/publicar` }, {});
  assert.match(m.html, /display:none[^>]*>Vista previa Ana/);
  assert.match(m.html, /57 %<\/div><div[^>]*>de las <strong>visitas<\/strong>/);
  assert.match(m.html, />Título<\/div>/);
  assert.match(m.html, /href="https:\/\/casa-libre\.com\.py\/newsletter#historias"[^>]*>Ver más<\/a>/);
  assert.ok(!m.html.includes('&gt;&gt;'));
  assert.ok(!m.text.includes('>>') && !m.text.includes('##') && !m.text.includes('[['));
  assert.match(m.text, /Ver más: https:\/\/casa-libre\.com\.py\/newsletter#historias/);
  assert.match(m.text, /57 % — de las visitas/);
});

// ── insights ──────────────────────────────────────────────────────────────────
const L = (views, extra) => ({ views, price_usd: 0, listing_type: 'sale', city: 'Asunción', property_type: 'Casa', origin: 'scraped', photos: 3, ...extra });

test('insights: rounded down, honest ratios only with enough data', () => {
  assert.equal(roundDown(7619), '7.600');
  assert.equal(roundDown(2590), '2.500');
  assert.equal(roundDown(97), '97');
  assert.equal(joinEs(['A', 'B', 'C']), 'A, B y C');
  const listings = [
    ...Array.from({ length: 12 }, (_, i) => L(12, { origin: 'user', price_usd: 50000 + i, city: ['Asunción', 'Luque', 'Encarnación'][i % 3] })),
    ...Array.from({ length: 12 }, () => L(5, { price_usd: 150000 })),
    ...Array.from({ length: 12 }, () => L(1, { photos: 0, price_usd: 90000 })),
    ...Array.from({ length: 10 }, () => L(6, { listing_type: 'rent', price_usd: 500, property_type: 'Departamento' })),
  ];
  const v = insightVars({ totals: [7619, 2590], listings, searches: { rent: 13214, sale: 7522 }, queries: [['ciudad del este', 406], ['luque', 281], ['asunción', 248], ['asuncion', 196]], activeListings: 3757 });
  assert.equal(v.nl_views_30d, '7.600');
  assert.equal(v.nl_people_30d, '2.500');
  assert.equal(v.active_listings, '3.700');
  assert.equal(v.nl_top_searches, 'Asunción, Ciudad del Este y Luque');   // 'asunción' + 'asuncion' merged
  assert.equal(v.nl_rent_band, 'US$400 a US$700');
  assert.equal(v.nl_rent_band_pct, '100');
  assert.equal(v.nl_rent_searches, '13.200');
  assert.equal(v.nl_sale_searches, '7.500');
  assert.equal(v.nl_direct_ratio, '3');   // 12 avg vs (5*12+1*12+6*10)/34
  assert.ok(Number(v.nl_photo_ratio) >= 2);
  assert.match(v.nl_top_types, /^casas \(\d+ %\) y departamentos \(\d+ %\)$/);
  assert.equal(v.nl_sale_under_100k_pct, String(Math.floor((144 + 12) / (144 + 60 + 12) * 100)));
});

test('insights: too little data → the number is left out (never invented)', () => {
  const v = insightVars({ totals: [0, 0], listings: [L(3, { origin: 'user' }), L(1)], searches: { rent: 5, sale: 2 }, queries: [] });
  for (const k of ['nl_views_30d', 'nl_direct_ratio', 'nl_photo_ratio', 'nl_sale_median', 'nl_rent_band', 'nl_rent_searches', 'nl_top_searches', 'nl_top_cities']) assert.equal(v[k], undefined, k);
  assert.equal(viewMedian([{ views: 1, price_usd: 10 }, { views: 3, price_usd: 20 }]), 20);
});

// ── schedule + rotation ──────────────────────────────────────────────────────
test('schedule: local weekday/hour per country, ISO week', () => {
  assert.deepEqual(localParts(TUE_10, 'py'), { weekday: 2, hour: 10, date: '2026-11-24' });
  assert.equal(isoWeek('2026-11-24'), '2026-W48');
  assert.equal(isoWeek('2027-01-01'), '2026-W53');
  const cfg = newsletterConfig({ enabled: true, enabled_at: 'x', free_tiers: [{ day: 2, hour: 10, rotation: [{ template_id: 'a' }] }] });
  assert.equal(planRun(cfg, TUE_10, 'py').action, 'start');
  assert.equal(planRun(cfg, new Date('2026-11-24T12:00:00Z'), 'py').action, 'wait');   // 09:00 local
  assert.equal(planRun(cfg, new Date('2026-11-25T13:00:00Z'), 'py').action, 'wait');   // Wednesday
  assert.equal(planRun({ ...cfg, issue: { week: '2026-W48' } }, new Date('2026-11-26T13:00:00Z'), 'py').action, 'continue');
  assert.equal(planRun({ ...cfg, issue: { week: '2026-W48', done: true } }, TUE_10, 'py').action, 'done');
});

test('rotation: next template; one without its measured numbers or switched off is passed over', () => {
  const templates = [{ id: 'a', body: '{{nl_photo_ratio}}' }, { id: 'b', body: 'hola', is_active: false }, { id: 'c', body: '{{nl_views_30d}}' }];
  const rotation = ['a', 'b', 'c'].map((template_id) => ({ template_id, audience: 'everyone' }));
  assert.deepEqual(missingVars(templates[0], {}), ['nl_photo_ratio']);
  const p = pickIssue({ rotation, start: 0, templates, vars: { nl_views_30d: '7.600' } });
  assert.equal(p.template.id, 'c');
  assert.deepEqual(p.skipped.map((s) => s.reason), ['no_numbers', 'off']);
  assert.equal(pickIssue({ rotation, start: 0, templates, vars: { nl_photo_ratio: '3' } }).template.id, 'a');
  assert.equal(pickIssue({ rotation, start: 2, templates, vars: {} }), null);
});

// ── audience ─────────────────────────────────────────────────────────────────
test('audience: user_type wins when set; otherwise listing history decides', () => {
  const u = (extra) => ({ id: 'u', verified: true, active: true, email: 'u@x.com', ...extra });
  assert.equal(userTypeOf(u({ user_type: 'buyer' })), 'buyer');
  assert.equal(userTypeOf(u({ user_type: 'other' })), null);
  assert.equal(audienceMatch(u({}), 'sellers', { hasListing: true }), true);
  assert.equal(audienceMatch(u({}), 'sellers', { hasListing: false }), false);
  assert.equal(audienceMatch(u({ user_type: 'seller' }), 'sellers', { hasListing: false }), true);
  assert.equal(audienceMatch(u({}), 'buyers', { hasListing: false }), true);
  assert.equal(audienceMatch(u({ user_type: 'seller' }), 'buyers', { hasListing: false }), false);
  assert.equal(audienceMatch(u({}), 'never_listed', { hasListing: false }), true);
  assert.equal(audienceMatch(u({ user_type: 'buyer' }), 'never_listed', { hasListing: false }), false);
  assert.equal(audienceMatch(u({}), 'never_listed', { hasListing: true }), false);
  const users = [u({ id: '1' }), u({ id: '2', verified: false }), u({ id: '3', blocked: true }), u({ id: '4' }), u({ id: '5' })];
  assert.deepEqual(pickRecipients({ users, stopped: new Set(['4']), sent: new Set(['5']) }).map((x) => x.id), ['1']);
});

// ── run ──────────────────────────────────────────────────────────────────────
function setup({ settings = {}, users = [], listings = [] } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [
    { id: 't1', key: 'newsletter-a', name: 'A', subject: 'Hola {{name}}', heading: 'H', body: '>> pre\n\n!! {{nl_views_30d}} | visitas\n\n[[Leer]]({{newsletter_url}})', button_label: 'Publicar', button_url: '{{publish_url}}' },
    { id: 't2', key: 'newsletter-b', name: 'B', subject: 'Fotos', heading: 'H', body: '{{nl_photo_ratio}} veces', button_label: 'Perfil', button_url: '{{settings_url}}' },
    { id: 't3', key: 'newsletter-c', name: 'C', subject: 'Historia', heading: 'H', body: 'sin números', button_label: 'Publicar', button_url: '{{publish_url}}' },
  ]);
  db.seed('automations', [{ id: NEWSLETTER_ID, enabled: true, enabled_at: '2026-11-01T00:00:00Z', free_tiers: [{ day: 2, hour: 10, next: 0, rotation: [{ template_id: 't1', audience: 'everyone' }, { template_id: 't2', audience: 'sellers' }, { template_id: 't3', audience: 'never_listed' }], ...settings }] }]);
  db.seed('users', users);
  db.seed('properties', listings);
  const sent = [];
  const run = async (at = TUE_10, extra = {}) => {
    const [a] = await db.select('automations', `id=eq.${NEWSLETTER_ID}`);
    return runNewsletter({
      db, automation: a, templates: await db.select('email_templates', ''), now: at,
      deliver: async (m) => { sent.push(m); return { ok: true, id: `re_${sent.length}` }; },
      frame: { brand: 'Casa-Libre', tld: '.py', countryName: 'Paraguay' }, siteUrl: SITE, countryCode: 'py', countryName: 'Paraguay',
      insights: async () => ({ vars: { nl_views_30d: '7.600' } }), ...extra,
    });
  };
  return { db, sent, run };
}
const U = (id, extra = {}) => ({ id, email: `${id}@x.com`, first_name: id.toUpperCase(), verified: true, active: true, created_at: '2026-10-01T00:00:00Z', ...extra });

test('run: sends the week’s issue once per person, then rotates the next week (skipping one without numbers)', async () => {
  const s = setup({ users: [U('ana'), U('beto'), U('caro', { verified: false })], listings: [{ id: 'p1', created_by: 'beto', origin: 'user' }] });
  assert.equal((await s.run(new Date('2026-11-24T11:00:00Z'))).skippedReason, 'not_today');   // 08:00 local
  const r1 = await s.run();
  assert.equal(r1.sent, 2);
  assert.match(s.sent[0].subject, /^Hola (ANA|BETO)$/);
  assert.match(s.sent[0].html, /7\.600/);
  assert.match(s.sent[0].html, /href="https:\/\/casa-libre\.com\.py\/newsletter/);
  const again = await s.run(new Date('2026-11-24T15:00:00Z'));
  assert.equal(again.skippedReason, 'week_done');
  assert.equal(s.sent.length, 2);
  // next Tuesday: t2 needs nl_photo_ratio (not measured) → passed over; t3 to never-listed (ana only)
  const r2 = await s.run(new Date('2026-12-01T13:00:00Z'));
  assert.equal(r2.started.template_id, 't3');
  assert.equal(r2.sent, 1);
  assert.equal(s.sent[2].subject, 'Historia');
  const [row] = await s.db.select('automations', `id=eq.${NEWSLETTER_ID}`);
  assert.equal(row.free_tiers[0].next, 0);
  assert.equal(row.free_tiers[0].issue.week, '2026-W49');
});

test('run: off → nothing; night → deferred and the week stays open; override sends to the test address', async () => {
  const off = setup({ users: [U('ana')] });
  await off.db.update('automations', `id=eq.${NEWSLETTER_ID}`, { enabled: false });
  assert.equal((await off.run()).skippedReason, 'disabled');
  const s = setup({ users: [U('ana'), U('beto')] });
  const night = await s.run(TUE_10, { frame: { quiet: true } });
  assert.equal(night.sent, 0);
  assert.equal(s.sent.length, 0);
  const [row] = await s.db.select('automations', `id=eq.${NEWSLETTER_ID}`);
  assert.equal(row.free_tiers[0].issue.done, false);
  const day = await s.run(new Date('2026-11-24T14:00:00Z'), { emailOverride: 'omar@airosofts.com' });
  assert.equal(day.sent, 2);
  assert.ok(s.sent.every((m) => m.to === 'omar@airosofts.com'));
});

// ── /newsletter page ─────────────────────────────────────────────────────────
import { pageIssues, blocksOf } from '../lib/newsletter/page.js';

test('page: issues without their measured numbers are hidden; greeting / preheader / self-link dropped', () => {
  const none = pageIssues({ country_name: 'Paraguay' }, 'es');
  assert.deepEqual(none.map((i) => i.slug), ['historia-comision', 'historia-inmobiliaria']);   // the story issues need no number
  const all = { country_name: 'Paraguay', nl_views_30d: '7.600', nl_people_30d: '2.500', nl_top_cities: 'A, B y C', nl_top_searches: 'A, B y C', nl_top_types: 'casas (41 %) y departamentos (40 %)', nl_sale_median: 'US$84.000', nl_sale_under_100k_pct: '57', nl_rent_band: 'US$400 a US$700', nl_rent_band_pct: '35', nl_rent_searches: '13.200', nl_sale_searches: '7.500', nl_direct_ratio: '2', nl_photo_ratio: '3', active_listings: '3.700', newsletter_url: '/newsletter', stories_url: '/newsletter#historias', publish_url: '/publicar', search_url: '/propiedades', app_url: '/descargar', settings_url: '/cuenta/ajustes' };
  for (const lang of ['es', 'en']) {
    const list = pageIssues(all, lang);
    assert.equal(list.length, ISSUES.length);
    for (const i of list) {
      assert.doesNotMatch(JSON.stringify(i), /\{\{\s*[a-z_]+\s*\}\}/, i.slug);
      assert.ok(i.blocks.every((b) => !(b.type === 'p' && /^Hola/.test(b.text))), `${i.slug}: greeting`);
      assert.ok(i.blocks.every((b) => b.type !== 'button' || !b.href.startsWith('/newsletter')), `${i.slug}: self-link`);
    }
  }
  const t = pageIssues(all, 'es').find((i) => i.slug === 'tu-cuenta-esta-lista');
  assert.equal(t.title, 'Tu cuenta está lista: falta tu primera propiedad');
  assert.equal(pageIssues(all, 'es').find((i) => i.slug === 'alquileres').story.slug, 'lorena-alquiler');
  assert.ok(!pageIssues(all, 'es').find((i) => i.slug === 'alquileres').blocks.some((b) => /El desafío/.test(b.text || '')));
  assert.deepEqual(blocksOf('>> x\n\n## T\n\n!! 5 | y\n\n[[Ir]](/publicar)', {}).map((b) => b.type), ['h', 'stat', 'button']);
});
