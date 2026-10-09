// "Unfinished draft reminders" automation. Emails the owner of a sell-wizard draft
// (listing_drafts — "Borradores") that has been left untouched, at the admin's steps,
// with a button that opens THAT draft in the wizard (My listings → Drafts deep link).
// The steps are automations.milestones = hours without changes, e.g. [24, 72, 168] =
// after 1, 3 and 7 days (Admin → Automations: 1–5 steps, 1 hour to 60 days each).
//
//   • The clock is the draft's updated_at — the last time the seller opened it in the
//     wizard (its autosave), changed it, added a photo, or signed in and claimed it.
//     The emails are about a draft being LEFT, so someone still working on it is never
//     nudged. Coming back pushes the NEXT reminder back (measured from then); the ones
//     already sent are never sent again.
//   • Each step goes out once per draft: email_log dedupe key draft:<draft id>:<step>,
//     run_id = the draft id. Several steps due at once (switched on late, a pause, new
//     steps) → ONE email, for the latest; the earlier ones count as done.
//   • A step that came due more than LATE_GRACE_HOURS (7 days) ago is skipped — so
//     switching this on never emails people about drafts abandoned long ago.
//   • Publishing deletes the draft (/api/publish), and so does the seller: a draft
//     that's gone simply gets nothing more.
//   • Recipient: account drafts → users.email (closed, blocked or suspended accounts
//     are skipped); guest drafts (user_id = the id derived from the email typed in the
//     wizard, lib/guestDrafts.js) → data._guest_email, unless that email's account is
//     closed. No deliverable email → skipped.
//   • At most one reminder per person per run (hourly); the rest go next hour.
// Pure + dependency-injected (tests/draftReminders.test.mjs).
import { sendOnce } from './sendOnce.js';
import { guestOwnerId } from '../guestDrafts.js';
import { cleanDraftPhotos } from '../drafts.js';
import { typeLabel } from '../propertyTypeOptions.js';
import { isDeletedEmail } from '../accountDeletion.js';

export const DRAFTS_AUTOMATION_ID = 'draft_reminders';
export const MAX_STEPS = 5;
export const MIN_HOURS = 1;
export const MAX_HOURS = 60 * 24;
export const LATE_GRACE_HOURS = 7 * 24;
const H = 3600e3;

const enc = encodeURIComponent;
const iso = (ms) => new Date(ms).toISOString();
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const norm = (e) => String(e || '').trim().toLowerCase();
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(e));
const isHttp = (u) => /^https?:\/\/\S+$/i.test(String(u || ''));
const STEP_KEY = /^draft:[^:]+:(\d+)$/;

// [168, '24', 72, 72, 0] → [24, 72, 168]: whole hours in range, unique, ascending, ≤ 5.
export const normalizeSteps = (m) => [...new Set((Array.isArray(m) ? m : []).map(Number)
  .filter((n) => Number.isInteger(n) && n >= MIN_HOURS && n <= MAX_HOURS))].sort((a, b) => a - b).slice(0, MAX_STEPS);

// The step to send now for one draft (1-based; 0 = nothing): the LATEST step whose time
// has come and that is later than the last one sent — unless it came due more than
// graceH hours ago (a draft abandoned long before this could reach it).
export function dueStep(idleMs, steps, lastSent = 0, graceH = LATE_GRACE_HOURS) {
  let n = 0;
  for (let i = Math.max(0, lastSent); i < steps.length; i++) if (idleMs >= steps[i] * H) n = i + 1;
  if (!n) return 0;
  return idleMs - steps[n - 1] * H > graceH * H ? 0 : n;
}

// The My listings deep link that opens this draft in the sell wizard (signing in first
// when needed — app/cuenta/layout.js brings them back here).
export const draftLink = (siteUrl, id) => `${siteUrl}/cuenta/publicaciones?tab=borradores&draft=${enc(id)}`;

// "Villa Morra, Asunción"
export function draftLocation(data = {}) {
  const n = String(data.neighborhood || '').trim();
  const c = String(data.city || '').trim();
  return n && c && n.toLowerCase() !== c.toLowerCase() ? `${n}, ${c}` : (n || c);
}

// "Casa en venta · Villa Morra, Asunción" — what they started, as far as they got.
export function draftTitle(data = {}) {
  const type = typeLabel(data.ptype, 'es');
  const mode = data.mode === 'alquiler' ? 'en alquiler' : data.mode === 'venta' ? 'en venta' : '';
  return [type ? [type, mode].filter(Boolean).join(' ') : '', draftLocation(data)].filter(Boolean).join(' · ') || 'Tu propiedad';
}

