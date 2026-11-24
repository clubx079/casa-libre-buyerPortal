// "New: share your listing" announcement — schedule (lib/shareFeature.js), the test-account
// rules (lib/internalAccounts.js) and the hourly run (lib/automations/shareFeature.js) against
// the in-memory PostgREST.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, AUTOMATION_SCHEMA } from './support/fakePostgrest.mjs';
import {
  SHARE_FEATURE_ID, SHARE_FEATURE_TEMPLATE, SHARE_FEATURE_DEFAULTS, SHARE_FEATURE_DEMO_URL, shareFeatureConfig, shareFeatureNext,
  shareFeatureProgress, shareFeatureKey, shareFeatureStopKey, shareFeatureScheduleText, shareFeatureListingsUrl,
} from '../lib/shareFeature.js';
import { runShareFeature, pickShareFeature } from '../lib/automations/shareFeature.js';
import { isInternalAccount, isInternalPhone, readMarkedTestEmails } from '../lib/internalAccounts.js';
import { renderTemplate, templateVars } from '../lib/emailTemplateRender.js';

const H = 3600e3;
const D = 24 * H;
const T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const SITE = 'https://casa-libre.com.py';

// ── the pure schedule ─────────────────────────────────────────────────────────────
test('config: defaults (24 h after sign-up, every 48 h, no limit, 100 per run) and clamping', () => {
  const d = shareFeatureConfig({ id: SHARE_FEATURE_ID, enabled: true, enabled_at: iso(T0) });
  assert.deepEqual({ ...d, enabledAt: null }, { exists: true, enabled: true, enabledAt: null, templateId: null, ...SHARE_FEATURE_DEFAULTS });
  assert.equal(SHARE_FEATURE_DEFAULTS.everyHours, 48);
  assert.equal(SHARE_FEATURE_DEFAULTS.maxSends, 0, '0 = no limit by default');
  const c = shareFeatureConfig({ enabled: true, enabled_at: iso(T0), free_tiers: [{ firstAfterHours: 0, everyHours: 5000, maxSends: 4, perRun: 0 }] });
  assert.equal(c.firstAfterHours, 0);
  assert.equal(c.everyHours, 48, 'out of range → default');
  assert.equal(c.maxSends, 4);
  assert.equal(c.perRun, 100);
  assert.equal(shareFeatureConfig({ free_tiers: [{ maxSends: 0 }] }).maxSends, 0);
  assert.equal(shareFeatureConfig({ free_tiers: [{ maxSends: '' }] }).maxSends, 0);
  assert.equal(shareFeatureConfig({ free_tiers: [{ everyHours: 72 }] }).everyHours, 72);
  assert.equal(shareFeatureConfig({ enabled: true }).enabled, false, 'on without enabled_at is not on');
  assert.equal(shareFeatureConfig(null).exists, false);
});

test('next due: accounts that existed at switch-on right away; later sign-ups after the wait; then every N hours', () => {
  const enabledAt = T0 - 10 * D;
  const cfg = { ...SHARE_FEATURE_DEFAULTS, enabledAt: iso(enabledAt) };
  const old = enabledAt - 100 * D;
  assert.deepEqual(shareFeatureNext({ createdAtMs: old, sent: 0 }, cfg, enabledAt + 60000), { state: 'due', n: 1, dueAtMs: enabledAt, existing: true });
  const signed = enabledAt + D;
  assert.equal(shareFeatureNext({ createdAtMs: signed, sent: 0 }, cfg, signed + 23 * H).state, 'waiting');
  assert.deepEqual(shareFeatureNext({ createdAtMs: signed, sent: 0 }, cfg, signed + 24 * H), { state: 'due', n: 1, dueAtMs: signed + 24 * H, existing: false });
  const last = T0 - 47 * H;
  assert.equal(shareFeatureNext({ createdAtMs: old, sent: 1, lastAtMs: last }, cfg, T0).state, 'waiting', '47 h after the last one');
  assert.deepEqual(shareFeatureNext({ createdAtMs: old, sent: 1, lastAtMs: last }, cfg, last + 48 * H), { state: 'due', n: 2, dueAtMs: last + 48 * H, existing: true });
  assert.equal(shareFeatureNext({ createdAtMs: old, sent: 1, lastAtMs: last }, { ...cfg, everyHours: 6 }, last + 6 * H).state, 'due', 'interval is a setting');
  assert.equal(shareFeatureNext({ createdAtMs: NaN, sent: 0 }, cfg, T0).state, 'excluded');
});

