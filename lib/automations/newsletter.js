// Weekly Casa-Libre newsletter (automations row 'weekly_newsletter', created by the admin's
// Automations page; OFF until switched on). Run by the hourly automations cron.
// Settings live in automations.free_tiers[0] (no new column — the same trick as alerts_state):
//   { day: 0–6 (local weekday, 0 = Sunday), hour: 9–18 (local),
//     rotation: [{ template_id, audience }], next: index of the next rotation entry,
//     issue: { week, template_id, audience, index, vars, started_at, done } }   ← written here
//
//   • Once a week, on `day` at/after `hour` (country time zone), the next rotation entry starts
//     an "issue": its template + audience + the week's numbers (lib/newsletter/insights.js),
//     saved BEFORE anything is sent. A template whose {{nl_*}} number couldn't be measured is
//     passed over for the next one (an honest number or no email). The rest of that week every
//     run continues the same issue (≤ limit emails per run) until everyone in the audience got it.
//   • Audiences: everyone | sellers | buyers | never_listed (audienceMatch). users.user_type
//     ('seller' | 'buyer', added by another branch — may not exist yet) wins when set; without
//     it: seller = has ever created a listing, buyer = has not.
//   • Who: users.verified = true, account open, not opted out / bounced (refpromo-stop rows, as
//     every promo email). Each user once per week: email_log dedupe weekly-newsletter:<week>:<user id>.
//   • Night: sendOnce defers (frame.quiet). AUTOMATION_EMAIL_OVERRIDE sends all to the test address.
// Pure + dependency-injected (tests/newsletter.test.mjs).
import { sendOnce } from './sendOnce.js';
import { isDeletedEmail } from '../accountDeletion.js';

export const NEWSLETTER_ID = 'weekly_newsletter';   // ('newsletter' = the one-off broadcasts' email_log id)
export const AUDIENCES = ['everyone', 'sellers', 'buyers', 'never_listed'];
export const DEFAULTS = { day: 2, hour: 10 };   // Tuesday 10:00
const ZONE = { py: 'America/Asuncion', bo: 'America/La_Paz', uy: 'America/Montevideo', ve: 'America/Caracas', sv: 'America/El_Salvador' };
const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const enc = encodeURIComponent;
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const norm = (e) => String(e || '').trim().toLowerCase();
const STOP_KEY = /^refpromo-stop:([^:]+):ev$/;

// The row → settings (defaults filled, rotation cleaned).
export function newsletterConfig(row) {
  const s = row && Array.isArray(row.free_tiers) && row.free_tiers[0] && typeof row.free_tiers[0] === 'object' ? row.free_tiers[0] : {};
  const day = Number.isInteger(s.day) && s.day >= 0 && s.day <= 6 ? s.day : DEFAULTS.day;
  const hour = Number.isInteger(s.hour) && s.hour >= 0 && s.hour <= 23 ? s.hour : DEFAULTS.hour;
  const rotation = (Array.isArray(s.rotation) ? s.rotation : [])
    .filter((r) => r && r.template_id)
    .map((r) => ({ template_id: String(r.template_id), audience: AUDIENCES.includes(r.audience) ? r.audience : 'everyone' }));
  return {
    enabled: !!(row && row.enabled === true && row.enabled_at),
    day, hour, rotation,
    next: Number.isInteger(s.next) && s.next >= 0 ? s.next : 0,
    issue: s.issue && typeof s.issue === 'object' ? s.issue : null,
    state: s,
  };
}

// Local weekday / hour / date in the country's time zone.
export function localParts(now, country = 'py') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE[country] || ZONE.py, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { weekday: DAYS[parts.weekday], hour: Number(parts.hour) % 24, date: `${parts.year}-${parts.month}-${parts.day}` };
}

