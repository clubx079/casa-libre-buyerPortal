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
//
// Since Nov 22 (Roland, Nov 20) the same automation also has a WRONG-PHOTO part. The upload check
// (lib/profilePhotoKind.js uploadDecision) turns down a picture that is neither a face nor a logo
// and records it on the users row (profile_photo_rejected_at / _what / _count, migration 014):
//   • No valid photo (none at all, or a "?" photo = an approved photo the AI saw as neither) →
//     the wrong-photo sequence: hours after the turned-down upload (for "?" photos: after the photo
//     was labelled, or after the sequence was switched on, whichever is later). Default 2 h, 2 and
//     7 days. Stops the moment the account has a valid photo (a face, or a logo — then the "Show
//     your face" emails above take over). Dedupe photowrong:<user id>:<step>.
//   • Still has a valid photo (they tried to CHANGE it to a wrong one; the old one was kept) →
//     ONE email ("your new photo wasn't accepted"), at the first step's delay, at most once per
//     30 days, and not if a new valid photo was approved after the attempt. Dedupe
//     photowrongkept:<user id>:<attempt ms>.
// Settings: a second automations row 'profile_photo_face_wrong' (managed by the same admin card,
// runs only while the main row is on): enabled / enabled_at · milestones = the wrong-photo hours ·
// template_id = first wrong-photo email · reminder_template_id = the later ones ·
// gift_template_id = the one "new photo not accepted" email.
// The "Show your face" part now only emails LOGO photos (the "?" ones get the wrong-photo emails).
// Pure + dependency-injected (tests/photoFace.test.mjs).
import { sendOnce } from './sendOnce.js';
import { dueStep } from './draftReminders.js';
import { isDeletedEmail } from '../accountDeletion.js';
import { needsFace, photoState, whatLabel } from '../profilePhotoKind.js';

export const PHOTO_FACE_ID = 'profile_photo_face';
export const PHOTO_WRONG_ID = 'profile_photo_face_wrong';   // settings row of the wrong-photo part
export const DEFAULT_STEPS = [24, 72, 168];
export const DEFAULT_WRONG_STEPS = [2, 48, 168];
export const KEPT_EVERY_DAYS = 30;
export const MAX_STEPS = 5;
export const MAX_HOURS = 60 * 24;
export const LATE_GRACE_HOURS = 7 * 24;
const H = 3600e3;

const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const norm = (e) => String(e || '').trim().toLowerCase();
const STEP_KEY = /^photoface:[^:]+:(\d+)(?::wa)?$/;
const WRONG_KEY = /^photowrong:[^:]+:(\d+)(?::wa)?$/;
const KEPT_KEY = /^photowrongkept:[^:]+:(\d+)(?::wa)?$/;
const STOP_KEY = /^refpromo-stop:([^:]+):ev$/;

export const USER_COLS = 'id,email,full_name,first_name,verified,active,blocked,suspended,profile_photo_url,profile_photo_key,profile_photo_status,profile_photo_checked_at,profile_photo_kind,profile_photo_kind_key,profile_photo_kind_at';
export const REJECT_COLS = 'profile_photo_rejected_at,profile_photo_rejected_what';

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

// The wrong-photo part's settings (row PHOTO_WRONG_ID). Runs only while the main row is on too.
export function photoWrongConfig(row) {
  if (!row) return { enabled: false, steps: [...DEFAULT_WRONG_STEPS], templateIds: [], keptTemplateId: null, enabledAtMs: NaN };
  const steps = Array.isArray(row.milestones) ? normalizeSteps(row.milestones) : [...DEFAULT_WRONG_STEPS];
  const first = row.template_id || null;
  return {
    enabled: row.enabled === true && !!row.enabled_at,
    steps: steps.length ? steps : [...DEFAULT_WRONG_STEPS],
    templateIds: [first, row.reminder_template_id || first],
    keptTemplateId: row.gift_template_id || null,
    enabledAtMs: Date.parse(row.enabled_at || ''),
  };
}

// Settings → Perfil profesional (where the photo is changed), tagged for analytics.
export const settingsLink = (siteUrl, step) => `${String(siteUrl || '').replace(/\/$/, '')}/cuenta/ajustes?${new URLSearchParams({
  utm_source: 'email', utm_medium: 'automation', utm_campaign: PHOTO_FACE_ID, utm_content: `email${step}`,
})}`;

// The line that names what they uploaded.
export const photoLine = (kind) => (kind === 'logo'
  ? 'Vimos que en tu perfil tenés un logo en lugar de una foto tuya.'
  : 'Vimos que la imagen de tu perfil no muestra tu cara.');

