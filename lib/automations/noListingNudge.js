// "Signed up but never listed" automation. Emails VERIFIED users who created an account
// and never posted a listing: "Welcome to Casa Libre — post your first listing for free
// now", with a button to the sell wizard. Optional second email a few days later.
// Config = the automations row 'no_listing_nudge' (no table of its own; created by the
// admin's Automations page on first save — no row / switched off = nothing is sent):
//   enabled / enabled_at · milestones = DAYS after sign-up for each email, e.g. [2] or
//   [2, 7] (1–2 emails, 1–60 days) · wait_days mirrors the first one ·
//   template_id = first email · reminder_template_id = second email (falls back to the
//   first template when not set).
//
//   • Who: users.verified = true, account open (not closed/blocked/suspended, not a
//     deleted-account @deleted.invalid address), signed up at least the first wait ago,
//     and owning NO listing (any properties row they created, any status) and NO
//     sell-wizard draft (account draft, or a guest draft typed with their email) — a user
//     with a draft is the "unfinished draft reminders" automation's, so nobody gets both.
//   • Each email goes once per user: email_log dedupe key nolisting:<user id>:<step>,
//     run_id = the user id. Several steps due at once → ONE email, for the latest.
//   • A step that came due more than LATE_GRACE_DAYS ago is skipped — switching this on
//     never emails people who signed up long ago.
//   • Sent only in the daytime of the country (9:00–21:00 local), like the owner pushes.
//   • AUTOMATION_EMAIL_OVERRIDE (emailOverride) sends every email to the test address.
// Pure + dependency-injected (tests/noListingNudge.test.mjs).
import { sendOnce } from './sendOnce.js';
import { dueStep } from './draftReminders.js';
import { guestOwnerId } from '../guestDrafts.js';
import { isDeletedEmail } from '../accountDeletion.js';
import { isDaytime } from '../ownerPushes.js';

export const NO_LISTING_AUTOMATION_ID = 'no_listing_nudge';
export const DEFAULT_DAYS = 2;
export const MAX_DAYS = 60;
export const MAX_STEPS = 2;
export const LATE_GRACE_DAYS = 7;
const H = 3600e3;
const D = 24 * H;

const enc = encodeURIComponent;
const iso = (ms) => new Date(ms).toISOString();
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const norm = (e) => String(e || '').trim().toLowerCase();
const STEP_KEY = /^nolisting:[^:]+:(\d+)$/;

// [7, '2', 2, 0, 99] → [2, 7]: whole days 1–60, unique, ascending, at most 2.
export const normalizeDays = (m) => [...new Set((Array.isArray(m) ? m : []).map(Number)
  .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_DAYS))].sort((a, b) => a - b).slice(0, MAX_STEPS);

// The row → { enabled, days: [first, second?], templateIds: [first, second] }.
export function nudgeConfig(row) {
  if (!row) return { enabled: false, days: [], templateIds: [] };
  let days = normalizeDays(row.milestones);
  if (!days.length) days = normalizeDays([row.wait_days || DEFAULT_DAYS]);
  const first = row.template_id || null;
  return {
    enabled: row.enabled === true && !!row.enabled_at,
    days,
    templateIds: [first, row.reminder_template_id || first],
  };
}

// The sell wizard with UTM tags, so the visits show up as this email in analytics.
export const publishLink = (siteUrl, step) => `${String(siteUrl || '').replace(/\/$/, '')}/publicar?${new URLSearchParams({
  utm_source: 'email', utm_medium: 'automation', utm_campaign: NO_LISTING_AUTOMATION_ID, utm_content: `email${step}`,
})}`;

const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);