// ISO week of a YYYY-MM-DD date → '2026-W48'.
export function isoWeek(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

// The {{nl_*}} / {{active_listings}} numbers a template uses that weren't measured.
const NUMBER_VAR = /\{\{\s*((?:nl_[a-z0-9_]+)|active_listings)\s*\}\}/g;
export function missingVars(tpl, vars = {}) {
  const text = ['subject', 'heading', 'body', 'button_label'].map((k) => String(tpl?.[k] ?? '')).join('\n');
  return [...new Set([...text.matchAll(NUMBER_VAR)].map((m) => m[1]))].filter((k) => vars[k] == null || String(vars[k]).trim() === '');
}

// Which rotation entry goes out, starting at `start`: the first whose template exists, is on and
// has all its numbers. → { index, entry, template, skipped: [{ template_id, reason, missing? }] } | null
export function pickIssue({ rotation = [], start = 0, templates = [], vars = {} }) {
  const skipped = [];
  for (let k = 0; k < rotation.length; k++) {
    const index = (start + k) % rotation.length;
    const entry = rotation[index];
    const template = templates.find((t) => String(t.id) === String(entry.template_id));
    if (!template || template.is_active === false) { skipped.push({ template_id: entry.template_id, reason: template ? 'off' : 'missing' }); continue; }
    const missing = missingVars(template, vars);
    if (missing.length) { skipped.push({ template_id: entry.template_id, reason: 'no_numbers', missing }); continue; }
    return { index, entry, template, skipped };
  }
  return null;
}

// What this run does: 'continue' this week's issue, 'start' a new one, or 'wait'.
export function planRun(cfg, now, country = 'py') {
  const p = localParts(now, country);
  const week = isoWeek(p.date);
  if (cfg.issue && cfg.issue.week === week) return { action: cfg.issue.done ? 'done' : 'continue', week, local: p };
  if (p.weekday === cfg.day && p.hour >= cfg.hour) return { action: 'start', week, local: p };
  return { action: 'wait', week, local: p };
}

// The user-type hook: users.user_type ('seller' | 'buyer') when the column exists and is set.
export const userTypeOf = (u) => (u && (u.user_type === 'seller' || u.user_type === 'buyer') ? u.user_type : null);
export function audienceMatch(user, audience, { hasListing = false } = {}) {
  const type = userTypeOf(user);
  switch (audience) {
    case 'sellers': return type ? type === 'seller' : hasListing;
    case 'buyers': return type ? type === 'buyer' : !hasListing;
    case 'never_listed': return !hasListing && type !== 'buyer';
    default: return true;
  }
}

const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);

// THE selection (pure): users of the audience who haven't had this week's email.
export function pickRecipients({ users = [], audience = 'everyone', listers = new Set(), stopped = new Set(), sent = new Set() }) {
  return users.filter((u) => u?.verified === true && !closed(u)
    && !stopped.has(String(u.id)) && !sent.has(String(u.id))
    && audienceMatch(u, audience, { hasListing: listers.has(String(u.id)) }));
}

const USER_COLS = 'id,email,full_name,first_name,verified,active,blocked,suspended,created_at';
async function loadUsers(db, onlyUserIds) {
  const only = Array.isArray(onlyUserIds) && onlyUserIds.length ? `&id=${inList(onlyUserIds)}` : '';
  // users.user_type comes from another branch: read it when the column is there, else without
  try { return await db.select('users', `select=${USER_COLS},user_type&verified=eq.true${only}&order=created_at.asc&limit=20000`); }
  catch { return db.select('users', `select=${USER_COLS}&verified=eq.true${only}&order=created_at.asc&limit=20000`); }
}