// The wrong-photo emails' line. kind: 'none' (the upload was turned down, no photo) | 'unknown'
// (a "?" photo on the profile) | 'kept' (a new photo turned down, the old one kept).
export function wrongLine(kind, what) {
  if (kind === 'kept') return `La nueva imagen que subiste parece ser una foto de ${whatLabel(what, 'es')}, así que seguimos mostrando tu foto anterior.`;
  if (kind === 'unknown') return 'La imagen de tu perfil no muestra tu cara ni el logo de tu empresa.';
  return `La imagen que intentaste subir a tu perfil parece ser una foto de ${whatLabel(what, 'es')}, por eso no la pudimos usar.`;
}

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

// THE wrong-photo selection (pure). → [{ user, kind: 'none'|'unknown'|'kept', step, dedupeKey }]
//   lastSent: user id → last wrong-photo step sent · keptSent: user id → [ms of each "kept" email]
export function pickPhotoWrong({ users = [], lastSent = new Map(), keptSent = new Map(), stopped = new Set(), steps = DEFAULT_WRONG_STEPS,
  nowMs, enabledAtMs = NaN, graceH = LATE_GRACE_HOURS, keptEveryDays = KEPT_EVERY_DAYS }) {
  const out = [];
  if (!steps.length) return out;
  for (const u of users) {
    if (u?.verified !== true || closed(u)) continue;
    const id = String(u.id);
    if (stopped.has(id)) continue;
    const st = photoState(u);
    const rej = Date.parse(u.profile_photo_rejected_at || '');
    if (st === 'pending') continue;                  // a photo being checked / labelled → wait
    if (st === 'valid') {
      // tried to change a good photo to a wrong one → one email, unless they fixed it since
      if (!Number.isFinite(rej)) continue;
      const approvedAt = Date.parse(u.profile_photo_checked_at || '');
      if (Number.isFinite(approvedAt) && approvedAt >= rej) continue;
      const late = nowMs - rej - steps[0] * H;
      if (late < 0 || late > graceH * H) continue;
      if ((keptSent.get(id) || []).some((t) => nowMs - t < keptEveryDays * 24 * H)) continue;
      out.push({ user: u, kind: 'kept', step: 1, dedupeKey: `photowrongkept:${id}:${rej}` });
      continue;
    }
    let since;
    if (st === 'unknown') {
      const labelled = Date.parse(u.profile_photo_kind_at || u.profile_photo_checked_at || '');
      since = Math.max(Number.isFinite(labelled) ? labelled : 0, Number.isFinite(enabledAtMs) ? enabledAtMs : 0);
      if (!since) continue;
    } else {                                         // 'none': only after a turned-down upload
      if (!Number.isFinite(rej)) continue;
      since = rej;
    }
    const step = dueStep(nowMs - since, steps, lastSent.get(id) || 0, graceH);
    if (step) out.push({ user: u, kind: st, step, dedupeKey: `photowrong:${id}:${step}` });
  }
  return out;
}

