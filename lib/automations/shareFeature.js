// "New: share your listing" announcement automation (row 'share_feature_promo'): emails
// verified members (buyers and sellers) about the share feature — WhatsApp, Instagram, Gmail,
// X or a copied link → more visits; the 3 steps; "Ver la demo" (YouTube) — and sends it again
// every N hours, up to N times (0 = no limit). The schedule and the keys are
// lib/shareFeature.js (shared with the admin); this runs them hourly from
// /api/cron/automations.
//
//   • Who: users.verified = true, account open (not closed/blocked/suspended, not a
//     deleted-account address), not a test / team account (lib/internalAccounts.js: the team's
//     emails + domains, .pk, Admin → Users "Mark as test", the test numbers, +92 numbers).
//     Not anyone who opted out (WhatsApp BAJA, a referral-promo opt-out) or whose email bounced
//     / was marked as spam (this automation's or the referral promo's stop records).
//   • Pacing: at most `perRun` emails per hourly run (sent + failed). Order: repeats first,
//     then new sign-ups, then people who signed up before it was switched on (newest first).
//   • Night (lib/sendWindow.js — frame.quiet): nothing is looked at or sent; the first
//     daytime run sends whoever is due.
//   • Bounce / complaint: before a repeat, the previous email's Resend status (emailStatus
//     dep; needs RESEND_READ_API_KEY on the site). Unknown → sent anyway.
//   • AUTOMATION_EMAIL_OVERRIDE (emailOverride) sends every email to the test address;
//     testAudience (an email prefix, local testing only) limits who is considered.
// Pure + dependency-injected (tests/shareFeature.test.mjs).
import { sendOnce } from './sendOnce.js';
import { isDeletedEmail } from '../accountDeletion.js';
import { isInternalAccount } from '../internalAccounts.js';
import { SHARE_FEATURE_ID, shareFeatureConfig, shareFeatureProgress, shareFeatureNext, shareFeatureKey, shareFeatureStopKey, shareFeatureListingsUrl } from '../shareFeature.js';

const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const norm = (e) => String(e || '').trim().toLowerCase();
const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);
const isDup = (e) => e?.status === 409 || e?.code === '23505';
const BAD_EVENTS = { bounced: 'bounced', complained: 'complained', suppressed: 'bounced' };
const RANK = { repeat: 0, new: 1, existing: 2 };

