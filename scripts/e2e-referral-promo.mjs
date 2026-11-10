// End-to-end test of the "Promote the referral program" emails against the SANDBOX database
// only, through the real local servers: website (http://localhost:3016 — its hourly cron
// /api/cron/automations), admin (http://localhost:3011 — the Automations / Referrals APIs)
// and the fake Resend (scripts/fake-resend.mjs on :54332 — captures email, sends nothing).
// Time is simulated by moving sign-up times and earlier sends into the past.
//
//   E2E_ADMIN_PASSWORD=… node scripts/e2e-referral-promo.mjs           run (users tagged refpromo-e2e-…@example.com)
//   node scripts/e2e-referral-promo.mjs cleanup                          remove every refpromo-e2e test row
//
// Needs on the website (.env.local, local only): REFERRAL_PROMO_TEST_AUDIENCE=refpromo-e2e-
// (so the run never considers anyone but the test users — checked before anything is
// switched on), RESEND_BASE_URL=http://localhost:54332 and RESEND_READ_API_KEY=<anything>
// (the bounce check reads the fake Resend). GUARD: refuses unless AIROBASE_URL is the
// sandbox host; prints hosts only. Restores the automation + program settings at the end.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { codeFor } from '../lib/referrals/core.js';

const SANDBOX_HOST = '7c73a09c7a1c4793b081.db.airosofts.com';
const WEB = process.env.E2E_WEB || 'http://localhost:3016';
const ADMIN = process.env.E2E_ADMIN || 'http://localhost:3011';
const MAIL = process.env.E2E_MAIL || 'http://localhost:54332';
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const DB = String(env.AIROBASE_URL || '').replace(/\/$/, '');
const host = (() => { try { return new URL(DB).hostname; } catch { return ''; } })();
console.log(`database host: ${host || '(none)'} · website ${WEB} · admin ${ADMIN} · mail ${MAIL}`);
if (host !== SANDBOX_HOST) { console.error(`REFUSED: ${host} is not the sandbox (${SANDBOX_HOST}).`); process.exit(9); }
for (const u of [WEB, ADMIN, MAIL]) if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(u)) { console.error(`REFUSED: ${u} is not a local server.`); process.exit(9); }
const KEY = env.AIROBASE_SECRET_KEY;
const TAG = 'refpromo-e2e';
const H = 3600e3;
const DAY = 24 * H;
const PROMO = 'referral_promo';

const HD = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...HD, ...(prefer ? { Prefer: prefer } : {}) };
  if (!body) delete headers['Content-Type'];
  const r = await fetch(`${DB}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const q = encodeURIComponent;
const iso = (ms) => new Date(ms).toISOString();

// ── cleanup: only rows of the tagged test users ───────────────────────────────────────
async function cleanup() {
  const users = await rest(`users?select=id,email&email=like.${q(`${TAG}-%`)}`);
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const inl = `in.(${ids.join(',')})`;
    const props = await rest(`properties?select=id&created_by=${inl}`);
    if (props.length) await rest(`properties?id=in.(${props.map((p) => p.id).join(',')})`, { method: 'DELETE' });
    await rest(`email_log?run_id=${inl}`, { method: 'DELETE' });                       // their promo emails, stops, codes, referrals
    await rest(`automation_runs?user_id=${inl}`, { method: 'DELETE' }).catch(() => {});
  }
  await rest(`email_log?to_email=like.${q(`${TAG}-%`)}`, { method: 'DELETE' });
  await rest(`otp_codes?identifier=like.${q(`${TAG}-%`)}`, { method: 'DELETE' }).catch(() => {});
  await rest(`users?email=like.${q(`${TAG}-%`)}`, { method: 'DELETE' });
  console.log(`cleanup: removed ${ids.length} test users and their rows`);
}
if (process.argv[2] === 'cleanup') { await cleanup(); process.exit(0); }

// ── helpers ─────────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ok   ${label}`); } else { fail++; console.log(`  FAIL ${label} ${extra}`); } };
const cookiesOf = (res) => (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
const mails = async () => (await fetch(`${MAIL}/captured`).then((r) => r.json()));
const cron = async () => (await fetch(`${WEB}/api/cron/automations`, { method: 'POST', headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }).then((r) => r.json())).referralPromo || {};
const sendsOf = async (uid) => rest(`email_log?select=id,dedupe_key,created_at,resend_id,status&automation_id=eq.${PROMO}&run_id=eq.${uid}&dedupe_key=like.${q('refpromo:%')}&order=created_at.asc`);
const stopOf = async (uid) => (await rest(`email_log?select=subject&dedupe_key=eq.${q(`refpromo-stop:${uid}:ev`)}`))[0]?.subject || null;
// days pass: every promo send of these people moves `ms` into the past
const age = async (uid, ms) => { for (const s of await sendsOf(uid)) await rest(`email_log?id=eq.${s.id}`, { method: 'PATCH', body: { created_at: iso(Date.parse(s.created_at) - ms) } }); };
const mailFor = async (uid) => (await mails()).reverse().find((m) => String(m.html || '').includes(`/ref/${codeFor(uid)}`));
async function makeUser(name, createdAgoMs, extra = {}) {
  const [u] = await rest('users', { method: 'POST', prefer: 'return=representation', body: { email: `${TAG}-${name}@example.com`, full_name: `${name[0].toUpperCase()}${name.slice(1)} Prueba`, verified: true, active: true, auth_provider: 'email', created_at: iso(Date.now() - createdAgoMs), ...extra } });
  return u;
}

// ── run ─────────────────────────────────────────────────────────────────────────────
await cleanup();
console.log('\n0. Safety: the website only considers the test users');
const first = await cron();
ok(first.testAudience === `${TAG}-`, `cron reports test audience “${first.testAudience || '(none)'}”`);
if (first.testAudience !== `${TAG}-`) { console.error(`REFUSED: set REFERRAL_PROMO_TEST_AUDIENCE=${TAG}- in .env.local and restart the website.`); process.exit(9); }

const login = await fetch(`${ADMIN}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'omar@airosofts.com', password: env.E2E_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD }) });
const adminCookie = cookiesOf(login).find((c) => c.startsWith('cl_admin_session='));
ok(login.ok && adminCookie, 'admin login', login.status);
if (!adminCookie) process.exit(1);
const A = (path, opts = {}) => fetch(`${ADMIN}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: `${adminCookie}; cl_admin_country=py`, ...(opts.headers || {}) } }).then((r) => r.json());
const promoSave = (patch) => A('/api/automations', { method: 'PUT', body: JSON.stringify({ id: PROMO, ...patch }) });