// The draft's first photo as an absolute http(s) url ('' when it has none).
export function draftPhoto(data, siteUrl = '') {
  const url = cleanDraftPhotos(data?.photos)[0]?.url || '';
  const abs = url.startsWith('/') ? `${siteUrl}${url}` : url;
  return isHttp(abs) ? abs : '';
}

const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);

export async function runDraftReminders(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '',
    emailOverride = '', limit = 200 } = deps;
  const out = { checked: 0, due: 0, sent: 0, skipped: 0, failed: 0 };
  if (!automation || !automation.enabled || !automation.enabled_at) return { ...out, skippedReason: 'disabled' };
  const steps = normalizeSteps(automation.milestones);
  if (!steps.length) return { ...out, skippedReason: 'no_steps' };
  const tpl = templates.find((t) => String(t.id) === String(automation.template_id));
  if (!tpl || tpl.is_active === false) return { ...out, skippedReason: 'no_template' };

  // Only drafts idle long enough for the first step, and not so long that even the
  // last step is past its grace.
  const nowMs = now.getTime();
  const newest = iso(nowMs - steps[0] * H);
  const oldest = iso(nowMs - (steps[steps.length - 1] + LATE_GRACE_HOURS) * H);
  const drafts = await db.select('listing_drafts',
    `select=id,user_id,data,updated_at&updated_at=lte.${enc(newest)}&updated_at=gte.${enc(oldest)}&order=updated_at.asc&limit=2000`);
  if (!drafts.length) return out;

  // The last step already emailed for each draft.
  const lastSent = new Map();
  for (const part of chunks(drafts.map((d) => String(d.id)), 100)) {
    const logs = await db.select('email_log', `select=run_id,dedupe_key&automation_id=eq.${DRAFTS_AUTOMATION_ID}&run_id=${inList(part)}`);
    for (const l of logs) {
      const m = STEP_KEY.exec(String(l.dedupe_key || ''));
      if (m) lastSent.set(String(l.run_id), Math.max(lastSent.get(String(l.run_id)) || 0, Number(m[1])));
    }
  }

  const due = [];
  for (const d of drafts) {
    out.checked++;
    const step = dueStep(nowMs - Date.parse(d.updated_at), steps, lastSent.get(String(d.id)) || 0);
    if (step) due.push({ d, step });
  }
  out.due = due.length;
  if (!due.length) return out;

  // Who gets each one: the account's email, or the guest draft's own email.
  const users = new Map();
  for (const part of chunks([...new Set(due.map((x) => String(x.d.user_id)))], 100)) {
    for (const u of await db.select('users', `select=id,email,full_name,active,blocked,suspended&id=${inList(part)}`)) users.set(String(u.id), u);
  }
  const guestEmail = (d) => {
    const e = norm(d.data?._guest_email);
    return emailOk(e) && guestOwnerId(e) === String(d.user_id) ? e : '';
  };
  const byEmail = new Map();
  const guestEmails = [...new Set(due.filter((x) => !users.has(String(x.d.user_id))).map((x) => guestEmail(x.d)).filter(Boolean))];
  for (const part of chunks(guestEmails, 50)) {
    for (const u of await db.select('users', `select=id,email,full_name,active,blocked,suspended&email=${inList(part.map(enc))}`)) byEmail.set(norm(u.email), u);
  }
  const recipientOf = (d) => {
    const u = users.get(String(d.user_id));
    if (u) return closed(u) ? null : { email: norm(u.email), name: firstName(u.full_name) || firstName(d.data?.contact_name) };
    const e = guestEmail(d);
    if (!e) return null;
    const acct = byEmail.get(e);
    if (acct && closed(acct)) return null;
    return { email: e, name: firstName(d.data?.contact_name) || firstName(acct?.full_name) };
  };

  const mailed = new Set();   // one reminder per person per run
  for (const { d, step } of due) {
    if (out.sent + out.failed >= limit) break;
    const who = recipientOf(d);
    if (!who) { out.skipped++; continue; }
    if (mailed.has(who.email)) continue;
    const data = d.data || {};
    const r = await sendOnce({
      db, automationId: DRAFTS_AUTOMATION_ID, runId: d.id, dedupeKey: `draft:${d.id}:${step}`, tpl, frame, deliver,
      to: emailOverride || who.email,
      vars: {
        name: who.name,
        property_title: draftTitle(data),
        draft_location: draftLocation(data),
        photo_url: draftPhoto(data, siteUrl),
        draft_url: draftLink(siteUrl, d.id),
        publish_url: `${siteUrl}/publicar`,
      },
    });
    if (r === 'sent') { out.sent++; mailed.add(who.email); }
    if (r === 'failed') out.failed++;
  }
  return out;
}
