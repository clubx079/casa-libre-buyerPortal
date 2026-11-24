// The weekly generated newsletter editions on the website: merged with the hand-made ones, shown by
// the page, and used by that week's email (lib/newsletter/editions.js, lib/newsletter/page.js,
// lib/automations/newsletter.js). The generator itself (validation, dedupe, ISO week) is tested in
// the admin (test/newsletterEdition.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import { EDITIONS, mergeEditions, storedToEdition, editionNav, editionHref, editionByDate, latestEdition, editionOfWeek } from '../lib/newsletter/editions.js';
import { pageIssues } from '../lib/newsletter/page.js';
import { runNewsletter, editionTemplate, pickEditionIssue, NEWSLETTER_ID } from '../lib/automations/newsletter.js';
import { renderTemplate } from '../lib/emailTemplateRender.js';

const SITE = 'https://casa-libre.com.py';
const L = (es, en = es) => ({ es, en });
const STORY = (slug, name) => ({
  slug, metric: L('Vendida en 20 días', 'Sold in 20 days'), when: L('en Lambaré', 'in Lambaré'), who: L(`${name} · dueña de una casa`, `${name} · house owner`),
  title: L(`${name} vendió su casa en Lambaré`, `${name} sold her house in Lambaré`), challenge: L('Sin consultas.', 'No enquiries.'),
  did: L('Fotos de día y el precio a la vista.', 'Daylight photos and the price in plain sight.'), result: L('15 consultas y una oferta.', '15 enquiries and an offer.'),
  quote: L('Me escribían sabiendo el precio.', 'They wrote knowing the price.'),
});
const ISSUE = (slug, extra = {}) => ({
  slug, cat: 'data', audience: 'everyone', name: 'Newsletter — X', subject: 'Qué miran los compradores en {{country_name}}', heading: 'Lo que se mira',
  body: ['>> Lo más visto.', 'Hola {{name}}, esto miraron.', '!! {{nl_views_30d}} visitas | a publicaciones en Casa-Libre.', '## Qué hacer', 'Publicá con fotos de día.', '[[Publicar mi propiedad]]({{publish_url}})', `[[Leer el newsletter completo]]({{newsletter_url}}#${slug})`],
  button_label: 'Publicar mi propiedad', button_url: '{{publish_url}}',
  en: { subject: 'What buyers in {{country_name}} look at', heading: 'What people look at', body: ['!! {{nl_views_30d}} views | of listings on Casa-Libre.', 'List with daylight photos.'] },
  ...extra,
});
const ROW = (date, week, extra = {}) => ({
  id: `e-${date}`, week, date, status: 'published',
  issues: [ISSUE('lo-mas-visto'), ISSUE('historia-nadia', { cat: 'story', story: 'nadia-casa-lambare', body: [...ISSUE('x').body.slice(0, 5), '[[Ver más historias]]({{stories_url}})', '[[Leer el newsletter completo]]({{newsletter_url}}#historia-nadia)'] })],
  stories: [STORY('nadia-casa-lambare', 'Nadia'), STORY('bruno-depto-asuncion', 'Bruno')],
  ...extra,
});

test('editions: stored ones merge with the hand-made ones, newest first; incomplete rows never show', () => {
  const list = mergeEditions([ROW('2026-12-01', '2026-W49'), { ...ROW('2026-12-08', '2026-W50'), status: 'failed' }, { ...ROW('2026-12-15', '2026-W51'), stories: [] }, { status: 'published', date: 'bad' }]);
  assert.equal(list.length, EDITIONS.length + 1);
  assert.equal(list[0].date, '2026-12-01');
  assert.equal(list[0].stored, true);
  assert.equal(list[1].date, EDITIONS[0].date);
  assert.deepEqual(mergeEditions([]).map((e) => e.date), EDITIONS.map((e) => e.date));
  assert.equal(storedToEdition({ ...ROW('2026-12-01', 'W'), status: 'generating' }), null);
  // same date: the stored edition wins
  assert.equal(mergeEditions([ROW(EDITIONS[0].date, '2026-W47')])[0].stored, true);
  assert.equal(editionOfWeek('2026-W49', list).date, '2026-12-01');
  assert.equal(editionOfWeek('2026-W50', list), null);
});

