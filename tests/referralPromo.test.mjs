// "Promote the referral program" automation — schedule (lib/referrals/promo.js) and the
// hourly run (lib/automations/referralPromo.js) against the in-memory PostgREST.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import {
  PROMO_ID, PROMO_TEMPLATE, PROMO_DEFAULTS, promoConfig, promoNext, promoProgress, promoKey, promoStopKey, roundDownProof, promoScheduleText,
} from '../lib/referrals/promo.js';
import { runReferralPromo, pickPromo, stopPromo } from '../lib/automations/referralPromo.js';
import { codeFor } from '../lib/referrals/core.js';
import { renderTemplate, templateVars } from '../lib/emailTemplateRender.js';

const H = 3600e3;
const D = 24 * H;
const T0 = Date.now();          // sends are stamped with the real clock (the store's created_at)
const iso = (ms) => new Date(ms).toISOString();
const SITE = 'https://casa-libre.com.py';

// ── the pure schedule ─────────────────────────────────────────────────────────────
test('promoConfig: defaults (24 h, every 7 days, 3 emails, existing users on, 100 per run) and clamping', () => {
  const d = promoConfig({ id: PROMO_ID, enabled: true, enabled_at: iso(T0) });
  assert.deepEqual({ ...d, enabledAt: null }, { exists: true, enabled: true, enabledAt: null, templateId: null, ...PROMO_DEFAULTS });
  assert.equal(PROMO_DEFAULTS.firstAfterHours, 24);
  assert.equal(PROMO_DEFAULTS.maxSends, 3);
  assert.equal(PROMO_DEFAULTS.includeExisting, true);
  assert.equal(PROMO_DEFAULTS.perRun, 100);
  const c = promoConfig({ enabled: true, enabled_at: iso(T0), free_tiers: [{ firstAfterHours: 0, everyDays: 61, maxSends: 4, includeExisting: false, perRun: 5000 }] });
  assert.equal(c.firstAfterHours, 24);      // out of range → default
  assert.equal(c.everyDays, 7);
  assert.equal(c.maxSends, 4);
  assert.equal(c.includeExisting, false);
  assert.equal(c.perRun, 100);
  assert.equal(promoConfig({ enabled: true }).enabled, false, 'on without enabled_at is not on');
  assert.equal(promoConfig(null).exists, false);
  for (const n of [1, 3, 4, 7, 60]) assert.equal(promoConfig({ free_tiers: [{ everyDays: n }] }).everyDays, n);
});

test('promoNext: 1st email after the wait (not before), then every N days, stops at the maximum', () => {
  const cfg = { ...PROMO_DEFAULTS, everyDays: 4, enabledAt: iso(T0 - 30 * D) };
  const signed = T0 - 10 * D;
  assert.equal(promoNext({ createdAtMs: signed, sent: 0 }, cfg, signed + 23 * H).state, 'waiting');
  const first = promoNext({ createdAtMs: signed, sent: 0 }, cfg, signed + 24 * H);
  assert.deepEqual(first, { state: 'due', n: 1, dueAtMs: signed + 24 * H, existing: false });
  const sent1 = signed + 24 * H + 5 * 60000;
  assert.equal(promoNext({ createdAtMs: signed, sent: 1, lastAtMs: sent1 }, cfg, sent1 + 4 * D - 1).state, 'waiting');
  assert.deepEqual(promoNext({ createdAtMs: signed, sent: 1, lastAtMs: sent1 }, cfg, sent1 + 4 * D), { state: 'due', n: 2, dueAtMs: sent1 + 4 * D, existing: false });
  assert.equal(promoNext({ createdAtMs: signed, sent: 2, lastAtMs: sent1 + 4 * D }, cfg, sent1 + 8 * D).n, 3);
  assert.equal(promoNext({ createdAtMs: signed, sent: 3, lastAtMs: sent1 + 8 * D }, cfg, sent1 + 90 * D).state, 'done');
  assert.equal(promoNext({ createdAtMs: signed, sent: 1, lastAtMs: sent1 }, { ...cfg, maxSends: 1 }, sent1 + 90 * D).state, 'done');
});

test('promoNext: people who signed up before it was switched on — next run with "existing" on, never with it off', () => {
  const cfg = { ...PROMO_DEFAULTS, enabledAt: iso(T0) };
  const old = T0 - 200 * D;
  assert.deepEqual(promoNext({ createdAtMs: old, sent: 0 }, cfg, T0 + 60000), { state: 'due', n: 1, dueAtMs: old + 24 * H, existing: true });
  assert.equal(promoNext({ createdAtMs: old, sent: 0 }, { ...cfg, includeExisting: false }, T0 + 60000).state, 'excluded');
  // signed up 2 hours before the switch: still waits for its 24 hours
  assert.equal(promoNext({ createdAtMs: T0 - 2 * H, sent: 0 }, cfg, T0 + H).state, 'waiting');
  // an existing person already in the series keeps going even if the setting goes off
  assert.equal(promoNext({ createdAtMs: old, sent: 1, lastAtMs: T0 }, { ...cfg, includeExisting: false }, T0 + 8 * D).state, 'due');
});

