// "Show your face" automation (Roland, Nov 18): a seller whose approved profile photo is a logo,
// text or something else — not a real photo of them — gets a friendly, professional email:
// buyers are more comfortable when they can see who they are dealing with, so a real photo brings
// more contacts. Logos are NOT blocked; this only encourages a real photo.
// Config = the automations row 'profile_photo_face' (created by the admin's Automations page or
// the seed script; no row / switched off = nothing is sent):
//   enabled / enabled_at · milestones = HOURS after the photo was approved for each email,
//   default [24, 72, 168] (1, 3 and 7 days; 1–5 emails, 0 h to 60 days) · template_id = the
//   first email · reminder_template_id = every later email (falls back to the first).
//
//   • Who: verified, account open, an APPROVED photo whose kind (lib/profilePhotoKind.js, decided
//     by the AI for THIS photo) is 'logo' or 'other'. Photos not checked yet are checked first
//     (classifyMissing, a few per run).
//   • Before EVERY email the current photo is read again: the moment it is a real photo of the
//     person (kind 'face'), or the photo is removed, nothing more is sent.
//   • Clock = when the current photo was approved (profile_photo_checked_at).
//   • Each step once per user: email_log dedupe key photoface:<user id>:<step>, run_id = user id.
//     Several steps due at once → ONE email, for the latest. A step more than 7 days late is
//     skipped (switching it on never emails people whose photo was approved long ago).
//   • People who unsubscribed / bounced (refpromo-stop:<id>:ev) are skipped. Night: sendOnce defers.
//   • AUTOMATION_EMAIL_OVERRIDE (emailOverride) sends every email to the test address.
// Pure + dependency-injected (tests/photoFace.test.mjs).
import { sendOnce } from './sendOnce.js';
import { dueStep } from './draftReminders.js';
import { isDeletedEmail } from '../accountDeletion.js';
import { needsFace } from '../profilePhotoKind.js';

export const PHOTO_FACE_ID = 'profile_photo_face';
export const DEFAULT_STEPS = [24, 72, 168];
export const MAX_STEPS = 5;
export const MAX_HOURS = 60 * 24;
export const LATE_GRACE_HOURS = 7 * 24;
const H = 3600e3;

const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const norm = (e) => String(e || '').trim().toLowerCase();
const STEP_KEY = /^photoface:[^:]+:(\d+)(?::wa)?$/;
const STOP_KEY = /^refpromo-stop:([^:]+):ev$/;

export const USER_COLS = 'id,email,full_name,first_name,verified,active,blocked,suspended,profile_photo_url,profile_photo_key,profile_photo_status,profile_photo_checked_at,profile_photo_kind,profile_photo_kind_key';

export const normalizeSteps = (m) => [...new Set((Array.isArray(m) ? m : []).map(Number)
  .filter((n) => Number.isInteger(n) && n >= 0 && n <= MAX_HOURS))].sort((a, b) => a - b).slice(0, MAX_STEPS);

export function photoFaceConfig(row) {
  if (!row) return { enabled: false, steps: [...DEFAULT_STEPS], templateIds: [] };
  const steps = Array.isArray(row.milestones) ? normalizeSteps(row.milestones) : [...DEFAULT_STEPS];
  const first = row.template_id || null;
  return {
    enabled: row.enabled === true && !!row.enabled_at,
    steps: steps.length ? steps : [...DEFAULT_STEPS],
    templateIds: [first, row.reminder_template_id || first],
  };
}

// Settings → Perfil profesional (where the photo is changed), tagged for analytics.
export const settingsLink = (siteUrl, step) => `${String(siteUrl || '').replace(/\/$/, '')}/cuenta/ajustes?${new URLSearchParams({
  utm_source: 'email', utm_medium: 'automation', utm_campaign: PHOTO_FACE_ID, utm_content: `email${step}`,
})}`;

// The line that names what they uploaded.
export const photoLine = (kind) => (kind === 'logo'
  ? 'Vimos que en tu perfil subiste un logo o un texto en lugar de una foto tuya.'
  : 'Vimos que la imagen de tu perfil no muestra tu cara.');