test('editions: navigation, numbers and links follow the merged list', () => {
  const list = mergeEditions([ROW('2026-12-08', '2026-W50'), ROW('2026-12-01', '2026-W49')]);
  assert.equal(latestEdition(list).date, '2026-12-08');
  assert.equal(editionHref(list[0], list), '/newsletter');
  assert.equal(editionHref(list[1], list), '/newsletter/2026-12-01');
  const nav = editionNav('2026-12-01', list);
  assert.equal(nav.newer.date, '2026-12-08');
  assert.equal(nav.older.date, EDITIONS[0].date);
  assert.equal(nav.number, EDITIONS.length + 1);
  assert.equal(editionByDate('2026-12-01', list).week, '2026-W49');
  // the hand-made list alone still works as before
  assert.equal(editionHref(EDITIONS[0]), '/newsletter');
  assert.equal(editionNav(EDITIONS[0].date).number, EDITIONS.length);
});

test('page: a stored edition renders like the hand-made ones (story card, buttons, numbers filled)', () => {
  const e = storedToEdition(ROW('2026-12-01', '2026-W49'));
  const vars = { nl_views_30d: '7.600', country_name: 'Paraguay', publish_url: '/publicar', newsletter_url: '/newsletter', stories_url: '/newsletter#historias' };
  const es = pageIssues(vars, 'es', e.issues, e.stories);
  assert.equal(es.length, 2);
  assert.equal(es[0].title, 'Qué miran los compradores en Paraguay');
  assert.equal(es[0].cat, 'data');
  assert.deepEqual(es[0].blocks.map((b) => b.type), ['stat', 'h', 'p', 'button']);   // no preheader, greeting or link back
  assert.equal(es[0].blocks[0].value, '7.600 visitas');
  assert.equal(es[1].story.slug, 'nadia-casa-lambare');
  const en = pageIssues(vars, 'en', e.issues, e.stories);
  assert.equal(en[0].title, 'What buyers in Paraguay look at');
  // a number not measured → the issue is left out, never shown with a gap
  assert.equal(pageIssues({ country_name: 'Paraguay' }, 'es', e.issues, e.stories).length, 0);
  // hand-made editions still by slug
  assert.ok(pageIssues({ nl_top_searches: 'A, B y C', nl_top_types: 'casas (40 %) y departamentos (30 %)' }, 'es', ['zonas-mas-buscadas']).length === 1);
});