test('promoProgress: distinct emails per person (a WhatsApp twin is the same step), latest time + Resend id, stop rows', () => {
  const rows = [
    { run_id: 'u1', dedupe_key: promoKey('u1', 1), created_at: iso(T0), resend_id: 're1', status: 'sent', channel: 'email' },
    { run_id: 'u1', dedupe_key: `${promoKey('u1', 1)}:wa`, created_at: iso(T0 + 1000), status: 'sent', channel: 'whatsapp' },
    { run_id: 'u1', dedupe_key: promoKey('u1', 2), created_at: iso(T0 + 3 * D), resend_id: 're2', status: 'sent', channel: 'email' },
    { run_id: 'u2', dedupe_key: promoKey('u2', 1), created_at: iso(T0), resend_id: 're3', status: 'sending', channel: 'email' },
    { run_id: 'u3', dedupe_key: promoStopKey('u3'), subject: 'unsubscribed', status: 'sent', channel: 'event' },
    { run_id: 'u4', dedupe_key: 'something-else', status: 'sent' },
  ];
  const p = promoProgress(rows);
  assert.equal(p.get('u1').sent, 2);
  assert.equal(p.get('u1').lastAtMs, T0 + 3 * D);
  assert.equal(p.get('u1').lastResendId, 're2');
  assert.equal(p.get('u2').sent, 1, 'a claimed (sending) email counts — never sent twice');
  assert.equal(p.get('u3').stop, 'unsubscribed');
  assert.equal(p.get('u3').sent, 0);
  assert.equal(p.has('u4'), false);
});

test('roundDownProof + schedule text', () => {
  assert.equal(roundDownProof(3687), '3.600');
  assert.equal(roundDownProof(187), '180');
  assert.equal(roundDownProof(42), '42');
  assert.equal(promoScheduleText({ firstAfterHours: 24, everyDays: 7, maxSends: 3 }), '1 day after sign-up, then every 7 days · up to 3 emails');
  assert.equal(promoScheduleText({ firstAfterHours: 6, everyDays: 3, maxSends: 1 }), 'one email 6 hours after sign-up');
});

test('the default email: every {{variable}} it uses exists, it renders the real settings, opt-out line, no banned phrases', () => {
  const known = new Set(templateVars.map((v) => v.key));
  for (const f of ['subject', 'heading', 'body', 'button_label', 'button_url']) {
    for (const m of String(PROMO_TEMPLATE[f] || '').matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) assert.ok(known.has(m[1]), `${f}: {{${m[1]}}}`);
  }
  const all = Object.values(PROMO_TEMPLATE).join(' ');
  assert.match(all, /Casa-Libre/);
  assert.doesNotMatch(all, /Casa Libre/, 'brand is written with the hyphen');
  for (const banned of [/de mayor crecimiento/i, /tecnolog[ií]a l[ií]der/i, /por fin lleg[oó]/i, /recl[aá]m[aá] tu aviso/i, /gratis para siempre/i, /sin l[ií]mite/i]) assert.doesNotMatch(all, banned);
  assert.doesNotMatch(all, /\b30 días\b|\b3 personas\b/, 'no hard-coded reward numbers');
  assert.match(PROMO_TEMPLATE.body, /\{\{unsubscribe_url\}\}/);
  assert.match(PROMO_TEMPLATE.subject, /Casa-Libre/, 'hook: benefit + brand in the subject');
});

// ── the hourly run ─────────────────────────────────────────────────────────────────
const user = (id, createdAtMs, extra = {}) => ({ id, email: `${id}@example.com`, full_name: `${id[0].toUpperCase()}${id.slice(1)} Pérez`, verified: true, active: true, created_at: iso(createdAtMs), ...extra });