test('count limit: stops at maxSends; 0 = no limit', () => {
  const cfg = { ...SHARE_FEATURE_DEFAULTS, enabledAt: iso(T0 - 400 * D) };
  const created = T0 - 500 * D;
  assert.equal(shareFeatureNext({ createdAtMs: created, sent: 3, lastAtMs: T0 - 100 * D }, { ...cfg, maxSends: 3 }, T0).state, 'done');
  assert.equal(shareFeatureNext({ createdAtMs: created, sent: 2, lastAtMs: T0 - 100 * D }, { ...cfg, maxSends: 3 }, T0).n, 3);
  const unlimited = shareFeatureNext({ createdAtMs: created, sent: 150, lastAtMs: T0 - 49 * H }, { ...cfg, maxSends: 0 }, T0);
  assert.deepEqual([unlimited.state, unlimited.n], ['due', 151]);
  assert.equal(shareFeatureScheduleText({ ...cfg, maxSends: 0 }), 'first email at the next daytime run, then every 2 days · no limit');
  assert.equal(shareFeatureScheduleText({ ...cfg, everyHours: 36, maxSends: 5 }), 'first email at the next daytime run, then every 36 hours · up to 5 emails per person');
});

test('progress: distinct emails per person, latest time + Resend id; ours and the referral promo\'s stop rows', () => {
  const p = shareFeatureProgress([
    { run_id: 'u1', dedupe_key: shareFeatureKey('u1', 1), created_at: iso(T0), resend_id: 're1', status: 'sent' },
    { run_id: 'u1', dedupe_key: shareFeatureKey('u1', 2), created_at: iso(T0 + 2 * D), resend_id: 're2', status: 'sent' },
    { run_id: 'u1', dedupe_key: shareFeatureKey('u1', 3), created_at: iso(T0 + 4 * D), status: 'failed' },
    { run_id: 'u2', dedupe_key: shareFeatureStopKey('u2'), subject: 'bounced', status: 'sent', channel: 'event' },
    { run_id: 'u3', dedupe_key: 'refpromo-stop:u3:ev', subject: 'unsubscribed', status: 'sent', channel: 'event' },
    { run_id: 'u4', dedupe_key: 'refpromo:u4:1', status: 'sent' },
  ]);
  assert.equal(p.get('u1').sent, 2);
  assert.equal(p.get('u1').lastAtMs, T0 + 2 * D);
  assert.equal(p.get('u1').lastResendId, 're2');
  assert.equal(p.get('u2').stop, 'bounced');
  assert.equal(p.get('u3').stop, 'unsubscribed');
  assert.equal(p.has('u4'), false, 'another automation\'s emails do not count');
});

test('test / team accounts: team emails + domains, .pk, marked in the admin, the test number, +92 numbers', () => {
  const marked = new Set(['tester@gmail.com']);
  for (const u of [
    { email: 'omar@airosofts.com' }, { email: 'someone@airosofts.com' }, { email: 'x@ableman.co' }, { email: 'a@b.pk' },
    { email: 'Tester@Gmail.com' }, { email: 'p@example.com', phone: '+92 336 2771289' }, { email: 'q@example.com', phone: '923001234567' },
    { email: 'r@example.com', full_name: 'Omar New' },
  ]) assert.equal(isInternalAccount(u, marked), true, JSON.stringify(u));
  for (const u of [{ email: 'ana@gmail.com', phone: '+595981123456' }, { email: 'b@example.com', phone: '0992123456' }, { email: 'c@example.com', phone: '992123456' }]) {
    assert.equal(isInternalAccount(u, marked), false, JSON.stringify(u));
  }
  assert.equal(isInternalPhone('+923362771289'), true);
});

test('the default email: known variables, demo button, UTM-tagged main button, hyphenated brand, no opt-out line, no emojis', () => {
  const known = new Set(templateVars.map((v) => v.key));
  for (const f of ['subject', 'heading', 'body', 'button_label', 'button_url']) {
    for (const m of String(SHARE_FEATURE_TEMPLATE[f] || '').matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) assert.ok(known.has(m[1]), `${f}: {{${m[1]}}}`);
  }
  const all = Object.values(SHARE_FEATURE_TEMPLATE).join(' ');
  assert.match(SHARE_FEATURE_TEMPLATE.subject, /Casa-Libre/);
  assert.doesNotMatch(all, /Casa Libre/);
  assert.doesNotMatch(all, /BAJA|unsubscribe|Para no recibir|darte de baja/i);
  assert.doesNotMatch(all, /\p{Extended_Pictographic}/u, 'no emojis');
  assert.match(all, /iPhone y Android/);
  const msg = renderTemplate(SHARE_FEATURE_TEMPLATE, { name: 'Ana', my_listings_url: shareFeatureListingsUrl(SITE + '/') }, { utm: { campaign: SHARE_FEATURE_ID, content: SHARE_FEATURE_TEMPLATE.key } });
  assert.match(msg.text, /Hola Ana,/);
  assert.ok(msg.html.includes(`href="${SHARE_FEATURE_DEMO_URL}"`), 'Ver la demo → YouTube, untouched');
  assert.ok(msg.html.includes('cuenta/publicaciones?utm_source=email&amp;utm_medium=automation&amp;utm_campaign=share_feature'), 'main button keeps its own UTM tags');
  assert.match(msg.html, /WhatsApp, Instagram, Gmail, X o un link/, 'preheader');
  assert.equal(SHARE_FEATURE_TEMPLATE.button_url, '{{my_listings_url}}', 'a bare link variable: the admin template editor accepts it');
});

