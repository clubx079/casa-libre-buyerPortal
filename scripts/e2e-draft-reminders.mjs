// End-to-end: "unfinished draft reminders" — admin portal + buyer portal + headless
// Chrome, all against LOCAL stand-ins: no live database, and no email leaves the
// machine (fake Resend captures the exact HTML each person would get).
//
// Start (each in its own terminal):
//   node scripts/dev-postgrest.mjs 54331
//   node scripts/fake-resend.mjs 54332
//   buyer portal :3100 — COUNTRY=uy NEXT_PUBLIC_COUNTRY=uy AIROBASE_URL=http://localhost:54331
//     AIROBASE_SECRET_KEY=x SESSION_SECRET=e2e-buyer-secret CRON_SECRET=e2e-cron PUSH_AUTOMATIONS=off
//     RESEND_API_KEY=re_fake RESEND_BASE_URL=http://localhost:54332 GOOGLE_CLIENT_ID=e2e-client
//     REVIEW_LOGIN_EMAIL=lucia.e2e@example.com REVIEW_LOGIN_CODE=246810
//     (no APP_PUBLIC_URL: email links use the country's own site, https://uy.casa-libre.com)
//   admin portal :3110 — AIROBASE_URL and AIROBASE_URL_PY/_BO/_UY/_VE=http://localhost:54331
//     AIROBASE_SECRET_KEY(+_PY/_BO/_UY/_VE)=x SESSION_SECRET=e2e-admin-secret
//     RESEND_API_KEY=re_fake RESEND_BASE_URL=http://localhost:54332 ADMIN_TEST_EMAIL=omar@airosofts.com
// then: PLAYWRIGHT_DIR=<…/node_modules/playwright> node scripts/e2e-draft-reminders.mjs
// Time is simulated by moving the drafts' updated_at back (= the hours that passed).
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { guestOwnerId } from '../lib/guestDrafts.js';

const ADMIN = 'http://localhost:3110', BP = 'http://localhost:3100', DB = 'http://localhost:54331/rest/v1', MAIL = 'http://localhost:54332';
const SITE = 'https://uy.casa-libre.com';
const H = 3600e3;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const ago = (h) => new Date(Date.now() - h * H).toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const signed = (payload, secret) => { const p = b64(payload); return `${p}.${crypto.createHmac('sha256', secret).update(p).digest('base64url')}`; };