function world({ settings = {}, row = {}, referral = {}, referralRow = {}, users = [] } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [{ id: 'tpl-promo', ...PROMO_TEMPLATE, is_active: true }]);
  db.seed('automations', [
    { id: PROMO_ID, enabled: true, enabled_at: iso(T0 - 60 * D), template_id: 'tpl-promo', free_tiers: [{ firstAfterHours: 24, everyDays: 3, maxSends: 3, includeExisting: true, perRun: 100, ...settings }], ...row },
    { id: 'referrals', enabled: true, enabled_at: iso(T0 - 90 * D), free_tiers: [{ referrer: { enabled: true, plan: 'verified', days: 45 }, newUser: { enabled: true, plan: 'verified', days: 20 }, milestone: { enabled: true, every: 5, plan: 'home', days: 14 }, ...referral }], ...referralRow },
  ]);
  db.seed('users', users);
  db.seed('properties', Array.from({ length: 123 }, (_, i) => ({ id: `p${i}`, admin_status: 'active', status: 'published', origin: 'scraper', created_by: null })));
  const mails = [];
  let fail = false;
  const deliver = async (m) => { if (fail) return { ok: false, error: 'resend_down' }; mails.push(m); return { ok: true, id: `re_${mails.length}` }; };
  const run = async (atMs, extra = {}) => {
    const [automation] = await db.select('automations', `id=eq.${PROMO_ID}`);
    const [referralNow] = await db.select('automations', 'id=eq.referrals');
    return runReferralPromo({
      db, automation, referralRow: referralNow, templates: await db.select('email_templates', ''), now: new Date(atMs), deliver, frame: {}, siteUrl: SITE,
      unsubscribeUrl: (u) => `${SITE}/api/referral-promo/stop?token=t-${u.id}`, ...extra,
    });
  };
  const sends = (uid) => db.tables.email_log?.filter((l) => String(l.run_id) === uid && /^refpromo:/.test(l.dedupe_key)) || [];
  // move every send of a person back in time (simulates the days passing)
  const age = (uid, ms) => { for (const l of sends(uid)) l.created_at = iso(Date.parse(l.created_at) - ms); };
  return { db, mails, run, sends, age, setFail: (v) => { fail = v; } };
}

test('first email 24 hours after sign-up — not before — with the real program settings, the link and the opt-out', async () => {
  const w = world({ users: [user('ana', T0 - 23 * H)] });
  assert.equal((await w.run(T0)).sent, 0, '23 hours after sign-up: nothing');
  assert.equal(w.mails.length, 0);
  const r = await w.run(T0 + H + 60000);
  assert.equal(r.sent, 1, JSON.stringify(r));
  const m = w.mails[0];
  assert.equal(m.subject, 'Invitá a alguien a publicar en Casa-Libre y ganá la insignia Verificada gratis');
  assert.equal(m.to, 'ana@example.com');
  assert.match(m.text, /Hola Ana,/);
  assert.match(m.text, /durante 45 días/, 'referrer reward days from the settings');
  assert.match(m.text, /recibe 20 días/, 'new member days from the settings');
  assert.match(m.text, /5 invitados/);
  assert.match(m.text, /durante 14 días/);
  assert.doesNotMatch(m.text, /propiedades activas/, 'no live-listings count line');
  assert.ok(m.text.includes(`/ref/${codeFor('ana')}`), 'their own referral link');
  assert.match(m.html, /api\/referral-promo\/stop\?token=t-ana/);
  assert.match(m.html, /cuenta\/referidos/);
  // the link works: the code row exists
  assert.ok(w.db.tables.email_log.some((l) => l.dedupe_key === 'ref:code:ana:ev'));
  assert.deepEqual(w.sends('ana').map((l) => l.dedupe_key), ['refpromo:ana:1']);
});

test('repeats every N days up to the maximum; a retry never sends twice', async () => {
  const w = world({ settings: { everyDays: 3, maxSends: 3 }, users: [user('bo', T0 - 2 * D)] });
  await w.run(T0);
  await w.run(T0); await w.run(T0 + 60000);                         // retries in the same hour
  assert.equal(w.mails.length, 1, 'once');
  assert.equal((await w.run(T0 + 3 * D - H)).sent, 0, 'before 3 days: nothing');
  assert.equal((await w.run(T0 + 3 * D + 60000)).sent, 1, '2nd after 3 days');
  w.age('bo', 3 * D);                                              // the 2nd went out 3 days ago
  assert.equal((await w.run(T0 + 3 * D + 120000)).sent, 1, '3rd');
  w.age('bo', 30 * D);
  const r = await w.run(T0 + 4 * D);
  assert.equal(r.sent, 0, 'no 4th');
  assert.equal(r.counts.finished, 1);
  assert.deepEqual(w.sends('bo').map((l) => l.dedupe_key).sort(), ['refpromo:bo:1', 'refpromo:bo:2', 'refpromo:bo:3']);
});