// ── the hourly run ─────────────────────────────────────────────────────────────────
const user = (id, createdAtMs, extra = {}) => ({ id, email: `${id}@example.com`, full_name: `${id[0].toUpperCase()}${id.slice(1)} Pérez`, verified: true, active: true, created_at: iso(createdAtMs), ...extra });

function world({ settings = {}, row = {}, users = [], marked = [] } = {}) {
  const db = createStore(AUTOMATION_SCHEMA);
  db.seed('email_templates', [{ id: 'tpl-sf', ...SHARE_FEATURE_TEMPLATE, is_active: true }]);
  db.seed('automations', [
    { id: SHARE_FEATURE_ID, enabled: true, enabled_at: iso(T0 - 60 * D), template_id: 'tpl-sf', free_tiers: [{ ...SHARE_FEATURE_DEFAULTS, ...settings }], ...row },
    { id: 'test_accounts', enabled: false, free_tiers: [{ emails: Object.fromEntries(marked.map((e) => [e, { at: iso(T0), by: 'admin' }])) }] },
  ]);
  db.seed('users', users);
  const mails = [];
  let fail = false;
  const deliver = async (m) => { if (fail) return { ok: false, error: 'resend_down' }; mails.push(m); return { ok: true, id: `re_${mails.length}` }; };
  const run = async (atMs, extra = {}) => {
    const [automation] = await db.select('automations', `id=eq.${SHARE_FEATURE_ID}`);
    return runShareFeature({
      db, automation, templates: await db.select('email_templates', ''), now: new Date(atMs), deliver, frame: {}, siteUrl: SITE,
      markedTestEmails: () => readMarkedTestEmails(db), ...extra,
    });
  };
  const sends = (uid) => db.tables.email_log?.filter((l) => String(l.run_id) === uid && /^sharefeature:/.test(l.dedupe_key)) || [];
  const age = (uid, ms) => { for (const l of sends(uid)) l.created_at = iso(Date.parse(l.created_at) - ms); };
  return { db, mails, run, sends, age, setFail: (v) => { fail = v; } };
}

