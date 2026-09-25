// Run: start scripts/dev-postgrest.mjs 54321 scripts/e2e-automations.seed.json, the buyer portal on :3013
// (AIROBASE_URL=http://localhost:54321 CRON_SECRET=e2e-cron AUTOMATION_EMAIL_OVERRIDE=omar@airosofts.com)
// and the admin portal on :3015 (all AIROBASE_URL_* → the stand-in, SESSION_SECRET=e2e-admin-secret),
// then: RESEND_READ_KEY=<full-access key> node scripts/e2e-automations.mjs
// End-to-end: admin portal (:3015) + buyer portal (:3013) against the local
// stand-in DB (:54321). Real Resend sends — every email goes to omar@airosofts.com.
import crypto from 'node:crypto';

const ADMIN = 'http://localhost:3015', BP = 'http://localhost:3013', DB = 'http://localhost:54321/rest/v1';
const RESEND_READ = process.env.RESEND_READ_KEY;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

// Admin session cookie (same format as lib/auth.js, signed with the e2e secret).
const p = Buffer.from(JSON.stringify({ id: 'e2e', email: 'omar@airosofts.com', name: 'E2E', role: 'superadmin', allowed_countries: null, exp: Date.now() + 3600e3 })).toString('base64url');
const cookie = `cl_admin_session=${p}.${crypto.createHmac('sha256', 'e2e-admin-secret').update(p).digest('base64url')}; cl_admin_country=py`;
const admin = (path, opts = {}) => fetch(ADMIN + path, { ...opts, headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) } }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const db = (path, opts = {}) => fetch(`${DB}/${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) } }).then((r) => (r.status === 204 ? null : r.json()));
const cron = () => fetch(`${BP}/api/cron/automations?secret=e2e-cron`).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ANA = 'aaaaaaaa-0000-4000-8000-000000000001', BRUNO = 'aaaaaaaa-0000-4000-8000-000000000002', CARLA = 'aaaaaaaa-0000-4000-8000-000000000003';

// ── A. Email templates (admin) ──
let r = await admin('/api/email-templates');
const builtIn = (r.j.rows || []).filter((t) => t.key);
check('templates list shows the 2 built-in templates', r.status === 200 && builtIn.length === 2, builtIn.map((t) => t.name).join(' | '));
const gift = builtIn.find((t) => t.key === 'first-listing-gift');
check('built-in gift template reports its automation step', gift?.usedBy?.[0] === 'First listing → gift email', gift?.usedBy?.join());
r = await fetch(ADMIN + '/api/email-templates').then((x) => x.status);
check('templates API refuses requests without an admin session', r === 401, `status ${r}`);

r = await admin('/api/email-templates', { method: 'POST', body: JSON.stringify({ name: '', subject: 'Hola {{nmae}}', body: '' }) });
check('invalid template is rejected with field errors', r.status === 400 && r.j.errors?.name && r.j.errors?.subject?.includes('nmae') && r.j.errors?.body, JSON.stringify(r.j.errors));
r = await admin('/api/email-templates', { method: 'POST', body: JSON.stringify({ name: 'Promo octubre', subject: '{{name}}, novedades', heading: 'Hola', body: 'Texto **importante**\n\nMás info [acá](https://casa-libre.com.py)', button_label: 'Ver', button_url: '{{property_url}}' }) });
const custom = r.j.row;
check('custom template is created', r.status === 200 && custom?.id && custom.key === null, custom?.id);
r = await admin(`/api/email-templates/${custom.id}`, { method: 'PUT', body: JSON.stringify({ ...custom, name: 'Promo octubre (v2)' }) });
check('custom template is edited', r.status === 200 && r.j.row?.name === 'Promo octubre (v2)');
r = await admin(`/api/email-templates/${gift.id}`, { method: 'DELETE' });
check('built-in template cannot be deleted', r.status === 409, r.j.message);
r = await admin(`/api/email-templates/${custom.id}`, { method: 'DELETE' });
check('custom template can be deleted', r.status === 200);

r = await admin(`/api/email-templates/${gift.id}/test`, { method: 'POST', body: JSON.stringify({}) });
check('"Send test" sends the gift template to the team inbox only', r.status === 200 && r.j.to === 'omar@airosofts.com', JSON.stringify(r.j));

// ── B. Automations (admin) ──
r = await admin('/api/automations');
check('automation starts OFF with zero stats', r.status === 200 && r.j.automation?.enabled === false && r.j.stats?.gifted === 0);
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ free_days: 5, remind_days_before: 5 }) });
check('invalid settings rejected (reminder must be before the end)', r.status === 400 && r.j.errors?.remind_days_before, JSON.stringify(r.j.errors));
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ wait_days: 0 }) });
check('wait days saved (0 for the test)', r.status === 200 && r.j.automation?.wait_days === 0);
r = await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ enabled: true }) });
const enabledAt = r.j.automation?.enabled_at;
check('switching ON stamps enabled_at', r.status === 200 && r.j.automation?.enabled === true && !!enabledAt, enabledAt);

// ── C. Sellers publish (written straight into the stand-in DB) ──
const after = new Date(Date.parse(enabledAt) + 1000).toISOString();
await sleep(1500);
const [anaProp] = await db('properties', { method: 'POST', body: JSON.stringify([{ id: 'bbbbbbbb-0000-4000-8000-000000000001', created_by: ANA, origin: 'user', created_at: after, admin_status: 'active', is_complete: true, feature_image_url: 'https://img/ana.jpg', property_type: 'Casa', neighborhood: 'Villa Morra', promotion_plan: null }]) });
await db('properties', { method: 'POST', body: JSON.stringify([{ id: 'bbbbbbbb-0000-4000-8000-000000000002', created_by: BRUNO, origin: 'user', created_at: after, admin_status: 'active', is_complete: true, feature_image_url: null, property_type: 'Terreno', city: 'Luque' }]) });
await db('properties', { method: 'POST', body: JSON.stringify([{ id: 'bbbbbbbb-0000-4000-8000-000000000003', created_by: CARLA, origin: 'user', created_at: after, admin_status: 'active', is_complete: true, feature_image_url: 'https://img/c.jpg', property_type: 'Departamento', neighborhood: 'Carmelitas' }]) });

// ── D. Hourly cron (buyer portal) ──
let c = await cron();
check('cron gifts Ana and skips Bruno + Carla', c.gifted === 1 && c.skipped === 2 && c.failed === 0, JSON.stringify(c));
const [anaNow] = await db(`properties?id=eq.${anaProp.id}`);
const days = (Date.parse(anaNow.promotion_expires_at) - Date.now()) / 86400e3;
check('Ana’s listing is on the home plan for ~30 days', anaNow.promotion_plan === 'home' && days > 29.9 && days < 30.1, `${days.toFixed(2)} days`);
let runs = await db('automation_runs?order=created_at.asc');
const reasons = Object.fromEntries(runs.map((x) => [x.user_id, x.skip_reason || x.status]));
check('skip reasons recorded', reasons[BRUNO] === 'no_photo' && reasons[CARLA] === 'not_first' && reasons[ANA] === 'gifted', JSON.stringify(reasons));
let logs = await db('email_log?status=eq.sent');
const giftLog = logs.find((l) => l.dedupe_key?.startsWith('gift:'));
check('gift email sent via Resend and logged', !!giftLog?.resend_id && giftLog.to_email === 'omar@airosofts.com', giftLog?.resend_id);
c = await cron();
check('second cron run changes nothing (no duplicate gift)', c.gifted === 0 && c.skipped === 0 && c.reminded === 0, JSON.stringify(c));

// ── E. Reminder window ──
const anaRun = runs.find((x) => x.user_id === ANA);
await db(`automation_runs?id=eq.${anaRun.id}`, { method: 'PATCH', body: JSON.stringify({ free_until: new Date(Date.now() + 2 * 86400e3).toISOString() }) });
c = await cron();
check('cron sends the ending-soon reminder', c.reminded === 1, JSON.stringify(c));
c = await cron();
check('reminder is not sent twice', c.reminded === 0, JSON.stringify(c));
logs = await db('email_log?status=eq.sent');
const remLog = logs.find((l) => l.dedupe_key?.startsWith('remind:'));
check('reminder email logged with a Resend id', !!remLog?.resend_id, remLog?.subject);

// Pull the real sent HTML back from Resend and follow the button.
let extendUrl = null;
if (RESEND_READ && remLog?.resend_id) {
  for (let i = 0; i < 6 && !extendUrl; i++) {
    const em = await fetch(`https://api.resend.com/emails/${remLog.resend_id}`, { headers: { Authorization: `Bearer ${RESEND_READ}` } }).then((x) => x.json()).catch(() => ({}));
    const m = String(em.html || '').match(/href="([^"]*\/api\/promo\/extend\?token=[^"]+)"/);
    if (m) extendUrl = m[1].replace(/&amp;/g, '&'); else await sleep(1500);
    if (i === 0) check('reminder email contains "Extender por US$20"', /Extender por US\$20/.test(em.html || ''), em.subject);
  }
}
check('reminder email has the extend link', !!extendUrl, extendUrl ? extendUrl.slice(0, 70) + '…' : 'not found');
if (extendUrl) {
  const res = await fetch(extendUrl.replace(/^https?:\/\/[^/]+/, BP), { redirect: 'manual' });
  const loc = res.headers.get('location') || '';
  check('extend link signs Ana in and opens the US$20 payment', [302, 303, 307, 308].includes(res.status) && loc.includes(`/cuenta/publicaciones?pay=${anaProp.id}&plan=home`) && /cl_session=/.test(res.headers.get('set-cookie') || ''), `${res.status} → ${loc}`);
  const tok = new URL(extendUrl).searchParams.get('token');
  const renew = await fetch(`${BP}/api/promo/renew?token=${encodeURIComponent(tok)}`, { redirect: 'manual' });
  check('the one-click CHARGING renew route refuses the extend link', renew.status === 400, `status ${renew.status}`);
  const bad = await fetch(`${BP}/api/promo/extend?token=${encodeURIComponent(tok.slice(0, -3) + 'xyz')}`, { redirect: 'manual' });
  check('a tampered extend link is rejected', (bad.headers.get('location') || '').includes('extend=invalid'), bad.headers.get('location'));
}