const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);

// THE selection (pure). → [{ user, step }]
export function pickPhotoFace({ users = [], lastSent = new Map(), stopped = new Set(), steps = DEFAULT_STEPS, nowMs, graceH = LATE_GRACE_HOURS }) {
  const out = [];
  for (const u of users) {
    if (u?.verified !== true || closed(u)) continue;
    if (!needsFace(u)) continue;                     // real photo, no photo, or not checked yet
    const id = String(u.id);
    if (stopped.has(id)) continue;
    const since = Date.parse(u.profile_photo_checked_at);
    if (!Number.isFinite(since)) continue;
    const step = dueStep(nowMs - since, steps, lastSent.get(id) || 0, graceH);
    if (step) out.push({ user: u, step });
  }
  return out;
}

// classifyMissing: () → Promise — checks photos that have no kind yet (lib/profilePhotoKindScan.js).
export async function runPhotoFace(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '',
    emailOverride = '', limit = 200, onlyUserIds = null, classifyMissing = null } = deps;
  const out = { checked: 0, due: 0, sent: 0, skipped: 0, failed: 0 };
  const cfg = photoFaceConfig(automation);
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  const tplFor = (step) => {
    const t = templates.find((x) => String(x.id) === String(cfg.templateIds[step === 1 ? 0 : 1]));
    return t && t.is_active !== false ? t : null;
  };
  if (!tplFor(1)) return { ...out, skippedReason: 'no_template' };
  if (classifyMissing) out.classified = await classifyMissing().catch((e) => ({ error: e?.message || 'classify_failed' }));

  // Read AFTER classifying: this is the "has the photo changed?" check before every email.
  const only = Array.isArray(onlyUserIds) && onlyUserIds.length ? `&id=${inList(onlyUserIds)}` : '';
  let users;
  try {
    users = await db.select('users', `select=${USER_COLS}&verified=eq.true&profile_photo_status=eq.approved&profile_photo_kind=in.(logo,other)${only}&limit=5000`);
  } catch { return { ...out, skippedReason: 'not_set_up' }; }   // migration 013 not applied
  if (!users.length) return out;
  out.checked = users.length;

  const ids = users.map((u) => String(u.id));
  const lastSent = new Map();
  const stopped = new Set();
  for (const part of chunks(ids, 100)) {
    for (const l of await db.select('email_log', `select=run_id,dedupe_key&automation_id=eq.${PHOTO_FACE_ID}&run_id=${inList(part)}`)) {
      const m = STEP_KEY.exec(String(l.dedupe_key || ''));
      if (m) lastSent.set(String(l.run_id), Math.max(lastSent.get(String(l.run_id)) || 0, Number(m[1])));
    }
    const stopKeys = part.map((id) => `refpromo-stop:${id}:ev`);
    for (const l of await db.select('email_log', `select=dedupe_key&dedupe_key=${inList(stopKeys)}`).catch(() => [])) {
      const m = STOP_KEY.exec(String(l.dedupe_key || ''));
      if (m) stopped.add(m[1]);
    }
  }

  const due = pickPhotoFace({ users, lastSent, stopped, steps: cfg.steps, nowMs: now.getTime() });
  out.due = due.length;
  for (const { user, step } of due) {
    if (out.sent + out.failed >= limit) break;
    const tpl = tplFor(step);
    if (!tpl) { out.skipped++; continue; }
    const r = await sendOnce({
      db, automationId: PHOTO_FACE_ID, runId: user.id, dedupeKey: `photoface:${user.id}:${step}`, tpl, frame, deliver,
      to: emailOverride || norm(user.email),
      vars: {
        name: (String(user.first_name || '').trim() || String(user.full_name || '').trim()).split(/\s+/)[0] || '',
        settings_url: settingsLink(siteUrl, step),
        photo_line: photoLine(user.profile_photo_kind),
      },
    });
    if (r === 'sent') out.sent++;
    else if (r === 'failed') out.failed++;
    else out.skipped++;
  }
  return out;
}