const adminCookie = `cl_admin_session=${signed({ id: 'e2e', email: 'omar@airosofts.com', name: 'E2E', role: 'superadmin', allowed_countries: null, exp: Date.now() + 3600e3 }, 'e2e-admin-secret')}; cl_admin_country=uy`;
const admin = (p, opts = {}) => fetch(ADMIN + p, { ...opts, headers: { 'Content-Type': 'application/json', cookie: adminCookie, ...(opts.headers || {}) } }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const db = (p, opts = {}) => fetch(`${DB}/${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) } }).then((r) => (r.status === 204 ? null : r.json()));
const cron = () => fetch(`${BP}/api/cron/automations?secret=e2e-cron`).then((r) => r.json());
const mails = () => fetch(`${MAIL}/captured`).then((r) => r.json());
const unesc = (s) => String(s || '').replace(/&amp;/g, '&');

const ANA = 'aaaaaaaa-0000-4000-8000-0000000000a1', BRUNO = 'aaaaaaaa-0000-4000-8000-0000000000b1';
const LUCIA = 'lucia.e2e@example.com';
const DA1 = 'dddddddd-0000-4000-8000-0000000000a1', DA2 = 'dddddddd-0000-4000-8000-0000000000a2';
const DG = 'dddddddd-0000-4000-8000-0000000000c1', DB1 = 'dddddddd-0000-4000-8000-0000000000b1', DOLD = 'dddddddd-0000-4000-8000-0000000000a0';
const TPL = 'eeeeeeee-0000-4000-8000-000000000013';
const PHOTO = `drafts/${ANA}/${DA1}/ffffffff-0000-4000-8000-000000000001.webp`;
const link = (id) => `${SITE}/cuenta/publicaciones?tab=borradores&draft=${id}`;

// ── Seed the stand-in ─────────────────────────────────────────────────────────
await db('email_templates', { method: 'POST', body: JSON.stringify([{
  id: TPL, key: 'draft-reminder', name: 'Borrador sin terminar — recordatorio',
  subject: 'Te falta poco para publicar tu propiedad', heading: 'Tu propiedad está casi lista',
  body: 'Hola {{name}},\n\nEmpezaste a publicar **{{property_title}}** en Casa Libre y quedó guardada como borrador. Lo que cargaste sigue ahí.\n\n![{{property_title}}]({{photo_url}})\n\nTe falta poco: tocá el botón y seguí justo donde lo dejaste. Publicar es gratis.',
  button_label: 'Continuar mi publicación', button_url: '{{draft_url}}', is_active: true, updated_at: new Date().toISOString(),
}]) });
await db('automations', { method: 'POST', body: JSON.stringify([
  { id: 'first_listing_free_home', enabled: false, wait_days: 2, free_days: 30, remind_days_before: 1, gift_template_id: null, reminder_template_id: null, milestones: null, template_id: null, first_tier_count: 25, later_free_days: 7, free_tiers: null },
  { id: 'draft_reminders', enabled: false, enabled_at: null, wait_days: 2, free_days: 30, remind_days_before: 3, gift_template_id: null, reminder_template_id: null, milestones: [24, 72, 168], template_id: TPL, first_tier_count: 25, later_free_days: 7, free_tiers: null },
]) });
await db('users', { method: 'POST', body: JSON.stringify([
  { id: ANA, email: 'ana.e2e@example.com', full_name: 'Ana Benítez', verified: true, active: true },
  { id: BRUNO, email: 'bruno.e2e@example.com', full_name: 'Bruno', verified: true, active: true, blocked: true },
]) });
const draft = (id, owner, h, data) => ({ id, user_id: owner, created_at: ago(h), updated_at: ago(h), data });
await db('listing_drafts', { method: 'POST', body: JSON.stringify([
  draft(DA1, ANA, 25, { mode: 'venta', ptype: 'casa', neighborhood: 'Villa Morra', city: 'Asunción', addressText: 'Calle E2E 123', price: '123456', area: '321', currency: 'USD', contact_phone: '0981123456', photos: [{ key: PHOTO, url: `/api/media/${PHOTO}` }] }),
  draft(DA2, ANA, 2, { mode: 'alquiler', ptype: 'departamento', neighborhood: 'Pocitos', city: 'Montevideo', addressText: 'Rambla 777', price: '777', area: '55', currency: 'USD' }),
  draft(DG, guestOwnerId(LUCIA), 26, { mode: 'venta', ptype: 'terreno', neighborhood: 'Carrasco', city: 'Montevideo', addressText: 'Arocena 98', price: '98765', currency: 'USD', contact_name: 'Lucía Gómez', _guest_email: LUCIA, _guest_key: crypto.randomUUID() }),
  draft(DB1, BRUNO, 30, { mode: 'venta', ptype: 'casa', neighborhood: 'Centro', city: 'Montevideo' }),
  draft(DOLD, ANA, 20 * 24, { mode: 'venta', ptype: 'casa', neighborhood: 'Malvín', city: 'Montevideo' }),
]) });

// ── A. Admin: the card, its settings and the template ─────────────────────────
let r = await admin('/api/automations');
let d = r.j.drafts;
check('admin shows the draft reminders automation OFF, 1 / 3 / 7 days, its template', r.status === 200 && d?.automation?.enabled === false && JSON.stringify(d.automation.milestones) === '[24,72,168]' && d.automation.template_id === TPL, JSON.stringify(d?.automation?.milestones));
check('admin card stats: 0 sent, 5 unfinished drafts', d?.sent === 0 && d?.waiting === 5, `sent ${d?.sent}, waiting ${d?.waiting}`);
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'draft_reminders', steps: [] }) });
check('no reminders → rejected', r.status === 400 && r.j.errors?.steps, JSON.stringify(r.j.errors));
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'draft_reminders', steps: [{ value: 61, unit: 'days' }] }) });
check('over 60 days → rejected', r.status === 400 && r.j.errors?.step_0, JSON.stringify(r.j.errors));
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'draft_reminders', steps: [{ value: 24, unit: 'hours' }, { value: 1, unit: 'days' }] }) });
check('two reminders at the same time → rejected', r.status === 400 && r.j.errors?.steps, JSON.stringify(r.j.errors));
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'draft_reminders', steps: [{ value: 1, unit: 'days' }, { value: 2, unit: 'hours' }] }) });
check('hours and days saved as sorted hours', r.status === 200 && JSON.stringify(r.j.drafts?.automation?.milestones) === '[2,24]', JSON.stringify(r.j.drafts?.automation?.milestones));
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'draft_reminders', steps: [{ value: 1, unit: 'days' }, { value: 3, unit: 'days' }, { value: 7, unit: 'days' }], template_id: TPL }) });
check('back to 1 / 3 / 7 days', r.status === 200 && JSON.stringify(r.j.drafts?.automation?.milestones) === '[24,72,168]');
r = await admin('/api/automations');
check('the other automations are untouched', r.j.automation?.id === 'first_listing_free_home' && r.j.automation?.enabled === false);
r = await admin('/api/email-templates');
const tplRow = (r.j.rows || []).find((t) => t.id === TPL);
check('template list: the new template, used by the draft reminders', tplRow?.key === 'draft-reminder' && tplRow.usedBy?.includes('Unfinished draft reminders → email'), tplRow?.usedBy?.join());
r = await admin(`/api/email-templates/${TPL}`, { method: 'PUT', body: JSON.stringify({ ...tplRow, heading: 'Tu propiedad está casi lista' }) });
check('template saves in the editor (all its variables are known)', r.status === 200, JSON.stringify(r.j.errors || ''));
r = await admin(`/api/email-templates/${TPL}/test`, { method: 'POST', body: JSON.stringify({}) });
let m = (await mails()).pop();
check('"Send test" goes to the team inbox only, with sample photo + draft button', r.status === 200 && r.j.to === 'omar@airosofts.com' && m?.to === 'omar@airosofts.com' && /^\[TEST\] Te falta poco/.test(m.subject) && /<img src="https:\/\/images\.unsplash\.com/.test(m.html) && /tab=borradores&amp;draft=ejemplo"[^>]*>Continuar mi publicación/.test(m.html), m?.subject);

// ── B–I. The hourly cron (buyer portal) ───────────────────────────────────────
let c = await cron();
check('switched OFF → the cron sends nothing', c.drafts?.skippedReason === 'disabled', JSON.stringify(c.drafts));
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'draft_reminders', enabled: true }) });
check('switching ON stamps enabled_at', r.status === 200 && r.j.drafts?.automation?.enabled === true && !!r.j.drafts.automation.enabled_at);

await fetch(`${MAIL}/captured`, { method: 'DELETE' });
c = await cron();
check('cron #1: Ana (1 day) and guest Lucía (1 day) emailed; blocked Bruno skipped; 20-day-old draft left alone', c.drafts?.sent === 2 && c.drafts?.skipped === 1 && c.drafts?.due === 3, JSON.stringify(c.drafts));
let sent = await mails();
const ana1 = sent.find((x) => [].concat(x.to).includes('ana.e2e@example.com'));
const lucia1 = sent.find((x) => [].concat(x.to).includes(LUCIA));
check('emails go to the real owners (no override), from the country sender', ana1 && lucia1 && sent.length === 2 && /no-reply@uy\.casa-libre\.com/.test(ana1.from), `${sent.map((x) => x.to).join(', ')} from ${ana1?.from}`);
check('Ana’s email: subject, greeting, what she started', ana1?.subject === 'Te falta poco para publicar tu propiedad' && /Hola Ana,/.test(ana1.html) && /<strong>Casa en venta · Villa Morra, Asunción<\/strong>/.test(ana1.html));
check('Ana’s email shows the draft’s first photo', ana1?.html.includes(`<img src="${SITE}/api/media/${PHOTO}"`));
check('Ana’s button opens HER draft on the Uruguay site', unesc(ana1?.html).includes(`<a href="${link(DA1)}"`) && /Continuar mi publicación<\/a>/.test(ana1?.html) && ana1?.text.includes(`Continuar mi publicación: ${link(DA1)}`), link(DA1));
check('Lucía’s email (guest draft): her name, her land, her draft link, no photo', /Hola Lucía,/.test(lucia1?.html) && /Terreno en venta · Carrasco, Montevideo/.test(lucia1?.html) && unesc(lucia1?.html).includes(`href="${link(DG)}"`) && !lucia1?.html.includes(`<img src="${SITE}`));
let logs = await db('email_log?automation_id=eq.draft_reminders&order=created_at.asc');
check('email_log: one row per draft step, run_id = draft id, status sent', JSON.stringify(logs.map((l) => l.dedupe_key).sort()) === JSON.stringify([`draft:${DA1}:1`, `draft:${DG}:1`].sort()) && logs.every((l) => l.run_id === l.dedupe_key.split(':')[1] && l.status === 'sent' && /^fake_/.test(l.resend_id)), logs.map((l) => l.dedupe_key).join(', '));

c = await cron();
check('cron #2 right after: no duplicates', c.drafts?.sent === 0, JSON.stringify(c.drafts));

await db(`listing_drafts?id=eq.${DA1}`, { method: 'PATCH', body: JSON.stringify({ updated_at: ago(73) }) });   // 3 days untouched
await db(`listing_drafts?id=eq.${DG}`, { method: 'PATCH', body: JSON.stringify({ updated_at: ago(1) }) });     // Lucía came back and changed it
c = await cron();
sent = await mails();
check('cron #3: Ana’s 3-day reminder; Lucía edited her draft → nothing yet', c.drafts?.sent === 1 && [].concat(sent[sent.length - 1].to).includes('ana.e2e@example.com'), JSON.stringify(c.drafts));
await db(`listing_drafts?id=eq.${DG}`, { method: 'PATCH', body: JSON.stringify({ updated_at: ago(30) }) });     // 30 h after her edit
c = await cron();
check('Lucía’s reminder 1 is not repeated after her edit (reminder 2 waits for 3 days)', c.drafts?.sent === 0, JSON.stringify(c.drafts));

await db(`listing_drafts?id=eq.${DA2}`, { method: 'PATCH', body: JSON.stringify({ updated_at: ago(100) }) });   // 4 days untouched, nothing sent yet
c = await cron();
logs = await db('email_log?automation_id=eq.draft_reminders');
check('cron #5: a draft past two steps gets ONE email, for the latest (3 days)', c.drafts?.sent === 1 && logs.some((l) => l.dedupe_key === `draft:${DA2}:2`) && !logs.some((l) => l.dedupe_key === `draft:${DA2}:1`), logs.map((l) => l.dedupe_key).join(', '));
const ana2 = (await mails()).pop();
check('…with the button to that draft', unesc(ana2?.html).includes(`href="${link(DA2)}"`) && /Departamento en alquiler · Pocitos, Montevideo/.test(ana2?.html));

await db(`listing_drafts?id=eq.${DA1}`, { method: 'PATCH', body: JSON.stringify({ updated_at: ago(170) }) });  // 7 days untouched…
await db(`listing_drafts?id=eq.${DA1}`, { method: 'DELETE', headers: { 'Content-Type': '' } });                // …but she published it
c = await cron();
logs = await db('email_log?automation_id=eq.draft_reminders');
check('published / deleted draft: the sequence stops (no 7-day email)', c.drafts?.sent === 0 && !logs.some((l) => l.dedupe_key === `draft:${DA1}:3`), JSON.stringify(c.drafts));

r = await admin('/api/automations');
d = r.j.drafts;
check('admin stats: 4 sent (#1: 2 · #2: 2), 4 unfinished drafts', d?.sent === 4 && d?.perStep?.['1'] === 2 && d?.perStep?.['2'] === 2 && d?.waiting === 4, JSON.stringify({ sent: d?.sent, perStep: d?.perStep, waiting: d?.waiting }));
r = await admin('/api/email-templates');
check('template list counts the sends', (r.j.rows || []).find((t) => t.id === TPL)?.sentCount === 4);

// ── J. The email button in a real browser (headless Chrome) ──────────────────
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_DIR || '', 'index.mjs')).href).catch(() => null);
if (!pw) check('Playwright available (set PLAYWRIGHT_DIR)', false);
else {
  const browser = await pw.chromium.launch({ channel: 'chrome', headless: true });
  const local = (u) => unesc(u).replace(SITE, BP);
  const inputs = (page) => page.evaluate(() => [...document.querySelectorAll('input, textarea')].map((i) => i.value).filter(Boolean));

  // J1. Signed in: the button opens the draft in the sell wizard.
  const ctx1 = await browser.newContext();
  await ctx1.addCookies([{ name: 'cl_session', value: signed({ uid: ANA, email: 'ana.e2e@example.com', name: 'Ana Benítez', exp: Date.now() + 3600e3 }, 'e2e-buyer-secret'), url: BP }]);
  const p1 = await ctx1.newPage();
  const href2 = /href="([^"]*tab=borradores[^"]*)"/.exec(ana2.html)[1];
  await p1.goto(local(href2), { waitUntil: 'domcontentloaded' });
  let vals = [];
  for (let i = 0; i < 40 && !vals.includes('777'); i++) { await sleep(500); vals = await inputs(p1); }
  check('signed in: the email button opens My listings with THAT draft in the sell wizard', vals.includes('777') && p1.url().includes(`draft=${DA2}`), `inputs: ${vals.slice(0, 6).join(' | ')}`);
  await ctx1.close();

  // J2. Signed out (guest draft): sign in with a code → back to the same link → draft opens.
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  const hrefG = /href="([^"]*tab=borradores[^"]*)"/.exec(lucia1.html)[1];
  await p2.goto(local(hrefG), { waitUntil: 'domcontentloaded' });
  const emailBox = p2.locator('[role="dialog"] input[type="email"]');
  await emailBox.waitFor({ timeout: 30000 });
  await p2.waitForURL((u) => new URL(u).pathname === '/', { timeout: 30000 }).catch(() => {});
  check('signed out: bounced home with the sign-in modal open', new URL(p2.url()).pathname === '/' && (await emailBox.isVisible()), p2.url());
  await emailBox.fill(LUCIA);
  await p2.locator('[role="dialog"] button[type="submit"]').click();
  await p2.locator('[data-testid="auth-code"]').waitFor({ timeout: 20000 });
  await p2.locator('[role="dialog"] input[autocomplete="name"]').fill('Lucía Gómez');
  await p2.locator('[data-testid="auth-code"]').fill('246810');
  await p2.locator('[data-testid="signup-terms"]').check();
  await p2.locator('[role="dialog"] button[type="submit"]').click();
  vals = [];
  for (let i = 0; i < 60 && !vals.includes('98765'); i++) { await sleep(500); vals = await inputs(p2); }
  check('after signing in she is back on the draft link and the wizard opens HER draft', p2.url().includes(`/cuenta/publicaciones?tab=borradores&draft=${DG}`) && vals.includes('98765'), `${p2.url().replace(BP, '')} · inputs: ${vals.slice(0, 6).join(' | ')}`);
  const [lu] = await db(`users?email=eq.${encodeURIComponent(LUCIA)}`);
  const [dg] = await db(`listing_drafts?id=eq.${DG}`);
  check('her guest draft now belongs to her new account (same id)', lu?.id && dg?.user_id === lu.id && !dg.data._guest_email, `${dg?.user_id} = ${lu?.id}`);
  await ctx2.close();

  // J4. Admin pages: the new card (steps editor, template, stats) and the template editor.
  const ctx3 = await browser.newContext();
  const cookies = adminCookie.split('; ').map((x) => { const i = x.indexOf('='); return { name: x.slice(0, i), value: x.slice(i + 1), url: ADMIN }; });
  await ctx3.addCookies(cookies);
  const p3 = await ctx3.newPage();
  await p3.goto(`${ADMIN}/automations`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p3.getByText('Unfinished draft reminders', { exact: true }).waitFor({ timeout: 60000 }).catch(() => {});
  const card = p3.locator('section', { hasText: 'Unfinished draft reminders' });
  const cardText = (await card.innerText().catch(() => '')).replace(/\s+/g, ' ');
  const stepVals = await card.locator('[data-testid="draft-steps"] input[type="number"]').evaluateAll((els) => els.map((e) => e.value)).catch(() => []);
  const units = await card.locator('[data-testid="draft-steps"] select').evaluateAll((els) => els.map((e) => e.value)).catch(() => []);
  check('admin page: the new card with reminders 1 / 3 / 7 days, its template and stats', /Reminder 3/i.test(cardText) && stepVals.join() === '1,3,7' && units.join() === 'days,days,days' && /Borrador sin terminar/.test(await card.locator('select').last().evaluate((e) => e.options[e.selectedIndex].text).catch(() => '')) && /4 sent so far/.test(cardText) && /4 unfinished drafts right now/.test(cardText), `${stepVals.join()} ${units.join()} · ${(/\d+ sent so far.*right now\./.exec(cardText) || [cardText.slice(-200)])[0]}`);
  await card.getByText('+ Add reminder').click();
  const added = await card.locator('[data-testid="draft-steps"] input[type="number"]').evaluateAll((els) => els.map((e) => e.value));
  await card.locator('[data-testid="draft-steps"] input[type="number"]').first().fill('6');
  await card.locator('[data-testid="draft-steps"] select').first().selectOption('hours');
  await card.getByRole('button', { name: 'Save changes' }).click();
  await p3.getByText('Changes saved.').waitFor({ timeout: 20000 }).catch(() => {});
  r = await admin('/api/automations');
  check('admin page: add a reminder, switch one to hours, save → stored as hours', JSON.stringify(r.j.drafts?.automation?.milestones) === '[6,72,168,336]', `added ${added.join()} → ${JSON.stringify(r.j.drafts?.automation?.milestones)}`);
  await p3.goto(`${ADMIN}/email-templates/${TPL}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p3.getByText('{{draft_url}}', { exact: true }).waitFor({ timeout: 60000 }).catch(() => {});
  const chips = await p3.evaluate(() => document.body.innerText);
  const frame = p3.frameLocator('iframe[title="Email preview"]');
  const prevImg = await frame.locator('img[src*="unsplash"]').count().catch(() => 0);
  const prevBtn = await frame.getByText('Continuar mi publicación').count().catch(() => 0);
  check('template editor: draft variables offered, preview shows the photo and the button', ['{{draft_url}}', '{{photo_url}}', '{{draft_location}}'].every((v) => chips.includes(v)) && /used by Unfinished draft reminders/.test(chips) && prevImg === 1 && prevBtn === 1, `img ${prevImg}, button ${prevBtn}`);
  await ctx3.close();
  await browser.close();
}

// J3. Google sign-in carries the same link back (OAuth state).
r = await fetch(`${BP}/api/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next: `/cuenta/publicaciones?tab=borradores&draft=${DG}` }) }).then((x) => x.json());
check('Google sign-in returns to the draft link', r.url && new URL(r.url).searchParams.get('state') === `/cuenta/publicaciones?tab=borradores&draft=${DG}`, r.url ? new URL(r.url).searchParams.get('state') : JSON.stringify(r));

// ── K. Switched off again ─────────────────────────────────────────────────────
await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'draft_reminders', enabled: false }) });
c = await cron();
check('switched OFF → nothing more', c.drafts?.skippedReason === 'disabled', JSON.stringify(c.drafts));

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