async function selectAll(db, table, query, size = 1000) {
  const out = [];
  for (let off = 0; ; off += size) {
    const rows = await db.select(table, `${query}&limit=${size}&offset=${off}`);
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

// THE selection (pure). → { due: [{ user, n, kind, dueAtMs, lastResendId }], counts }
// users: candidate rows · progress: shareFeatureProgress(logs) · marked: Set of emails marked
// as test accounts in the admin.
export function pickShareFeature({ users = [], progress = new Map(), marked = null, cfg, nowMs, testAudience = '' }) {
  const counts = { checked: 0, closed: 0, internal: 0, optedOut: 0, bounced: 0, finished: 0, excluded: 0, waiting: 0 };
  const due = [];
  for (const u of users) {
    if (testAudience && !norm(u?.email).startsWith(testAudience)) continue;
    counts.checked++;
    if (u?.verified !== true || closed(u)) { counts.closed++; continue; }
    if (isInternalAccount(u, marked)) { counts.internal++; continue; }
    const id = String(u.id);
    const p = progress.get(id) || { sent: 0, lastAtMs: 0, lastResendId: null, stop: null };
    if (p.stop === 'unsubscribed' || u.whatsapp_opted_out_at) { counts.optedOut++; continue; }
    if (p.stop) { counts.bounced++; continue; }
    const next = shareFeatureNext({ createdAtMs: Date.parse(u.created_at), sent: p.sent, lastAtMs: p.lastAtMs }, cfg, nowMs);
    if (next.state === 'done') { counts.finished++; continue; }
    if (next.state === 'excluded') { counts.excluded++; continue; }
    if (next.state === 'waiting') { counts.waiting++; continue; }
    due.push({ user: u, n: next.n, kind: next.n > 1 ? 'repeat' : next.existing ? 'existing' : 'new', dueAtMs: next.dueAtMs, createdAtMs: Date.parse(u.created_at), lastResendId: p.lastResendId });
  }
  due.sort((a, b) => (RANK[a.kind] - RANK[b.kind])
    || (a.kind === 'existing' ? b.createdAtMs - a.createdAtMs : a.dueAtMs - b.dueAtMs));
  return { due, counts };
}

async function recordStop(db, user, reason, extra = {}) {
  try {
    await db.insert('email_log', [{
      automation_id: SHARE_FEATURE_ID, channel: 'event', status: 'sent', template_key: 'sharefeature_stop', dedupe_key: shareFeatureStopKey(user.id),
      run_id: user.id, to_email: norm(user.email) || '-', subject: reason, error: JSON.stringify({ at: new Date().toISOString(), ...extra }),
    }], { returning: 'minimal' });
    return true;
  } catch (e) { if (isDup(e)) return false; throw e; }
}

// deps: { db, automation (the 'share_feature_promo' row), templates, now, deliver, frame,
//         siteUrl, emailOverride, emailStatus(resendId) → 'delivered' | 'bounced' | … | null,
//         markedTestEmails() → Set, testAudience, pauseMs, sleep }
export async function runShareFeature(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '',
    emailOverride = '', emailStatus = null, markedTestEmails = async () => new Set(), testAudience = '', pauseMs = 0,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = deps;
  const out = { checked: 0, due: 0, sent: 0, failed: 0, skipped: 0, stopped: 0, held: 0 };
  const audience = testAudience ? norm(testAudience) : '';
  if (audience) out.testAudience = audience;
  const cfg = shareFeatureConfig(automation);
  if (!cfg.exists) return { ...out, skippedReason: 'not_set_up' };
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  const tpl = templates.find((t) => String(t.id) === String(cfg.templateId));
  if (!tpl || tpl.is_active === false) return { ...out, skippedReason: 'no_template' };
  if (frame.quiet) return { ...out, skippedReason: 'quiet_hours' };

  const nowMs = now.getTime();
  const LOG_COLS = 'select=id,run_id,dedupe_key,created_at,resend_id,status,channel,subject';
  const [users, logs, otherStops, marked] = await Promise.all([
    selectAll(db, 'users', 'select=id,email,phone,full_name,verified,active,blocked,suspended,created_at,whatsapp_opted_out_at&verified=eq.true&order=id.asc'),
    selectAll(db, 'email_log', `${LOG_COLS}&automation_id=eq.${SHARE_FEATURE_ID}&order=id.asc`),
    // the referral promo's opt-out / bounce / spam records stop this email too
    selectAll(db, 'email_log', `${LOG_COLS}&automation_id=eq.referral_promo&channel=eq.event&order=id.asc`).catch(() => []),
    markedTestEmails().catch(() => new Set()),
  ]);
  const { due, counts } = pickShareFeature({ users, progress: shareFeatureProgress([...logs, ...otherStops]), marked, cfg, nowMs, testAudience: audience });
  Object.assign(out, { checked: counts.checked, due: due.length, counts });
  if (!due.length) return out;

  const site = String(siteUrl || '').replace(/\/$/, '');
  let lookups = 0;
  for (let i = 0; i < due.length; i++) {
    if (out.sent + out.failed >= cfg.perRun) { out.held = due.length - i; break; }
    const { user, n, lastResendId } = due[i];
    // Before a repeat: did the previous email bounce / get marked as spam?
    if (n > 1 && lastResendId && emailStatus && lookups < cfg.perRun * 2) {
      lookups++;
      const ev = BAD_EVENTS[String(await emailStatus(lastResendId).catch(() => null) || '').toLowerCase()];
      if (ev) {
        await recordStop(db, user, ev, { resend_id: lastResendId });
        out.stopped++;
        continue;
      }
    }
    const r = await sendOnce({
      db, automationId: SHARE_FEATURE_ID, runId: user.id, dedupeKey: shareFeatureKey(user.id, n), tpl, frame, deliver,
      to: emailOverride || norm(user.email),
      vars: { name: firstName(user.full_name), my_listings_url: shareFeatureListingsUrl(site), publish_url: `${site}/publicar` },
    });
    if (r === 'sent') { out.sent++; if (pauseMs) await sleep(pauseMs); }
    else if (r === 'failed') out.failed++;
    else out.skipped++;
  }
  return out;
}