test('stops early: referred someone, unsubscribed, BAJA on WhatsApp, account closed or deleted', async () => {
  const w = world({ users: [user('ref', T0 - 5 * D), user('uns', T0 - 5 * D), user('baja', T0 - 5 * D), user('gone', T0 - 5 * D), user('del', T0 - 5 * D), user('ok', T0 - 5 * D)] });
  assert.equal((await w.run(T0)).sent, 6);
  // after the first email: one referred somebody, one unsubscribed, one replied BAJA, one closed, one deleted
  w.db.seed('email_log', [{ automation_id: 'referrals', template_key: 'ref_person', dedupe_key: 'ref:person:newbie:ev', run_id: 'ref', to_email: 'newbie@example.com', subject: 'signed_up', status: 'sent', channel: 'event' }]);
  assert.equal(await stopPromo(w.db, { id: 'uns', email: 'uns@example.com' }), 'stopped');
  assert.equal(await stopPromo(w.db, { id: 'uns', email: 'uns@example.com' }), 'already');
  const u = w.db.tables.users;
  u.find((x) => x.id === 'baja').whatsapp_opted_out_at = iso(T0);
  u.find((x) => x.id === 'gone').active = false;
  u.find((x) => x.id === 'del').email = 'deleted-del@deleted.invalid';
  for (const id of ['ref', 'uns', 'baja', 'gone', 'del', 'ok']) w.age(id, 4 * D);
  const r = await w.run(T0 + 60000);
  assert.equal(r.sent, 1, JSON.stringify(r));
  assert.equal(w.mails[w.mails.length - 1].to, 'ok@example.com');
  assert.equal(r.counts.referred, 1);
  assert.equal(r.counts.optedOut, 2);
  assert.equal(r.counts.closed, 2);
});

test('bounce / spam complaint on the previous email: no more emails (recorded once, not looked up again)', async () => {
  const w = world({ users: [user('bou', T0 - 5 * D), user('spam', T0 - 5 * D), user('fine', T0 - 5 * D)] });
  await w.run(T0);
  const ids = Object.fromEntries(w.sends('bou').concat(w.sends('spam'), w.sends('fine')).map((l) => [l.run_id, l.resend_id]));
  for (const id of ['bou', 'spam', 'fine']) w.age(id, 4 * D);
  const looked = [];
  const emailStatus = async (rid) => { looked.push(rid); return rid === ids.bou ? 'bounced' : rid === ids.spam ? 'complained' : 'delivered'; };
  const r = await w.run(T0 + 60000, { emailStatus });
  assert.equal(r.sent, 1);
  assert.equal(r.stopped, 2);
  assert.deepEqual(w.db.tables.email_log.filter((l) => l.dedupe_key.startsWith('refpromo-stop:')).map((l) => `${l.run_id}:${l.subject}`).sort(), ['bou:bounced', 'spam:complained']);
  for (const id of ['fine']) w.age(id, 4 * D);
  looked.length = 0;
  const r2 = await w.run(T0 + 120000, { emailStatus });
  assert.equal(r2.sent, 1, 'only the fine one');
  const fineLatest = w.sends('fine').filter((l) => l.dedupe_key === 'refpromo:fine:2')[0].resend_id;
  assert.deepEqual(looked, [fineLatest], 'only the latest email of the one still in the series; the stopped people are not looked up again');
  // status unknown (no read key) → the repeat goes out
  const w2 = world({ users: [user('x', T0 - 5 * D)] });
  await w2.run(T0); w2.age('x', 4 * D);
  assert.equal((await w2.run(T0 + 60000, { emailStatus: async () => null })).sent, 1);
});

test('existing users are paced: at most perRun per run, repeats and new sign-ups first, then the newest old accounts', async () => {
  const enabledAt = T0 - 2 * D;
  const old = [1, 2, 3, 4, 5].map((i) => user(`old${i}`, T0 - (100 + i) * D));   // old1 is the newest
  const w = world({ row: { enabled_at: iso(enabledAt) }, settings: { perRun: 2 }, users: [...old, user('fresh', T0 - 25 * H)] });
  const r1 = await w.run(T0);
  assert.equal(r1.sent, 2);
  assert.equal(r1.held, 4, 'the rest wait for the next run');
  assert.deepEqual(w.mails.map((m) => m.to), ['fresh@example.com', 'old1@example.com'], 'the new sign-up before the old accounts');
  assert.equal((await w.run(T0 + H)).sent, 2);
  assert.equal((await w.run(T0 + 2 * H)).sent, 2);
  assert.equal((await w.run(T0 + 3 * H)).sent, 0);
  assert.deepEqual(w.mails.map((m) => m.to.replace('@example.com', '')), ['fresh', 'old1', 'old2', 'old3', 'old4', 'old5']);
});

