// "Personalize your profile" automation. Emails VERIFIED users whose Profile Personalization
// (Settings → Perfil profesional: photo or logo, first + last name, job title, company,
// company website, confirmed WhatsApp — lib/profileCompletion.js) is not personalized yet,
// explaining how and why (buyers trust a seller they can see → more enquiries), with a button
// straight to Settings (/cuenta/ajustes — signed-out people sign in and land back there,
// app/cuenta/layout.js).
// Config = the automations row 'profile_personalization' (no table of its own; created by the
// admin's Automations page on first save — no row / switched off = nothing is sent):
//   enabled / enabled_at · milestones = HOURS after sign-up for each email, default
//   [0, 24, 48] (right after sign-up, +24 h, +48 h; 1–5 emails, 0 h to 60 days) ·
//   template_id = the first email · reminder_template_id = every later email (falls back to
//   the first when not set).
//
//   • Who: users.verified = true, account open (not closed / blocked / suspended / deleted),
//     NOT personalized (isPersonalized: photo + first + last name + title or company, or
//     all 7 items). The moment the profile is personalized the emails stop.
//   • "Started but didn't finish" is the same flow: someone who opened Settings and filled
//     part of it still gets the next step; {{progress_line}} then says how far they got and
//     what is missing ("Tu perfil está al 43 % …") instead of "you haven't started".
//   • Each step goes once per user: email_log dedupe key profile:<user id>:<step>,
//     run_id = the user id. Several steps due at once → ONE email, for the latest.
//   • A step that came due more than LATE_GRACE_HOURS (7 days) ago is skipped — switching
//     this on never emails people who signed up long ago.
//   • Opt-outs: people who unsubscribed from Casa-Libre emails (the referral emails' link or
//     BAJA on WhatsApp) or whose email bounced / was marked as spam are skipped — the same
//     stop rows the referral promo respects (refpromo-stop:<user id>:ev). WhatsApp consent is
//     sendOnce's (lib/automations/whatsappSend.js).
//   • Night: sendOnce defers (frame.quiet) to the first daytime run, like every automation.
//   • AUTOMATION_EMAIL_OVERRIDE (emailOverride) sends every email to the test address.
// Pure + dependency-injected (tests/profileNudge.test.mjs).
import { sendOnce } from './sendOnce.js';
import { dueStep } from './draftReminders.js';
import { isDeletedEmail } from '../accountDeletion.js';
import { userCompletion, isPersonalized } from '../profileCompletion.js';

export const PROFILE_NUDGE_ID = 'profile_personalization';
export const DEFAULT_STEPS = [0, 24, 48];
export const MAX_STEPS = 5;
export const MAX_HOURS = 60 * 24;
export const LATE_GRACE_HOURS = 7 * 24;
const H = 3600e3;

const enc = encodeURIComponent;
const iso = (ms) => new Date(ms).toISOString();
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const norm = (e) => String(e || '').trim().toLowerCase();
const STEP_KEY = /^profile:[^:]+:(\d+)(?::wa)?$/;   // ':wa' = the WhatsApp send of that step
const STOP_KEY = /^refpromo-stop:([^:]+):ev$/;

export const USER_COLS = 'id,email,full_name,verified,active,blocked,suspended,created_at,first_name,last_name,job_title,company_name,company_website,phone_verified_at,profile_photo_url,profile_photo_status';

// [48, '0', 24, 24, -1, 2000] → [0, 24, 48]: whole hours 0–1440, unique, ascending, ≤ 5.
export const normalizeSteps = (m) => [...new Set((Array.isArray(m) ? m : []).map(Number)
  .filter((n) => Number.isInteger(n) && n >= 0 && n <= MAX_HOURS))].sort((a, b) => a - b).slice(0, MAX_STEPS);

// The row → { enabled, steps (hours), templateIds: [first, later] }.
export function profileNudgeConfig(row) {
  if (!row) return { enabled: false, steps: [...DEFAULT_STEPS], templateIds: [] };
  const steps = Array.isArray(row.milestones) ? normalizeSteps(row.milestones) : [...DEFAULT_STEPS];
  const first = row.template_id || null;
  return {
    enabled: row.enabled === true && !!row.enabled_at,
    steps: steps.length ? steps : [...DEFAULT_STEPS],
    templateIds: [first, row.reminder_template_id || first],
  };
}

// Settings → Perfil profesional, tagged so the visits show up as this email in analytics.
export const settingsLink = (siteUrl, step) => `${String(siteUrl || '').replace(/\/$/, '')}/cuenta/ajustes?${new URLSearchParams({
  utm_source: 'email', utm_medium: 'automation', utm_campaign: PROFILE_NUDGE_ID, utm_content: `email${step}`,
})}`;

const ITEM_ES = { photo: 'foto o logo', first_name: 'nombre', last_name: 'apellido', job_title: 'cargo', company_name: 'empresa', company_website: 'sitio web', whatsapp: 'WhatsApp confirmado' };