// THE selection (pure). users = candidate rows; listers = ids of users who own a
// listing; drafters = user ids (and guest-draft owner ids) that have a draft;
// lastSent = Map user id → last step emailed. → [{ user, step }] in sign-up order.
export function pickNudges({ users = [], listers = new Set(), drafters = new Set(), lastSent = new Map(), days = [], nowMs, graceDays = LATE_GRACE_DAYS }) {
  const stepsH = days.map((d) => d * 24);
  const out = [];
  for (const u of users) {
    if (u?.verified !== true || closed(u)) continue;
    const id = String(u.id);
    if (listers.has(id)) continue;
    if (drafters.has(id) || drafters.has(guestOwnerId(norm(u.email)))) continue;
    const signed = Date.parse(u.created_at);
    if (!Number.isFinite(signed)) continue;
    const step = dueStep(nowMs - signed, stepsH, lastSent.get(id) || 0, graceDays * 24);
    if (step) out.push({ user: u, step });
  }
  return out;
}

export async function runNoListingNudge(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '',
    emailOverride = '', countryCode = '', limit = 200 } = deps;
  const out = { checked: 0, due: 0, sent: 0, skipped: 0, failed: 0 };
  const cfg = nudgeConfig(automation);
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  if (!cfg.days.length) return { ...out, skippedReason: 'no_steps' };
  const tplFor = (step) => {
    const t = templates.find((x) => String(x.id) === String(cfg.templateIds[step - 1]));
    return t && t.is_active !== false ? t : null;
  };
  if (!tplFor(1)) return { ...out, skippedReason: 'no_template' };
  if (countryCode && !isDaytime(now, countryCode)) return { ...out, skippedReason: 'night' };

  // Verified accounts that signed up long enough ago for the first email, and not so
  // long ago that even the last one is past its grace.
  const nowMs = now.getTime();
  const days = cfg.days;
  const newest = iso(nowMs - days[0] * D);
  const oldest = iso(nowMs - (days[days.length - 1] + LATE_GRACE_DAYS) * D);
  const users = await db.select('users',
    `select=id,email,full_name,verified,active,blocked,suspended,created_at&verified=eq.true&created_at=lte.${enc(newest)}&created_at=gte.${enc(oldest)}&order=created_at.asc&limit=5000`);
  if (!users.length) return out;
  out.checked = users.length;

  const ids = users.map((u) => String(u.id));
  const listers = new Set();
  const drafters = new Set();
  const lastSent = new Map();
  for (const part of chunks(ids, 100)) {
    for (const p of await db.select('properties', `select=created_by&created_by=${inList(part)}`)) listers.add(String(p.created_by));
    for (const l of await db.select('email_log', `select=run_id,dedupe_key&automation_id=eq.${NO_LISTING_AUTOMATION_ID}&run_id=${inList(part)}`)) {
      const m = STEP_KEY.exec(String(l.dedupe_key || ''));
      if (m) lastSent.set(String(l.run_id), Math.max(lastSent.get(String(l.run_id)) || 0, Number(m[1])));
    }
  }
  // Drafts: account drafts (user_id = the user) and guest drafts (user_id derived from the email).
  const owners = [...new Set([...ids, ...users.map((u) => guestOwnerId(norm(u.email))).filter(Boolean)])];
  for (const part of chunks(owners, 100)) {
    for (const d of await db.select('listing_drafts', `select=user_id&user_id=${inList(part)}`)) drafters.add(String(d.user_id));
  }

  const due = pickNudges({ users, listers, drafters, lastSent, days, nowMs });
  out.due = due.length;
  for (const { user, step } of due) {
    if (out.sent + out.failed >= limit) break;
    const tpl = tplFor(step);
    if (!tpl) { out.skipped++; continue; }
    const r = await sendOnce({
      db, automationId: NO_LISTING_AUTOMATION_ID, runId: user.id, dedupeKey: `nolisting:${user.id}:${step}`, tpl, frame, deliver,
      to: emailOverride || norm(user.email),
      vars: { name: firstName(user.full_name), publish_url: publishLink(siteUrl, step) },
    });
    if (r === 'sent') out.sent++;
    else if (r === 'failed') out.failed++;
    else out.skipped++;
  }
  return out;
}
