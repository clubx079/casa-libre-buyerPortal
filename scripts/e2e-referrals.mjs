// End-to-end test of the referral program against the SANDBOX database only, through the
// real local servers: website (http://localhost:3016), admin (http://localhost:3011) and the
// fake Resend (scripts/fake-resend.mjs on :54332 — captures email, sends nothing).
//
//   node scripts/e2e-referrals.mjs            run (test users are tagged ref-e2e-…@example.com)
//   node scripts/e2e-referrals.mjs cleanup    remove every ref-e2e test row
//
// GUARD: refuses to run unless AIROBASE_URL in .env.local is the sandbox host, and prints
// only hosts (never keys).
import fs from 'node:fs';
import crypto from 'node:crypto';

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
const TAG = 'ref-e2e';
const DAY = 86400000;

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...H, ...(prefer ? { Prefer: prefer } : {}) };
  if (!body) delete headers['Content-Type'];   // PostgREST refuses an empty JSON body
  const r = await fetch(`${DB}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const q = encodeURIComponent;

// ── cleanup ─────────────────────────────────────────────────────────────────────────
async function cleanup() {
  const users = await rest(`users?select=id,email&email=like.${q(`${TAG}-%`)}`);
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const inl = `in.(${ids.join(',')})`;
    const props = await rest(`properties?select=id&created_by=${inl}`);
    if (props.length) {
      const pin = `in.(${props.map((p) => p.id).join(',')})`;
      await rest(`property_images?property_id=${pin}`, { method: 'DELETE' }).catch(() => {});
      await rest(`payments?property_id=${pin}`, { method: 'DELETE' }).catch(() => {});
      for (const p of props) await rest(`ingest_quarantine?external_id=eq.${q(`listing:${p.id}`)}`, { method: 'DELETE' }).catch(() => {});
      await rest(`automation_runs?property_id=${pin}`, { method: 'DELETE' }).catch(() => {});
      await rest(`properties?id=${pin}`, { method: 'DELETE' });
    }
    // the reward / reminder emails of these users (sent to the override address, keyed by reward id)
    for (const r of await rest(`email_log?select=id&automation_id=eq.referrals&template_key=eq.ref_reward&run_id=${inl}`)) {
      await rest(`email_log?automation_id=eq.referrals&dedupe_key=like.${q(`ref-%:${r.id}%`)}`, { method: 'DELETE' });
    }
    await rest(`email_log?automation_id=eq.referrals&run_id=${inl}`, { method: 'DELETE' });
    await rest(`automation_runs?user_id=${inl}`, { method: 'DELETE' }).catch(() => {});
    await rest(`otp_codes?identifier=like.${q(`${TAG}-%`)}`, { method: 'DELETE' }).catch(() => {});
  }
  await rest(`email_log?to_email=like.${q(`${TAG}-%`)}`, { method: 'DELETE' });
  await rest(`users?email=like.${q(`${TAG}-%`)}`, { method: 'DELETE' });
  console.log(`cleanup: removed ${ids.length} test users and their rows`);
}
if (process.argv[2] === 'cleanup') { await cleanup(); process.exit(0); }

// ── helpers ─────────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ok   ${label}`); } else { fail++; console.log(`  FAIL ${label} ${extra}`); } };
const sessionFor = (u) => {
  const p = Buffer.from(JSON.stringify({ uid: u.id, email: u.email, name: u.full_name || null, exp: Date.now() + 6 * 3600000 })).toString('base64url');
  return `cl_session=${p}.${crypto.createHmac('sha256', env.SESSION_SECRET).update(p).digest('base64url')}`;
};
const cookiesOf = (res) => (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
const mails = async () => (await fetch(`${MAIL}/captured`).then((r) => r.json()));
const cron = async (path = '/api/cron/automations') => fetch(`${WEB}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }).then((r) => r.json());
const refRows = async (kind, extra = '') => rest(`email_log?select=id,run_id,to_email,subject,error,created_at&automation_id=eq.referrals&template_key=eq.${kind}${extra}`);
const data = (r) => { try { return JSON.parse(r.error || '{}'); } catch { return {}; } };
const person = async (uid) => (await rest(`email_log?select=id,run_id,subject,error&dedupe_key=eq.${q(`ref:person:${uid}:ev`)}`))[0];
const rewardsFor = async (uid) => (await refRows('ref_reward', `&run_id=eq.${uid}`)).map((r) => ({ id: r.id, state: r.subject, ...data(r) }));
const prop = async (id) => (await rest(`properties?select=id,status,admin_status,promotion_plan,promotion_expires_at,renewal_reminded_at&id=eq.${id}`))[0];

const signals = (tag) => ({ device_id: `dev-${tag}-${crypto.randomUUID().slice(0, 8)}`, fp: `fp${tag.replace(/[^a-z0-9]/gi, '')}${crypto.randomBytes(3).toString('hex')}` });
async function makeUser(name, extra = {}) {
  const [u] = await rest('users', { method: 'POST', prefer: 'return=representation', body: { email: `${TAG}-${name}@example.com`, full_name: extra.full_name || `${name[0].toUpperCase()}${name.slice(1)} Prueba`, verified: true, active: true, auth_provider: 'email', ...extra } });
  return u;
}
async function makeListing(u, { status = 'published', sig = signals(u.email), phone = '0981 777 000' } = {}) {
  const [p] = await rest('properties', { method: 'POST', prefer: 'return=representation', body: {
    slug: `${TAG}-${crypto.randomUUID().slice(0, 8)}`, property_type: 'casa', listing_type: 'sale', price: 150000, currency: 'USD', price_usd: 150000,
    address: 'Villa Morra', neighborhood: 'Villa Morra', city: 'Asunción', province: 'Central', country: 'Paraguay', covered_area: 120, bedrooms: 3, bathrooms: 2,
    contact_name: u.full_name, contact_phone: phone, status, admin_status: status === 'published' ? 'active' : 'inactive', property_status: 'available', is_complete: true, origin: 'user',
    seller_type: 'owner', is_delisted: false, created_by: u.id, posted_by: u.id, latitude: -25.29, longitude: -57.58,
    feature_image_url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=70',
    raw_data: { published_via: 'e2e', user_email: u.email, signals: { ...sig, ip: sig.ip || '10.0.0.1' } },
  } });
  return p;
}
// A real sign-up by email code: /ref click cookie → /api/auth/code/send → code from the fake mail → verify.
async function signUpByCode(name, refCookie) {
  const email = `${TAG}-${name}@example.com`;
  const s = await fetch(`${WEB}/api/auth/code/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: refCookie || '' }, body: JSON.stringify({ email, fullName: `${name[0].toUpperCase()}${name.slice(1)} Prueba` }) }).then((r) => r.json());
  if (!s.ok) throw new Error(`code send: ${JSON.stringify(s)}`);
  const m = (await mails()).reverse().find((x) => (Array.isArray(x.to) ? x.to : [x.to]).includes(email));
  const code = String(m?.subject || '').match(/\d{6}/)?.[0];
  const res = await fetch(`${WEB}/api/auth/code/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: refCookie || '' }, body: JSON.stringify({ email, code, fullName: `${name[0].toUpperCase()}${name.slice(1)} Prueba` }) });
  const j = await res.json();
  if (!j.ok) throw new Error(`code verify: ${JSON.stringify(j)}`);
  const session = cookiesOf(res).find((c) => c.startsWith('cl_session='));
  return { user: { ...j.user }, session };
}
// Publish through the real /api/publish (no photos → live at once, like the app's no-photo path).
async function publish(session, sig, phone = '0981 123 456') {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ mode: 'venta', ptype: 'casa', neighborhood: 'Las Mercedes', city: 'Asunción', address: 'Av. España 1234', price: String(90000 + Math.floor(Math.random() * 50000)), currency: 'USD', area: '140', description: `Casa de prueba E2E ${crypto.randomUUID().slice(0, 6)}`, contact_phone: phone, seller_type: 'owner', latitude: '-25.2900', longitude: '-57.5800', bedrooms: '3', bathrooms: '2', device_id: sig.device_id, device_fp: sig.fp })) fd.set(k, v);
  const r = await fetch(`${WEB}/api/publish`, { method: 'POST', headers: { Cookie: session }, body: fd });
  const j = await r.json();
  if (!j.ok) throw new Error(`publish: ${r.status} ${JSON.stringify(j)}`);
  return j;
}
const waitFor = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 500)); } return null; };

// ── run ─────────────────────────────────────────────────────────────────────────────
await cleanup();
console.log('\n1. Program switched on in the admin (sandbox), first save creates the emails');
const login = await fetch(`${ADMIN}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'omar@airosofts.com', password: env.E2E_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD }) });
const adminCookie = cookiesOf(login).find((c) => c.startsWith('cl_admin_session='));
ok(login.ok && adminCookie, 'admin login (env account; control DB not used)', login.status);
const A = (path, opts = {}) => fetch(`${ADMIN}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Cookie: `${adminCookie}; cl_admin_country=py`, ...(opts.headers || {}) } }).then((r) => r.json());
const saved = await A('/api/referrals', { method: 'PUT', body: JSON.stringify({ enabled: true, referrer: { enabled: true, plan: 'verified', days: 30 }, newUser: { enabled: true, plan: 'verified', days: 30 }, milestone: { enabled: true, every: 3, plan: 'home', days: 30, repeat: false }, remindDays: '3, 1' }) });
ok(saved.ok, 'settings saved', JSON.stringify(saved));
const tpls = await rest('email_templates?select=key&key=like.referral-%25');
ok(tpls.length === 5, `5 referral emails exist (${tpls.length})`);

console.log('\n2. Referrer gets a link');
const rita = await makeUser('rita', { full_name: 'Rita Referente', phone: '+595981555001', phone_verified_at: new Date().toISOString(), created_at: new Date(Date.now() - 60 * DAY).toISOString() });
const ritaSig = signals('rita');
const ritaListing = await makeListing(rita, { sig: { ...ritaSig, ip: '10.9.9.9' }, phone: '0981 555 001' });
const ritaSession = sessionFor(rita);
const mine = await fetch(`${WEB}/api/account/referrals`, { headers: { Cookie: ritaSession } }).then((r) => r.json());
ok(mine.enabled && /^http:\/\/localhost:3016\/ref\/[a-z2-9]{8}$/.test(mine.url), `link ${mine.url}`);
const code = mine.code;
ok(mine.shareText.includes(mine.url), 'share message carries the link');

console.log('\n3. Click → cookie (first touch), bots and the owner are not counted');
const click = await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (E2E)' } });
const refCookie = cookiesOf(click).find((c) => c.startsWith('cl_ref='));
ok(click.status === 307 || click.status === 302, `redirect ${click.status} → ${click.headers.get('location')}`);
ok(/sell=1/.test(click.headers.get('location') || '') && /utm_source=referral/.test(click.headers.get('location') || ''), 'lands on the sell wizard tagged utm_source=referral');
ok(!!refCookie, 'cl_ref cookie set');
const bot = await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { 'User-Agent': 'WhatsApp/2.23 preview' } });
ok(!cookiesOf(bot).some((c) => c.startsWith('cl_ref=')), 'link preview bot: no cookie');
const self = await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { Cookie: ritaSession, 'User-Agent': 'Mozilla/5.0' } });
ok(/cuenta\/referidos\?own=1/.test(self.headers.get('location') || '') && !cookiesOf(self).some((c) => c.startsWith('cl_ref=')), 'owner clicking own link → own Referrals page, no cookie');
const again = await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { Cookie: cookiesOf(click).join('; '), 'User-Agent': 'Mozilla/5.0' } });   // same browser: both cookies
ok(!cookiesOf(again).some((c) => c.startsWith('cl_ref=')), 'second click keeps the first cookie (not overwritten)');
const clicks = await refRows('ref_click', `&subject=eq.${code}`);
ok(clicks.length === 1, `clicks recorded once per visitor/day (${clicks.length})`);

console.log('\n4. Sign-up by email code days after the click, publish, both rewards once');
const tenDaysAgo = encodeURIComponent(JSON.stringify({ c: code, t: Date.now() - 10 * DAY }));
const nina = await signUpByCode('nina', `cl_ref=${tenDaysAgo}`);
const pNina = await waitFor(() => person(nina.user.id));
ok(pNina && String(pNina.run_id) === rita.id && pNina.subject === 'signed_up', 'sign-up 10 days after the click is attached to the referrer');
ok(data(pNina).method === 'email', `method recorded (${data(pNina).method})`);
const ninaSig = signals('nina');
const pubNina = await publish(nina.session, ninaSig);
ok(pubNina.ok && pubNina.scanning === false, 'published (no photos → live at once)');
const q1 = await waitFor(async () => (await person(nina.user.id))?.subject === 'qualified');
ok(q1, 'referral qualified right after the listing went live');
const ninaR = await waitFor(async () => { const r = await rewardsFor(nina.user.id); return r[0]?.state === 'granted' ? r : null; });
const ritaR = await waitFor(async () => { const r = await rewardsFor(rita.id); return r.some((x) => x.state === 'granted') ? r : null; });
ok(ninaR?.length === 1 && ninaR[0].type === 'new_user' && ninaR[0].property_id === pubNina.id, 'new member reward on their listing');
ok(ritaR?.length === 1 && ritaR[0].type === 'referrer' && ritaR[0].property_id === ritaListing.id, 'referrer reward on the referrer’s listing');
const pn = await prop(pubNina.id); const pr = await prop(ritaListing.id);
ok(pn.promotion_plan === 'verified' && Date.parse(pn.promotion_expires_at) > Date.now() + 29 * DAY, `new member listing Verified until ${pn.promotion_expires_at}`);
ok(pr.promotion_plan === 'verified', `referrer listing Verified until ${pr.promotion_expires_at}`);

console.log('\n5. Retries never double-grant');
const refEmails = async () => (await rest(`email_log?select=id&automation_id=eq.referrals&channel=eq.email&status=eq.sent`)).length;
// let the publish hook finish both reward emails before counting
await waitFor(async () => (await rest(`email_log?select=id&dedupe_key=in.(${q(`ref-granted:${ninaR[0].id}`)},${q(`ref-granted:${ritaR[0].id}`)})&status=eq.sent`)).length === 2, 30000);
const beforeMail = await refEmails();
await cron(); await cron(); await cron();
ok((await rewardsFor(nina.user.id)).length === 1 && (await rewardsFor(rita.id)).length === 1, 'still one reward each after 3 cron runs');
ok((await prop(ritaListing.id)).promotion_expires_at === pr.promotion_expires_at, 'promotion end date unchanged by retries');
const sentLog = await rest(`email_log?select=dedupe_key,status&dedupe_key=like.${q('ref-granted:%')}`);
const ids = new Set([ninaR[0].id, ritaR[0].id]);
ok(sentLog.filter((l) => [...ids].some((i) => l.dedupe_key === `ref-granted:${i}`)).length === 2, 'each reward email logged once');
ok((await refEmails()) === beforeMail, `no new referral emails from the retries (${beforeMail})`);   // other sandbox automations (e.g. paid listings) may still send theirs

console.log('\n6. Second and third referrals → home-page reward once');
for (const name of ['omar', 'pia']) {
  const fresh = await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
  const c = cookiesOf(fresh).find((x) => x.startsWith('cl_ref='));
  const u = await signUpByCode(name, c);
  await publish(u.session, signals(name));
  await waitFor(async () => (await person(u.user.id))?.subject === 'qualified');
}
await cron();
const ritaAll = await rewardsFor(rita.id);
ok(ritaAll.filter((r) => r.type === 'referrer').length === 3, `3 referrer rewards (${ritaAll.filter((r) => r.type === 'referrer').length})`);
const ms = ritaAll.filter((r) => r.type === 'milestone');
ok(ms.length === 1 && ms[0].state === 'granted' && ms[0].plan === 'home', 'one home-page milestone reward, granted');
ok((await prop(ritaListing.id)).promotion_plan === 'home', 'referrer listing is now on the home page (Verified + home)');

console.log('\n7. Self-referral / same person is rejected');
const twinClick = await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
const twin = await signUpByCode('twin', cookiesOf(twinClick).find((x) => x.startsWith('cl_ref=')));
await publish(twin.session, ritaSig);   // same browser as the referrer (device id + profile)
const twinState = await waitFor(async () => { const p = await person(twin.user.id); return p?.subject !== 'signed_up' ? p : null; });
ok(twinState?.subject === 'rejected' && data(twinState).reason === 'same_person', `rejected: same person (${JSON.stringify(data(twinState || {}).matched)})`);
ok((await rewardsFor(twin.user.id)).length === 0, 'no reward for the same-person sign-up');
const phoneClick = await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
const phoney = await signUpByCode('phoney', cookiesOf(phoneClick).find((x) => x.startsWith('cl_ref=')));
await publish(phoney.session, signals('phoney'), '0981 555 001');   // the referrer's verified WhatsApp
const phState = await waitFor(async () => { const p = await person(phoney.user.id); return p?.subject !== 'signed_up' ? p : null; });
ok(phState?.subject === 'rejected' && (data(phState).matched || []).includes('phone'), 'rejected: listing phone is the referrer’s WhatsApp');
const existing = await makeUser('olduser', { created_at: new Date(Date.now() - 90 * DAY).toISOString() });
await fetch(`${WEB}/api/auth/code/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: existing.email }) });
const om = (await mails()).reverse().find((x) => (Array.isArray(x.to) ? x.to : [x.to]).includes(existing.email));
await fetch(`${WEB}/api/auth/code/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: refCookie }, body: JSON.stringify({ email: existing.email, code: String(om?.subject || '').match(/\d{6}/)?.[0] }) });
await new Promise((r) => setTimeout(r, 1500));
ok(!(await person(existing.id)), 'an existing account logging in with the cookie is not a referral');
const late = await signUpByCode('late', `cl_ref=${encodeURIComponent(JSON.stringify({ c: code, t: Date.now() - 31 * DAY }))}`);
await new Promise((r) => setTimeout(r, 1500));
ok(!(await person(late.user.id)), 'a click older than 30 days does not count');

console.log('\n8. Held duplicate / rejected photos do not qualify');
for (const [name, status] of [['dupli', 'duplicate_review'], ['badpics', 'rejected']]) {
  const c = cookiesOf(await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })).find((x) => x.startsWith('cl_ref='));
  const u = await signUpByCode(name, c);
  await makeListing({ id: u.user.id, email: u.user.email, full_name: u.user.full_name }, { status });
}
await cron();
const dupliUser = (await rest(`users?select=id&email=eq.${q(`${TAG}-dupli@example.com`)}`))[0];
const badUser = (await rest(`users?select=id&email=eq.${q(`${TAG}-badpics@example.com`)}`))[0];
const dp = await person(dupliUser.id); const bp = await person(badUser.id);
ok(dp.subject === 'signed_up' && data(dp).hold === 'duplicate', 'held duplicate: waiting, not qualified');
ok(bp.subject === 'signed_up' && data(bp).hold === 'photos_rejected', 'rejected photos: waiting, not qualified');
ok((await rewardsFor(dupliUser.id)).length === 0 && (await rewardsFor(badUser.id)).length === 0, 'no rewards for them');

console.log('\n9. Reminders at the right time, then the end');
const nr = (await rewardsFor(nina.user.id))[0];
const setEnd = async (ms) => {
  const until = new Date(Date.now() + ms).toISOString();
  const [row] = await rest(`email_log?select=id,error&id=eq.${nr.id}`);
  await rest(`email_log?id=eq.${nr.id}`, { method: 'PATCH', body: { error: JSON.stringify({ ...data(row), until }) } });
  await rest(`properties?id=eq.${pubNina.id}`, { method: 'PATCH', body: { promotion_expires_at: until } });
};
await setEnd(5 * DAY); let m0 = (await mails()).length; await cron();
ok((await mails()).length === m0, '5 days before the end: no reminder');
await setEnd(2.5 * DAY); m0 = (await mails()).length; await cron(); await cron();
ok((await mails()).length === m0 + 1, '2.5 days before: the 3-day reminder, once');
const remindMail = (await mails()).slice(-1)[0];
ok(/termina/.test(remindMail?.subject || '') && /extend/.test(remindMail?.html || ''), `reminder text + extend link (“${remindMail?.subject}”)`);
const rr = await cron('/api/cron/renewal-reminders');
ok((await mails()).length === m0 + 1, `the paid renewal reminder skips the reward listing (${JSON.stringify(rr)})`);
await setEnd(0.5 * DAY); m0 = (await mails()).length; await cron(); await cron();
ok((await mails()).length === m0 + 1, '12 hours before: the 1-day reminder, once');
await setEnd(-60000); await cron();
ok((await rewardsFor(nina.user.id))[0].state === 'expired', 'after the end: reward expired');

console.log('\n10. Admin: tracking, invite (recorded only), manual grant + revoke');
const page = await A('/api/referrals');
const rr0 = page.referrers.find((x) => x.userId === rita.id);
ok(rr0 && rr0.qualified === 3 && rr0.rejected === 2 && rr0.signups >= 7, `referrer row: ${JSON.stringify({ clicks: rr0?.clicks, signups: rr0?.signups, qualified: rr0?.qualified, rejected: rr0?.rejected, waiting: rr0?.waiting, granted: rr0?.granted })}`);
ok(page.people.some((p) => p.referred.id === nina.user.id && p.referrer.id === rita.id), 'who referred whom');
const aud = await A('/api/referrals?view=audience');
ok(aud.people.some((p) => p.id === rita.id) && aud.preview?.html?.includes('/ref/'), `audience ${aud.people.length} verified users + rendered invite`);
ok(aud.sendMode === 'record', 'send mode is record-only on this server');
const mBefore = (await mails()).length;
const sent = await A('/api/referrals', { method: 'POST', body: JSON.stringify({ action: 'send', ids: [rita.id, nina.user.id], channel: 'email' }) });
ok(sent.ok && sent.mode === 'record' && sent.recorded === 2 && sent.emails === 0, `invite recorded for 2, nothing sent (${JSON.stringify(sent)})`);
ok((await mails()).length === mBefore, 'no email left the admin');
const resend = await A('/api/referrals', { method: 'POST', body: JSON.stringify({ action: 'send', ids: [rita.id], channel: 'email' }) });
ok(resend.people === 0 && resend.skipped === 1, 'already-invited people are skipped');
const pia = (await rest(`users?select=id,email&email=eq.${q(`${TAG}-pia@example.com`)}`))[0];
const g = await A('/api/referrals', { method: 'POST', body: JSON.stringify({ action: 'grant', email: pia.email, plan: 'home', days: 10 }) });
ok(g.ok, `manual grant (${JSON.stringify(g)})`);
const piaListing = (await rest(`properties?select=id&created_by=eq.${pia.id}`))[0];
const piaBefore = await prop(piaListing.id);
const rv = await A('/api/referrals', { method: 'POST', body: JSON.stringify({ action: 'revoke', id: g.id }) });
const piaAfter = await prop(piaListing.id);
ok(rv.ok && Date.parse(piaBefore.promotion_expires_at) - Date.parse(piaAfter.promotion_expires_at) === 10 * DAY, 'revoke takes the 10 days back off');
const rv2 = await A('/api/referrals', { method: 'POST', body: JSON.stringify({ action: 'revoke', id: g.id }) });
ok(rv2.error === 'not_active', 'revoking twice does nothing');
const appr = await A('/api/referrals', { method: 'POST', body: JSON.stringify({ action: 'approve', personId: twinState.id }) });
await cron();
ok(appr.ok && (await person(twin.user.id)).subject === 'qualified', 'admin “approve anyway” lets a same-person rejection count');

console.log('\n11. The user’s own page shows people privately');
const mine2 = await fetch(`${WEB}/api/account/referrals`, { headers: { Cookie: sessionFor(rita) } }).then((r) => r.json());
const txt = JSON.stringify(mine2.persons);
ok(mine2.persons.length >= 7 && !/@/.test(txt) && !/0981/.test(txt), `${mine2.persons.length} people, no emails or phones in the response`);
ok(mine2.persons.some((p) => p.name === 'Nina P.'), 'names masked as first name + initial');
ok(mine2.rewards.some((r) => r.type === 'milestone'), 'rewards listed');

console.log(`\n${pass} passed, ${fail} failed`);
if (process.argv[2] !== 'keep') await cleanup();
process.exit(fail ? 1 : 0);