// Did they start? Anything saved in the Perfil profesional or a photo uploaded (approved,
// in review or rejected) — the name alone can come from sign-up.
export const startedProfile = (u = {}) => ['first_name', 'last_name', 'job_title', 'company_name', 'company_website', 'profile_photo_status']
  .some((k) => String(u[k] ?? '').trim() !== '');

// The line that adapts the email to where they are.
export function progressLine(u) {
  const c = userCompletion(u);
  const missing = c.missing.map((k) => ITEM_ES[k]).join(', ');
  if (!startedProfile(u)) return `Todavía no personalizaste tu perfil. Te falta: ${missing}.`;
  return `Ya empezaste: tu perfil está al ${c.pct} % (${c.count} de ${c.total}). Te falta: ${missing}.`;
}

const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);

// THE selection (pure). users = candidate rows (USER_COLS); lastSent = Map user id → last
// step emailed; stopped = Set of user ids that opted out / bounced. → [{ user, step }].
export function pickProfileNudges({ users = [], lastSent = new Map(), stopped = new Set(), steps = DEFAULT_STEPS, nowMs, graceH = LATE_GRACE_HOURS }) {
  const out = [];
  for (const u of users) {
    if (u?.verified !== true || closed(u)) continue;
    const id = String(u.id);
    if (stopped.has(id)) continue;
    if (isPersonalized(userCompletion(u))) continue;
    const signed = Date.parse(u.created_at);
    if (!Number.isFinite(signed)) continue;
    const step = dueStep(nowMs - signed, steps, lastSent.get(id) || 0, graceH);
    if (step) out.push({ user: u, step });
  }
  return out;
}

// onlyUserIds: a manual run limited to these accounts (testing); the cron never passes it.
export async function runProfileNudge(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '',
    emailOverride = '', limit = 200, onlyUserIds = null } = deps;
  const out = { checked: 0, due: 0, sent: 0, skipped: 0, failed: 0 };
  const cfg = profileNudgeConfig(automation);
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  const tplFor = (step) => {
    const t = templates.find((x) => String(x.id) === String(cfg.templateIds[step === 1 ? 0 : 1]));
    return t && t.is_active !== false ? t : null;
  };
  if (!tplFor(1)) return { ...out, skippedReason: 'no_template' };

  // Verified accounts that signed up long enough ago for the first email, and not so long
  // ago that even the last one is past its grace.
  const nowMs = now.getTime();
  const steps = cfg.steps;
  const newest = iso(nowMs - steps[0] * H);
  const oldest = iso(nowMs - (steps[steps.length - 1] + LATE_GRACE_HOURS) * H);
  const only = Array.isArray(onlyUserIds) && onlyUserIds.length ? `&id=${inList(onlyUserIds)}` : '';
  const users = await db.select('users',
    `select=${USER_COLS}&verified=eq.true&created_at=lte.${enc(newest)}&created_at=gte.${enc(oldest)}${only}&order=created_at.asc&limit=5000`);
  if (!users.length) return out;
  out.checked = users.length;

  const ids = users.map((u) => String(u.id));
  const lastSent = new Map();
  const stopped = new Set();
  for (const part of chunks(ids, 100)) {
    for (const l of await db.select('email_log', `select=run_id,dedupe_key&automation_id=eq.${PROFILE_NUDGE_ID}&run_id=${inList(part)}`)) {
      const m = STEP_KEY.exec(String(l.dedupe_key || ''));
      if (m) lastSent.set(String(l.run_id), Math.max(lastSent.get(String(l.run_id)) || 0, Number(m[1])));
    }
    const stopKeys = part.map((id) => `refpromo-stop:${id}:ev`);
    for (const l of await db.select('email_log', `select=dedupe_key&dedupe_key=${inList(stopKeys)}`).catch(() => [])) {
      const m = STOP_KEY.exec(String(l.dedupe_key || ''));
      if (m) stopped.add(m[1]);
    }
  }

  const due = pickProfileNudges({ users, lastSent, stopped, steps, nowMs });
  out.due = due.length;
  for (const { user, step } of due) {
    if (out.sent + out.failed >= limit) break;
    const tpl = tplFor(step);
    if (!tpl) { out.skipped++; continue; }
    const c = userCompletion(user);
    const r = await sendOnce({
      db, automationId: PROFILE_NUDGE_ID, runId: user.id, dedupeKey: `profile:${user.id}:${step}`, tpl, frame, deliver,
      to: emailOverride || norm(user.email),
      vars: {
        name: (String(user.first_name || '').trim() || String(user.full_name || '').trim()).split(/\s+/)[0] || '',
        settings_url: settingsLink(siteUrl, step),
        progress_pct: String(c.pct), progress_count: String(c.count), progress_total: String(c.total),
        progress_line: progressLine(user),
      },
    });
    if (r === 'sent') out.sent++;
    else if (r === 'failed') out.failed++;
    else out.skipped++;
  }
  return out;
}
