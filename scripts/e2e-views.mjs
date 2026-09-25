// End-to-end for the "Listing getting views" automation + the template editor's English
// preview. Same local setup as scripts/e2e-automations.mjs, plus the buyer portal runs
// with AUTOMATION_FAKE_VIEWS_FILE=<views.json> so this script can set the view counts.
//   VIEWS_FILE=<same path> RESEND_READ_KEY=<full-access key> node scripts/e2e-views.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';

const ADMIN = 'http://localhost:3015', BP = 'http://localhost:3013', DB = 'http://localhost:54321/rest/v1';
const VIEWS_FILE = process.env.VIEWS_FILE, RESEND_READ = process.env.RESEND_READ_KEY;
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const p = Buffer.from(JSON.stringify({ id: 'e2e', email: 'omar@airosofts.com', name: 'E2E', role: 'superadmin', allowed_countries: null, exp: Date.now() + 3600e3 })).toString('base64url');
const cookie = `cl_admin_session=${p}.${crypto.createHmac('sha256', 'e2e-admin-secret').update(p).digest('base64url')}; cl_admin_country=py`;
const admin = (path, opts = {}) => fetch(ADMIN + path, { ...opts, headers: { 'Content-Type': 'application/json', cookie } }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const db = (path, opts = {}) => fetch(`${DB}/${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' } }).then((r) => (r.status === 204 ? null : r.json()));
const cron = () => fetch(`${BP}/api/cron/automations?secret=e2e-cron`).then((r) => r.json()).then((j) => j.views || j);
const setViews = (m) => fs.writeFileSync(VIEWS_FILE, JSON.stringify(m));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DORA = 'aaaaaaaa-0000-4000-8000-000000000004', ELI = 'aaaaaaaa-0000-4000-8000-000000000005';
const OLD = 'cccccccc-0000-4000-8000-000000000001', NEW = 'cccccccc-0000-4000-8000-000000000002', SCR = 'cccccccc-0000-4000-8000-000000000003';

// ── Admin settings ──
let r = await admin('/api/automations');
const va = r.j.views?.automation;
check('views automation is listed, OFF, 50 views by default', r.status === 200 && va && va.enabled === false && JSON.stringify(va.milestones) === '[50]', JSON.stringify(va?.milestones));
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'listing_views_milestone', milestones: 'abc' }) });
check('invalid view numbers are rejected', r.status === 400 && r.j.errors?.milestones, r.j.errors?.milestones);
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'listing_views_milestone', milestones: '100, 50' }) });
check('view numbers saved and sorted', r.status === 200 && JSON.stringify(r.j.views.automation.milestones) === '[50,100]');
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'listing_views_milestone', enabled: true }) });
const enabledAt = r.j.views?.automation?.enabled_at;
check('switching ON stamps enabled_at (first-listing automation untouched)', r.status === 200 && r.j.views.automation.enabled && !!enabledAt && r.j.automation.enabled === false);

// ── Sellers ──
await sleep(1200);
const after = new Date(Date.parse(enabledAt) + 1000).toISOString();
await db('properties', { method: 'POST', body: JSON.stringify([
  { id: NEW, created_by: ELI, origin: 'user', created_at: after, admin_status: 'active', is_complete: true, property_type: 'Departamento', neighborhood: 'Villa Morra' },
  { id: SCR, created_by: ELI, origin: 'scraped', created_at: after, admin_status: 'active', is_complete: true, property_type: 'Casa', city: 'Luque' },
]) });

setViews({ [OLD]: 80, [NEW]: 30, [SCR]: 900 });
let c = await cron();
check('first run: old listing (80 views before switch-on) gets no email; nothing else due', c.sent === 0 && c.baselined === 1, JSON.stringify(c));

setViews({ [OLD]: 80, [NEW]: 62, [SCR]: 900 });
c = await cron();
check('new listing reaches 50 → one email', c.sent === 1, JSON.stringify(c));
c = await cron();
check('same count again → no duplicate', c.sent === 0, JSON.stringify(c));

setViews({ [OLD]: 110, [NEW]: 130, [SCR]: 900 });
c = await cron();
check('both listings pass 100 → one email each (old one included now)', c.sent === 2, JSON.stringify(c));

const logs = await db('email_log?automation_id=eq.listing_views_milestone&status=eq.sent&order=created_at.asc');
check('3 view emails logged with Resend ids, scraped listing never emailed', logs.length === 3 && logs.every((l) => l.resend_id) && !logs.some((l) => l.dedupe_key.includes(SCR)), logs.map((l) => l.dedupe_key.split(':').slice(1).join(':').slice(-12)).join(', '));
const state = await db('listing_view_milestones?order=property_id.asc');
check('last number recorded per listing', state.find((s) => s.property_id === NEW)?.last_milestone === 100 && state.find((s) => s.property_id === OLD)?.last_milestone === 100);

// The real email as sent (read back from Resend).
if (RESEND_READ) {
  const first = logs[0];
  let em = {};
  for (let i = 0; i < 6 && !em.html; i++) { em = await fetch(`https://api.resend.com/emails/${first.resend_id}`, { headers: { Authorization: `Bearer ${RESEND_READ}` } }).then((x) => x.json()).catch(() => ({})); if (!em.html) await sleep(1500); }
  check('email subject has the listing and its view count', em.subject === 'Departamento · Villa Morra ya tiene 62 visitas', em.subject);
  check('email links the listing and shows the count', /href="http:\/\/localhost:3013\/propiedad\/cccccccc-0000-4000-8000-000000000002"[^>]*>Departamento · Villa Morra<\/a>/.test(em.html || '') && /<strong>62 visitas<\/strong>/.test(em.html || ''));
  check('email invites to list another property', /href="http:\/\/localhost:3013\/publicar"[^>]*>Publicar otra propiedad</.test(em.html || ''));
}

// ── Admin shows it ──
r = await admin('/api/automations');
check('admin shows 3 sent', r.j.views?.sent === 3, String(r.j.views?.sent));
r = await admin('/api/email-templates');
const tv = (r.j.rows || []).find((t) => t.key === 'listing-views');
check('templates list: views template used by the automation', tv?.usedBy?.[0] === 'Listing getting views → email', tv?.usedBy?.join());

// ── English preview ──
r = await admin('/api/email-templates/translate', { method: 'POST', body: JSON.stringify({ subject: tv.subject, heading: tv.heading, body: tv.body, button_label: tv.button_label }) });
check('English preview translates and keeps variables + link', r.status === 200 && /views/i.test(r.j.subject) && r.j.subject.includes('{{property_title}}') && r.j.subject.includes('{{views}}') && r.j.body.includes('({{property_url}})') && /another property/i.test(r.j.body), `${r.j.subject} | ${r.j.button_label}`);
r = await fetch(ADMIN + '/api/email-templates/translate', { method: 'POST' }).then((x) => x.status);
check('translate needs an admin session', r === 401);

// ── Off ──
await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ id: 'listing_views_milestone', enabled: false }) });
setViews({ [OLD]: 999, [NEW]: 999 });
c = await cron();
check('switched OFF → no emails', c.skippedReason === 'disabled', JSON.stringify(c));

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