// classifyMissing: () → Promise — checks photos that have no kind yet (lib/profilePhotoKindScan.js).
export async function runPhotoFace(deps) {
  const { db, automation, wrongAutomation = null, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '',
    emailOverride = '', limit = 200, onlyUserIds = null, classifyMissing = null } = deps;
  const out = { checked: 0, due: 0, sent: 0, skipped: 0, failed: 0 };
  const cfg = photoFaceConfig(automation);
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  const wcfg = photoWrongConfig(wrongAutomation);
  const usable = (id) => {
    const t = id ? templates.find((x) => String(x.id) === String(id)) : null;
    return t && t.is_active !== false ? t : null;
  };
  const tplFor = (step) => usable(cfg.templateIds[step === 1 ? 0 : 1]);
  const wrongTplFor = (step) => usable(wcfg.templateIds[step === 1 ? 0 : 1]);
  const faceOn = !!tplFor(1);
  const wrongOn = wcfg.enabled && !!wrongTplFor(1);
  const keptOn = wcfg.enabled && !!usable(wcfg.keptTemplateId);
  if (!faceOn && !wrongOn && !keptOn) return { ...out, skippedReason: 'no_template' };
  if (classifyMissing) out.classified = await classifyMissing().catch((e) => ({ error: e?.message || 'classify_failed' }));

  // Read AFTER classifying: this is the "has the photo changed?" check before every email.
  const only = Array.isArray(onlyUserIds) && onlyUserIds.length ? `&id=${inList(onlyUserIds)}` : '';
  let users;
  try {
    users = await db.select('users', `select=${USER_COLS}&verified=eq.true&profile_photo_status=eq.approved&profile_photo_kind=in.(logo,other)${only}&limit=5000`);
  } catch { return { ...out, skippedReason: 'not_set_up' }; }   // migration 013 not applied
  if (wrongOn || keptOn) {
    // everyone with a recent turned-down upload (whatever their photo is now)
    const horizonH = Math.max(...wcfg.steps, 0) + LATE_GRACE_HOURS;
    const since = new Date(now.getTime() - horizonH * H).toISOString();
    try {
      const rejected = await db.select('users', `select=${USER_COLS},${REJECT_COLS}&verified=eq.true&profile_photo_rejected_at=gte.${encodeURIComponent(since)}${only}&limit=5000`);
      const byId = new Map(users.map((u) => [String(u.id), u]));
      for (const r of rejected) byId.set(String(r.id), { ...(byId.get(String(r.id)) || {}), ...r });
      users = [...byId.values()];
    } catch { /* migration 014 not applied yet: only the "?" photos */ }
  }
  if (!users.length) return out;
  out.checked = users.length;

  const ids = users.map((u) => String(u.id));
  const lastSent = new Map();
  const wrongSent = new Map();
  const keptSent = new Map();
  const stopped = new Set();
  for (const part of chunks(ids, 100)) {
    for (const l of await db.select('email_log', `select=run_id,dedupe_key,created_at&automation_id=eq.${PHOTO_FACE_ID}&run_id=${inList(part)}`)) {
      const key = String(l.dedupe_key || '');
      const uid = String(l.run_id);
      let m = STEP_KEY.exec(key);
      if (m) { lastSent.set(uid, Math.max(lastSent.get(uid) || 0, Number(m[1]))); continue; }
      m = WRONG_KEY.exec(key);
      if (m) { wrongSent.set(uid, Math.max(wrongSent.get(uid) || 0, Number(m[1]))); continue; }
      if (KEPT_KEY.test(key)) keptSent.set(uid, [...(keptSent.get(uid) || []), Date.parse(l.created_at || '') || now.getTime()]);
    }
    const stopKeys = part.map((id) => `refpromo-stop:${id}:ev`);
    for (const l of await db.select('email_log', `select=dedupe_key&dedupe_key=${inList(stopKeys)}`).catch(() => [])) {
      const m = STOP_KEY.exec(String(l.dedupe_key || ''));
      if (m) stopped.add(m[1]);
    }
  }

  const nowMs = now.getTime();
  const firstName = (u) => (String(u.first_name || '').trim() || String(u.full_name || '').trim()).split(/\s+/)[0] || '';
  const jobs = [];
  if (faceOn) {
    for (const { user, step } of pickPhotoFace({ users, lastSent, stopped, steps: cfg.steps, nowMs })) {
      jobs.push({ user, tpl: tplFor(step), dedupeKey: `photoface:${user.id}:${step}`, line: photoLine(user.profile_photo_kind), tag: step });
    }
  }
  if (wrongOn || keptOn) {
    for (const w of pickPhotoWrong({ users, lastSent: wrongSent, keptSent, stopped, steps: wcfg.steps, nowMs, enabledAtMs: wcfg.enabledAtMs })) {
      if (w.kind === 'kept' ? !keptOn : !wrongOn) continue;
      jobs.push({
        user: w.user, tpl: w.kind === 'kept' ? usable(wcfg.keptTemplateId) : wrongTplFor(w.step), dedupeKey: w.dedupeKey,
        line: wrongLine(w.kind, w.user.profile_photo_rejected_what), tag: w.kind === 'kept' ? 'kept' : `wrong${w.step}`,
      });
    }
  }
  out.due = jobs.length;
  for (const j of jobs) {
    if (out.sent + out.failed >= limit) break;
    if (!j.tpl) { out.skipped++; continue; }
    const r = await sendOnce({
      db, automationId: PHOTO_FACE_ID, runId: j.user.id, dedupeKey: j.dedupeKey, tpl: j.tpl, frame, deliver,
      to: emailOverride || norm(j.user.email),
      vars: { name: firstName(j.user), settings_url: settingsLink(siteUrl, j.tag), photo_line: j.line },
    });
    if (r === 'sent') out.sent++;
    else if (r === 'failed') out.failed++;
    else out.skipped++;
  }
  return out;
}