test('sends to verified members with the right link; every 48 h; a retry never sends twice; unlimited keeps going', async () => {
  const w = world({ users: [user('ana', T0 - 100 * D), user('unver', T0 - 100 * D, { verified: false })] });
  const r = await w.run(T0);
  assert.equal(r.sent, 1, JSON.stringify(r));
  const m = w.mails[0];
  assert.equal(m.to, 'ana@example.com');
  assert.equal(m.subject, SHARE_FEATURE_TEMPLATE.subject);
  assert.match(m.text, /Hola Ana,/);
  assert.match(m.html, /casa-libre\.com\.py\/cuenta\/publicaciones\?utm_source=email&amp;utm_medium=automation&amp;utm_campaign=share_feature&amp;utm_content=share-feature-promo"/);
  assert.equal(w.sends('ana')[0].dedupe_key, 'sharefeature:ana:1');
  assert.equal(w.sends('ana')[0].automation_id, SHARE_FEATURE_ID);
  await w.run(T0 + 60000); await w.run(T0 + 2 * H);
  assert.equal(w.mails.length, 1, 'once until the interval passes');
  for (let n = 2; n <= 6; n++) {
    w.age('ana', 47 * H);
    assert.equal((await w.run(T0)).sent, 0, `47 h: not yet (#${n})`);
    w.age('ana', H);
    assert.equal((await w.run(T0 + 60000)).sent, 1, `48 h: #${n}`);
  }
  assert.deepEqual(w.sends('ana').map((l) => l.dedupe_key), [1, 2, 3, 4, 5, 6].map((n) => `sharefeature:ana:${n}`));
});

test('number of times: stops after maxSends', async () => {
  const w = world({ settings: { maxSends: 2, everyHours: 24 }, users: [user('bo', T0 - 100 * D)] });
  await w.run(T0); w.age('bo', 25 * H);
  await w.run(T0); w.age('bo', 25 * H);
  const r = await w.run(T0);
  assert.equal(r.sent, 0);
  assert.equal(r.counts.finished, 1);
  assert.equal(w.mails.length, 2);
});

test('exclusions: test / team accounts, closed, blocked, deleted, BAJA, bounced or opted out (ours or the referral promo\'s)', async () => {
  const w = world({
    marked: ['marked@example.com'],
    users: [
      user('ok', T0 - 100 * D),
      user('team', T0 - 100 * D, { email: 'omar@airosofts.com' }),
      user('dom', T0 - 100 * D, { email: 'dev@airosofts.com' }),
      user('marked', T0 - 100 * D),
      user('phone', T0 - 100 * D, { phone: '+923362771289' }),
      user('gone', T0 - 100 * D, { active: false }),
      user('blk', T0 - 100 * D, { blocked: true }),
      user('del', T0 - 100 * D, { email: 'deleted-del@deleted.invalid' }),
      user('baja', T0 - 100 * D, { whatsapp_opted_out_at: iso(T0 - D) }),
      user('refstop', T0 - 100 * D),
      user('bounce', T0 - 100 * D),
    ],
  });
  w.db.seed('email_log', [
    { automation_id: 'referral_promo', channel: 'event', status: 'sent', template_key: 'refpromo_stop', dedupe_key: 'refpromo-stop:refstop:ev', run_id: 'refstop', to_email: 'refstop@example.com', subject: 'unsubscribed' },
    { automation_id: SHARE_FEATURE_ID, channel: 'event', status: 'sent', template_key: 'sharefeature_stop', dedupe_key: shareFeatureStopKey('bounce'), run_id: 'bounce', to_email: 'bounce@example.com', subject: 'bounced' },
  ]);
  const r = await w.run(T0);
  assert.equal(r.sent, 1, JSON.stringify(r));
  assert.deepEqual(w.mails.map((m) => m.to), ['ok@example.com']);
  assert.equal(r.counts.internal, 4);
  assert.equal(r.counts.closed, 3);
  assert.equal(r.counts.optedOut, 2);
  assert.equal(r.counts.bounced, 1);
});

test('bounce / complaint on the previous email stops the repeats (recorded once)', async () => {
  const w = world({ users: [user('bou', T0 - 100 * D), user('fine', T0 - 100 * D)] });
  await w.run(T0);
  const bad = w.sends('bou')[0].resend_id;
  w.age('bou', 49 * H); w.age('fine', 49 * H);
  const r = await w.run(T0, { emailStatus: async (id) => (id === bad ? 'bounced' : 'delivered') });
  assert.equal(r.sent, 1);
  assert.equal(r.stopped, 1);
  assert.ok(w.db.tables.email_log.some((l) => l.dedupe_key === 'sharefeature-stop:bou:ev' && l.subject === 'bounced'));
});

test('pacing, override, quiet hours, off / no template / not set up', async () => {
  const people = [1, 2, 3, 4, 5].map((i) => user(`p${i}`, T0 - (100 + i) * D));
  const w = world({ settings: { perRun: 2 }, users: people });
  const r1 = await w.run(T0);
  assert.equal(r1.sent, 2);
  assert.equal(r1.held, 3);
  assert.deepEqual(w.mails.map((m) => m.to), ['p1@example.com', 'p2@example.com'], 'newest old accounts first');
  const o = world({ users: [user('ov', T0 - 100 * D)] });
  await o.run(T0, { emailOverride: 'qa@example.com' });
  assert.equal(o.mails[0].to, 'qa@example.com', 'AUTOMATION_EMAIL_OVERRIDE');
  const q = world({ users: [user('q', T0 - 100 * D)] });
  assert.equal((await q.run(T0, { frame: { quiet: true } })).skippedReason, 'quiet_hours');
  assert.equal((q.db.tables.email_log || []).length, 0, 'nothing claimed at night');
  assert.equal((await world({ row: { enabled: false }, users: people }).run(T0)).skippedReason, 'disabled');
  const nt = world({ users: people });
  nt.db.tables.email_templates[0].is_active = false;
  assert.equal((await nt.run(T0)).skippedReason, 'no_template');
  assert.equal((await runShareFeature({ db: createStore(AUTOMATION_SCHEMA), automation: null, now: new Date(T0) })).skippedReason, 'not_set_up');
  const f = world({ users: [user('ff', T0 - 100 * D)] });
  f.setFail(true);
  assert.equal((await f.run(T0)).failed, 1);
  f.setFail(false);
  assert.equal((await f.run(T0 + 60000)).sent, 1, 'a failed send is retried');
});

test('pickShareFeature: later sign-ups wait for firstAfterHours', () => {
  const cfg = { ...SHARE_FEATURE_DEFAULTS, enabled: true, enabledAt: iso(T0 - D) };
  const { due, counts } = pickShareFeature({ users: [user('new', T0 - 2 * H)], cfg, nowMs: T0 });
  assert.equal(due.length, 0);
  assert.equal(counts.waiting, 1);
});