// ── F. Seller pays → converted ──
await db('payments', { method: 'POST', body: JSON.stringify([{ user_id: ANA, property_id: anaProp.id, kind: 'highlight', amount_usd: 20, status: 'succeeded', created_at: new Date().toISOString() }]) });
c = await cron();
check('payment after the gift marks Ana as converted', c.converted === 1, JSON.stringify(c));

// ── G. Admin stats ──
r = await admin('/api/automations');
const s = r.j.stats || {};
check('admin stats: 1 gift, 1 reminder, 1 paid, US$20, 2 skipped', s.gifted === 1 && s.reminded === 1 && s.converted === 1 && s.revenueUsd === 20 && s.skipped === 2, JSON.stringify(s));
check('admin recent activity names the sellers', (r.j.recent || []).some((x) => x.user === 'Ana Benítez' && x.property === 'Casa · Villa Morra'));
r = await admin('/api/email-templates');
const g2 = (r.j.rows || []).find((t) => t.key === 'first-listing-gift');
check('templates list counts sent emails', g2?.sentCount === 1 && !!g2?.lastSentAt, `gift sent ${g2?.sentCount}`);

// ── H. Automation OFF stops everything ──
await admin('/api/automations', { method: 'PUT', body: JSON.stringify({ enabled: false }) });
c = await cron();
check('switched OFF → cron does nothing', c.skippedReason === 'disabled', JSON.stringify(c));

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