test('email: the edition issue becomes a template with its story, and the first one with its numbers goes', () => {
  const e = storedToEdition(ROW('2026-12-01', '2026-W49'));
  const t = editionTemplate(e, 'historia-nadia');
  assert.equal(t.key, 'newsletter-2026-12-01-historia-nadia');
  assert.equal(t.id, null);
  assert.match(t.body, /## Nadia vendió su casa en Lambaré[\s\S]*\*\*El desafío:\*\*[\s\S]*\[\[Ver más historias\]\]/);
  assert.ok(t.body.indexOf('Nadia vendió') < t.body.indexOf('[[Ver más historias]]'));
  assert.equal(editionTemplate(e, 'nope'), null);
  assert.equal(pickEditionIssue(e, { nl_views_30d: '7.600' }).slug, 'lo-mas-visto');
  assert.equal(pickEditionIssue(e, {}), null);
  const m = renderTemplate(t, { name: 'Ana', nl_views_30d: '7.600', stories_url: `${SITE}/newsletter/2026-12-01#historias`, newsletter_url: `${SITE}/newsletter/2026-12-01`, publish_url: `${SITE}/publicar`, country_name: 'Paraguay' }, { utm: { campaign: NEWSLETTER_ID, content: t.key } });
  assert.match(m.html, /newsletter\/2026-12-01\?utm_source=email&amp;utm_medium=automation&amp;utm_campaign=weekly_newsletter&amp;utm_content=newsletter-2026-12-01-historia-nadia#historia-nadia/);
});

// ── the weekly email with an edition ─────────────────────────────────────────
function setup({ settings = {}, users = [] } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [{ id: 't1', key: 'newsletter-a', name: 'A', subject: 'Rotación {{name}}', heading: 'H', body: '>> pre\n\n!! {{nl_views_30d}} | visitas\n\n[[Leer]]({{newsletter_url}})', button_label: 'Publicar', button_url: '{{publish_url}}' }]);
  db.seed('automations', [{ id: NEWSLETTER_ID, enabled: true, enabled_at: '2026-11-01T00:00:00Z', free_tiers: [{ day: 2, hour: 10, next: 0, rotation: [{ template_id: 't1', audience: 'everyone' }], ...settings }] }]);
  db.seed('users', users);
  db.seed('properties', []);
  const sent = [];
  const run = async (at, extra = {}) => {
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
const U = (id) => ({ id, email: `${id}@x.com`, first_name: id.toUpperCase(), verified: true, active: true, created_at: '2026-10-01T00:00:00Z' });
const TUE_10 = new Date('2026-12-01T13:00:00Z');   // Tuesday 10:00 Asunción, ISO week 2026-W49

test('run: this week’s edition is the email (to everyone), linked to its page, tracked; once per person', async () => {
  const s = setup({ settings: { autogen: true }, users: [U('ana'), U('beto')] });
  const edition = storedToEdition(ROW('2026-12-01', '2026-W49'));
  const r = await s.run(TUE_10, { edition });
  assert.equal(r.sent, 2);
  assert.deepEqual(r.started, { edition: '2026-12-01', issue: 'lo-mas-visto', audience: 'everyone' });
  assert.equal(s.sent[0].subject, 'Qué miran los compradores en Paraguay');
  assert.match(s.sent[0].html, /href="https:\/\/casa-libre\.com\.py\/newsletter\/2026-12-01\?utm_source=email&amp;utm_medium=automation&amp;utm_campaign=weekly_newsletter&amp;utm_content=newsletter-2026-12-01-lo-mas-visto#lo-mas-visto"/);
  const logs = await s.db.select('email_log', '');
  assert.equal(logs.length, 2);
  assert.ok(logs.every((l) => l.automation_id === NEWSLETTER_ID && l.template_key === 'newsletter-2026-12-01-lo-mas-visto' && /^weekly-newsletter:2026-W49:/.test(l.dedupe_key)));
  const [row] = await s.db.select('automations', `id=eq.${NEWSLETTER_ID}`);
  assert.equal(row.free_tiers[0].issue.edition, '2026-12-01');
  assert.equal(row.free_tiers[0].issue.done, true);
  assert.equal(row.free_tiers[0].next, 0);   // the rotation didn't move
  assert.equal(row.free_tiers[0].autogen, true);
  assert.equal((await s.run(new Date('2026-12-01T16:00:00Z'), { edition })).skippedReason, 'week_done');
  assert.equal(s.sent.length, 2);
});

test('run: no edition this week, or auto-generate off → the rotation as before', async () => {
  const old = storedToEdition(ROW('2026-11-24', '2026-W48'));
  const a = setup({ settings: { autogen: true }, users: [U('ana')] });
  const r1 = await a.run(TUE_10, { edition: old });
  assert.equal(r1.started.template_id, 't1');
  assert.equal(a.sent[0].subject, 'Rotación ANA');
  assert.match(a.sent[0].html, /newsletter\?utm_source=email/);
  const b = setup({ users: [U('ana')] });
  const r2 = await b.run(TUE_10, { edition: storedToEdition(ROW('2026-12-01', '2026-W49')) });
  assert.equal(r2.started.template_id, 't1');
  // an edition whose numbers can't be measured this week → the rotation too
  const c = setup({ settings: { autogen: true }, users: [U('ana')] });
  const r3 = await c.run(TUE_10, { edition: storedToEdition(ROW('2026-12-01', '2026-W49')), insights: async () => ({ vars: { nl_views_30d: '7.600' } }) });
  assert.equal(r3.started.edition, '2026-12-01');
  const d = setup({ settings: { autogen: true, rotation: [{ template_id: 't1', audience: 'everyone' }] }, users: [U('ana')] });
  d.db.seed('email_templates', [{ id: 't9', key: 'newsletter-z', name: 'Z', subject: 'Sin números', heading: 'H', body: 'hola', button_label: 'P', button_url: '{{publish_url}}' }]);
  const r4 = await d.run(TUE_10, { edition: storedToEdition(ROW('2026-12-01', '2026-W49')), insights: async () => ({ vars: {} }) });
  assert.equal(r4.skippedReason, 'nothing_sendable');   // neither the edition nor t1 have their numbers
});