test('"also existing users" off: only people who signed up after it was switched on', async () => {
  const w = world({ row: { enabled_at: iso(T0 - 3 * D) }, settings: { includeExisting: false }, users: [user('before', T0 - 10 * D), user('after', T0 - 2 * D)] });
  const r = await w.run(T0);
  assert.equal(r.sent, 1);
  assert.equal(w.mails[0].to, 'after@example.com');
});

test('program off, promo off, referrer reward off, template off, quiet hours: nothing is sent', async () => {
  const people = [user('a1', T0 - 5 * D)];
  for (const [opts, reason] of [
    [{ referralRow: { enabled: false } }, 'referrals_off'],
    [{ referralRow: { enabled: true }, referral: { referrer: { enabled: false } } }, 'referrer_reward_off'],
    [{ row: { enabled: false } }, 'disabled'],
  ]) {
    const w = world({ ...opts, users: people });
    const r = await w.run(T0);
    assert.equal(r.skippedReason, reason);
    assert.equal(w.mails.length, 0);
  }
  const w = world({ users: people });
  w.db.tables.email_templates[0].is_active = false;
  assert.equal((await w.run(T0)).skippedReason, 'no_template');
  const q = world({ users: people });
  const r = await q.run(T0, { frame: { quiet: true } });
  assert.equal(r.skippedReason, 'quiet_hours');
  assert.equal(q.mails.length, 0);
  assert.equal((q.db.tables.email_log || []).length, 0, 'nothing claimed at night');
  assert.equal((await q.run(T0 + 12 * H)).sent, 1, 'the first daytime run sends it');
  const none = await runReferralPromo({ db: createStore(AUTOMATION_SCHEMA), automation: null, referralRow: null, now: new Date(T0) });
  assert.equal(none.skippedReason, 'not_set_up');
});

test('only verified accounts; with "only people with a live listing", only those', async () => {
  const w = world({ referral: { requireReferrerListing: true }, users: [user('lister', T0 - 5 * D), user('nolist', T0 - 5 * D), user('unver', T0 - 5 * D, { verified: false })] });
  w.db.seed('properties', [{ id: 'lp', created_by: 'lister', origin: 'user', status: 'published', admin_status: 'active', is_complete: true, is_delisted: false }]);
  const r = await w.run(T0);
  assert.equal(r.sent, 1);
  assert.equal(w.mails[0].to, 'lister@example.com');
  assert.equal(r.counts.noListing, 1);
});

test('a failed send frees the claim and counts toward the run limit; the next run sends it', async () => {
  const w = world({ settings: { perRun: 1 }, users: [user('f1', T0 - 5 * D), user('f2', T0 - 6 * D)] });
  w.setFail(true);
  const r = await w.run(T0);
  assert.equal(r.failed, 1);
  assert.equal(r.sent, 0);
  assert.equal(r.held, 1);
  w.setFail(false);
  assert.equal((await w.run(T0 + H)).sent, 1);
  assert.equal((await w.run(T0 + 2 * H)).sent, 1);
  assert.deepEqual(w.mails.map((m) => m.to).sort(), ['f1@example.com', 'f2@example.com']);
});

test('pickPromo: the test audience prefix limits who is considered', () => {
  const cfg = promoConfig({ enabled: true, enabled_at: iso(T0 - D), free_tiers: [{}] });
  const { due, counts } = pickPromo({ users: [user('e2e-a', T0 - 5 * D, { email: 'refpromo-e2e-a@example.com' }), user('real', T0 - 5 * D)], cfg, nowMs: T0, testAudience: 'refpromo-e2e-' });
  assert.equal(counts.checked, 1);
  assert.deepEqual(due.map((d) => d.user.id), ['e2e-a']);
});

test('the rendered default template (website renderer) puts the opt-out link and the button in the email', () => {
  const vars = { name: 'Ana', referral_url: `${SITE}/ref/abcd2345`, referrals_url: `${SITE}/cuenta/referidos`, reward_plan: 'la insignia Verificada', reward_days: '30', new_user_days: '30', milestone_count: '3', milestone_days: '30', active_listings: '2.400', unsubscribe_url: `${SITE}/api/referral-promo/stop?token=x` };
  const m = renderTemplate(PROMO_TEMPLATE, vars, { tld: '.py', utm: { campaign: PROMO_ID, content: PROMO_TEMPLATE.key } });
  assert.match(m.html, /Compartir mi link/);
  assert.match(m.html, /referral-promo\/stop\?token=x/);
  assert.match(m.text, /Para no recibir más estos correos, tocá acá/);
  assert.match(m.html, /utm_campaign=referral_promo/);
});