// deps: db, automation (row), templates, now, deliver, frame, siteUrl, countryCode, countryName,
// insights: async () => ({ vars }), emailOverride, limit, onlyUserIds (testing), force (start an
// issue now, whatever the day — the admin's "send this week's issue now" / tests).
export async function runNewsletter(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '', countryCode = 'py', countryName = '',
    insights, emailOverride = '', limit = 300, onlyUserIds = null, force = false } = deps;
  const out = { sent: 0, skipped: 0, failed: 0, due: 0 };
  const cfg = newsletterConfig(automation);
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  if (!cfg.rotation.length) return { ...out, skippedReason: 'no_templates' };
  let plan = planRun(cfg, now, countryCode);
  if (force && plan.action !== 'continue') plan = { ...plan, action: 'start' };
  out.week = plan.week;
  if (plan.action === 'wait' || plan.action === 'done') return { ...out, skippedReason: plan.action === 'done' ? 'week_done' : 'not_today' };

  const site = String(siteUrl || '').replace(/\/$/, '');
  let issue = cfg.issue;
  if (plan.action === 'start') {
    const measured = insights ? await insights().catch(() => ({ vars: {} })) : { vars: {} };
    const vars = { ...(measured?.vars || {}) };
    const pick = pickIssue({ rotation: cfg.rotation, start: cfg.next, templates, vars });
    if (!pick) return { ...out, skippedReason: 'nothing_sendable' };
    issue = { week: plan.week, template_id: pick.template.id, audience: pick.entry.audience, index: pick.index, vars, started_at: now.toISOString(), done: false, skipped: pick.skipped };
    // saved before sending: a crash mid-way continues the same issue, never starts another
    await saveState(db, { ...cfg.state, issue, next: (pick.index + 1) % cfg.rotation.length });
    out.started = { template_id: issue.template_id, audience: issue.audience, skipped: pick.skipped };
  }
  const tpl = templates.find((t) => String(t.id) === String(issue.template_id));
  if (!tpl || tpl.is_active === false) return { ...out, skippedReason: 'no_template' };

  const users = await loadUsers(db, onlyUserIds);
  const ids = users.map((u) => String(u.id));
  const listers = new Set();
  const stopped = new Set();
  const sent = new Set();
  for (const part of chunks(ids, 100)) {
    for (const p of await db.select('properties', `select=created_by&origin=eq.user&created_by=${inList(part)}`).catch(() => [])) listers.add(String(p.created_by));
    for (const l of await db.select('email_log', `select=dedupe_key&dedupe_key=${inList(part.map((id) => `refpromo-stop:${id}:ev`))}`).catch(() => [])) {
      const m = STOP_KEY.exec(String(l.dedupe_key || ''));
      if (m) stopped.add(m[1]);
    }
    for (const l of await db.select('email_log', `select=run_id&automation_id=eq.${NEWSLETTER_ID}&dedupe_key=${inList(part.map((id) => `weekly-newsletter:${issue.week}:${id}`))}`).catch(() => [])) sent.add(String(l.run_id));
  }
  const due = pickRecipients({ users, audience: issue.audience, listers, stopped, sent });
  out.due = due.length;
  const shared = {
    ...(issue.vars || {}),
    country_name: countryName,
    newsletter_url: `${site}/newsletter`,
    stories_url: `${site}/newsletter#historias`,
    search_url: `${site}/propiedades`,
    app_url: `${site}/descargar`,
    publish_url: `${site}/publicar`,
    settings_url: `${site}/cuenta/ajustes`,
  };
  let deferred = 0;
  for (const user of due) {
    if (out.sent + out.failed >= limit) break;
    const r = await sendOnce({
      db, automationId: NEWSLETTER_ID, runId: user.id, dedupeKey: `weekly-newsletter:${issue.week}:${user.id}`, tpl, frame, deliver,
      to: emailOverride || norm(user.email),
      vars: { ...shared, name: (String(user.first_name || '').trim() || String(user.full_name || '').trim()).split(/\s+/)[0] || '' },
    });
    if (r === 'sent') out.sent++;
    else if (r === 'failed') out.failed++;
    else { out.skipped++; if (r === 'deferred') deferred++; }
  }
  // everyone reached (nothing deferred / failed / left for the next run) → the week is done
  if (!deferred && !out.failed && out.sent + out.skipped >= due.length) await saveState(db, { ...cfg.state, ...(plan.action === 'start' ? { next: (issue.index + 1) % cfg.rotation.length } : {}), issue: { ...issue, done: true, finished_at: now.toISOString() } });
  return out;
}

async function saveState(db, state) {
  await db.update('automations', `id=eq.${NEWSLETTER_ID}`, { free_tiers: [state], updated_at: new Date().toISOString() }, { returning: 'minimal' });
}

// The sample values a test send / the website page fill in (links of this site).
export function siteLinks(siteUrl) {
  const site = String(siteUrl || '').replace(/\/$/, '');
  return {
    newsletter_url: `${site}/newsletter`, stories_url: `${site}/newsletter#historias`, search_url: `${site}/propiedades`,
    app_url: `${site}/descargar`, publish_url: `${site}/publicar`, settings_url: `${site}/cuenta/ajustes`,
  };
}