const before = await A('/api/automations');
const origPromo = before.referralPromo;
const origRef = (await rest('automations?select=id,enabled,enabled_at&id=eq.referrals'))[0];
const [origRow] = await rest(`automations?select=*&id=eq.${PROMO}`);
ok(origPromo && origPromo.setUp, `automation row exists (seeded): ${origPromo?.schedule}`);
ok(origPromo?.defaultTemplate?.key === 'referral-promo', 'default email “referral-promo” exists');

let failed = false;
try {
  console.log('\n1. Switched on in the admin (sandbox); simulated as switched on 10 days ago');
  if (!origRef?.enabled) await A('/api/referrals', { method: 'PUT', body: JSON.stringify({ enabled: true }) });
  const saved = await promoSave({ firstAfterHours: 24, everyDays: 3, maxSends: 3, includeExisting: true, perRun: 100, enabled: true });
  ok(saved.referralPromo?.settings?.enabled === true && saved.referralPromo.settings.everyDays === 3, `saved: ${saved.referralPromo?.schedule}`, JSON.stringify(saved.errors || saved.error || ''));
  const bad = await promoSave({ everyDays: 61 });
  ok(bad.error === 'invalid' && bad.errors?.everyDays, 'every 61 days is refused (1–60)');
  await rest(`automations?id=eq.${PROMO}`, { method: 'PATCH', body: { enabled_at: iso(Date.now() - 10 * DAY) } });

  console.log('\n2. First email 24 hours after sign-up, not before');
  const ana = await makeUser('ana', 23 * H);
  let r = await cron();
  ok((await sendsOf(ana.id)).length === 0, `23 h after sign-up: no email (${JSON.stringify(r.counts || r.skippedReason)})`);
  await rest(`users?id=eq.${ana.id}`, { method: 'PATCH', body: { created_at: iso(Date.now() - 25 * H) } });
  const m0 = (await mails()).length;
  r = await cron();
  ok((await sendsOf(ana.id)).length === 1 && r.sent >= 1, `25 h after sign-up: email #1 (${r.sent} sent)`);
  const m1 = await mailFor(ana.id);
  ok(m1 && (await mails()).length === m0 + 1, 'one email captured by the fake Resend');
  ok(m1?.subject === 'Invitá a alguien a publicar en Casa-Libre y ganá la insignia Verificada gratis', `subject “${m1?.subject}”`);
  ok(/Hola Ana,/.test(m1?.text || '') && m1.html.includes(`/ref/${codeFor(ana.id)}`), 'greets by name + carries their own referral link');
  const settings = before.referralPromo ? (await A('/api/referrals')).settings : null;
  ok(settings && m1.text.includes(`durante ${settings.referrer.days} días`) && m1.text.includes(`${settings.milestone.every} invitados`) && m1.text.includes(`recibe ${settings.newUser.days} días`), `uses the real program settings (${settings?.referrer.days} days · ${settings?.milestone.every} people)`);
  ok(!/referral-promo\/stop/.test(m1?.html || '') && !/Para no recibir/.test(m1?.text || '') && /cuenta\/referidos/.test(m1?.html || ''), 'Referrals-page button, no opt-out link');
  const code = await rest(`email_log?select=subject&dedupe_key=eq.${q(`ref:code:${ana.id}:ev`)}`);
  ok(code[0]?.subject === codeFor(ana.id), 'the link works (code recorded)');
  const click = await fetch(`${WEB}/ref/${codeFor(ana.id)}`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (E2E)' } });
  ok([302, 307].includes(click.status) && /sell=1/.test(click.headers.get('location') || ''), `the link opens the sell wizard (${click.status})`);
  await cron(); await cron();
  ok((await sendsOf(ana.id)).length === 1, 'retries: still one email');

  console.log('\n3. Then every 3 days, up to 3');
  await age(ana.id, 2 * DAY); await cron();
  ok((await sendsOf(ana.id)).length === 1, '2 days later: nothing');
  await age(ana.id, 1 * DAY + 60000); await cron();
  ok((await sendsOf(ana.id)).map((s) => s.dedupe_key).includes(`refpromo:${ana.id}:2`), '3 days later: email #2');
  await age(ana.id, 3 * DAY + 60000); await cron();
  ok((await sendsOf(ana.id)).length === 3, 'another 3 days: email #3');
  await age(ana.id, 30 * DAY); r = await cron();
  ok((await sendsOf(ana.id)).length === 3, `no 4th email (finished ${r.counts?.finished})`);

  console.log('\n4. Stops after a referral');
  const beto = await makeUser('beto', 3 * DAY);
  await cron();
  ok((await sendsOf(beto.id)).length === 1, 'email #1');
  const cookie = `cl_ref=${encodeURIComponent(JSON.stringify({ c: codeFor(beto.id), t: Date.now() - 60000 }))}`;
  const email = `${TAG}-amiga@example.com`;
  await fetch(`${WEB}/api/auth/code/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ email, fullName: 'Amiga Prueba' }) });
  const otp = String((await mails()).reverse().find((x) => (Array.isArray(x.to) ? x.to : [x.to]).includes(email))?.subject || '').match(/\d{6}/)?.[0];
  const ver = await fetch(`${WEB}/api/auth/code/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ email, code: otp, fullName: 'Amiga Prueba' }) }).then((x) => x.json());
  await new Promise((res) => setTimeout(res, 1500));
  const person = (await rest(`email_log?select=run_id&dedupe_key=eq.${q(`ref:person:${ver.user?.id}:ev`)}`))[0];
  ok(ver.ok && String(person?.run_id) === beto.id, 'someone signed up with Beto’s link (real sign-up by email code)');
  await age(beto.id, 4 * DAY); r = await cron();
  ok((await sendsOf(beto.id)).length === 1, `no email #2 after the referral (referred: ${r.counts?.referred})`);

  console.log('\n6. Bounce, closed account, BAJA on WhatsApp');
  const dani = await makeUser('dani', 3 * DAY);
  const eva = await makeUser('eva', 3 * DAY);
  const feli = await makeUser('feli', 3 * DAY);
  await cron();
  const [ds] = await sendsOf(dani.id);
  ok(ds?.resend_id, 'email #1 to Dani has a Resend id');
  const bounce = await fetch(`${MAIL}/captured/${q(ds.resend_id)}/event`, { method: 'POST', body: JSON.stringify({ last_event: 'bounced' }) });
  ok(bounce.ok, 'the fake Resend now reports it bounced');
  await rest(`users?id=eq.${eva.id}`, { method: 'PATCH', body: { active: false } });
  await rest(`users?id=eq.${feli.id}`, { method: 'PATCH', body: { whatsapp_opted_out_at: iso(Date.now()) } });
  for (const u of [dani, eva, feli]) await age(u.id, 4 * DAY);
  r = await cron();
  ok((await sendsOf(dani.id)).length === 1 && (await stopOf(dani.id)) === 'bounced', `bounced: no email #2, stop recorded (${r.stopped} stopped)`);
  ok((await sendsOf(eva.id)).length === 1, 'closed account: no email #2');
  ok((await sendsOf(feli.id)).length === 1, 'replied BAJA on WhatsApp: no email #2');

  console.log('\n7. Existing users: paced 2 per run');
  await promoSave({ perRun: 2 });
  const olds = [];
  for (let i = 1; i <= 5; i++) olds.push(await makeUser(`old${i}`, (30 + i) * DAY));   // before it was switched on
  const counts = [];
  for (let i = 0; i < 4; i++) { r = await cron(); counts.push(r.sent); }
  const got = (await Promise.all(olds.map((u) => sendsOf(u.id)))).map((s) => s.length);
  ok(JSON.stringify(counts) === '[2,2,1,0]', `per run: ${JSON.stringify(counts)}`);
  ok(got.every((n) => n === 1), `each existing user got exactly one (${got.join(',')})`);
  const order = [];
  for (const u of olds) order.push([(await sendsOf(u.id))[0]?.created_at, u.email]);
  ok(order.sort()[0][1].includes('old1'), 'newest old account first');

  console.log('\n8. “Also existing users” off');
  await promoSave({ includeExisting: false, perRun: 100 });
  const gabo = await makeUser('gabo', 30 * DAY);     // before the switch-on
  const hugo = await makeUser('hugo', 2 * DAY);      // after it
  await cron();
  ok((await sendsOf(gabo.id)).length === 0 && (await sendsOf(hugo.id)).length === 1, 'only the person who signed up after it was switched on');
  await promoSave({ includeExisting: true });
  await cron();
  ok((await sendsOf(gabo.id)).length === 1, 'switched back on: the existing user gets it at the next run');

  console.log('\n9. Referral program off → nothing; promo off → nothing');
  await A('/api/referrals', { method: 'PUT', body: JSON.stringify({ enabled: false }) });
  const ines = await makeUser('ines', 2 * DAY);
  r = await cron();
  ok(r.skippedReason === 'referrals_off' && (await sendsOf(ines.id)).length === 0, `program off: ${r.skippedReason}, no email`);
  await A('/api/referrals', { method: 'PUT', body: JSON.stringify({ enabled: true }) });
  await promoSave({ enabled: false });
  r = await cron();
  ok(r.skippedReason === 'disabled' && (await sendsOf(ines.id)).length === 0, `promo off: ${r.skippedReason}, no email`);
  await promoSave({ enabled: true });
  await rest(`automations?id=eq.${PROMO}`, { method: 'PATCH', body: { enabled_at: iso(Date.now() - 10 * DAY) } });
  await cron();
  ok((await sendsOf(ines.id)).length === 1, 'back on: sent at the next run');

  console.log('\n10. Admin shows it');
  const page2 = await A('/api/automations');
  const p = page2.referralPromo;
  ok(p.sent >= 14 && p.perStep['1'] >= 12 && p.perStep['3'] >= 1 && p.bounced === 1, `Automations card: ${p.sent} sent to ${p.people} · per email ${JSON.stringify(p.perStep)} · ${p.bounced} bounced`);
  const ref = await A('/api/referrals');
  ok(ref.promo?.enabled && /after sign-up/.test(ref.promo.schedule), `Referrals page line: ${ref.promo?.schedule}`);
  const tpl = page2.templates.find((t) => t.key === 'referral-promo');
  const detail = await A(`/api/email-templates/${tpl.id}`);
  ok((detail.row?.usedBy || detail.usedBy || []).includes('Promote the referral program → email'), 'template page: used by the automation');
} catch (e) {
  failed = true;
  console.error('ERROR', e?.message || e);
} finally {
  // put the settings back the way they were
  await rest(`automations?id=eq.${PROMO}`, { method: 'PATCH', body: { enabled: origRow.enabled, enabled_at: origRow.enabled_at, free_tiers: origRow.free_tiers, template_id: origRow.template_id } });
  await rest('automations?id=eq.referrals', { method: 'PATCH', body: { enabled: origRef.enabled, enabled_at: origRef.enabled_at } });
  const [after] = await rest(`automations?select=enabled&id=eq.${PROMO}`);
  console.log(`\nrestored: promo ${after.enabled ? 'ON' : 'off'}, referral program ${origRef.enabled ? 'ON' : 'off'}`);
}
console.log(`\n${pass} passed, ${fail + (failed ? 1 : 0)} failed`);
if (process.argv[2] !== 'keep') await cleanup();
process.exit(fail || failed ? 1 : 0);
