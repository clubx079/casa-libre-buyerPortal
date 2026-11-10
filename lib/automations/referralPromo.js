// "Promote the referral program" automation: emails verified members about the referral
// program — "invitá a alguien a publicar y ganá la insignia Verificada gratis" — with their
// own referral link. The schedule and the stop rules are lib/referrals/promo.js (shared with
// the admin); this runs them hourly from /api/cron/automations.
//
//   • Sends only while BOTH this automation and the referral program ('referrals' row) are
//     on in this country (the link earns nothing otherwise), the referrer reward is on (the
//     email promises it) and the email template is active.
//   • Who: users.verified = true, account open (not closed/blocked/suspended, not a
//     deleted-account address); with the program's "only people with a live listing"
//     setting, only those. Not anyone who already referred someone who signed up, opted out
//     (the email's link, or BAJA on WhatsApp), or whose last email bounced / was marked spam.
//   • Pacing: at most `perRun` emails per hourly run (sent + failed). Order: repeats first,
//     then new sign-ups, then people who signed up before it was switched on (newest first)
//     — so switching it on works through the old accounts a batch at a time.
//   • Night (lib/sendWindow.js — frame.quiet): nothing is looked at or sent; the first
//     daytime run sends whoever is due.
//   • Bounce / complaint: before a 2nd/3rd email, the previous email's Resend status
//     (emailStatus dep; needs a full-access key — RESEND_READ_API_KEY — on the site, the
//     sending key can't read). Unknown status → sent anyway (Resend itself never delivers to
//     an address on its suppression list).
//   • Email only: there is no approved WhatsApp template that carries the referral link.
//   • AUTOMATION_EMAIL_OVERRIDE (emailOverride) sends every email to the test address;
//     testAudience (an email prefix, local testing only) limits who is considered.
// Pure + dependency-injected (tests/referralPromo.test.mjs).
import { sendOnce } from './sendOnce.js';
import { isDeletedEmail } from '../accountDeletion.js';
import { referralConfig, referralUrl, PLAN_TEXT, isLive, REFERRALS_ID } from '../referrals/core.js';
import { ensureCode } from '../referrals/store.js';
import { PROMO_ID, promoConfig, promoProgress, promoNext, promoKey, promoStopKey, roundDownProof } from '../referrals/promo.js';

const H = 3600e3;
const enc = encodeURIComponent;
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const norm = (e) => String(e || '').trim().toLowerCase();
const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);
const isDup = (e) => e?.status === 409 || e?.code === '23505';
const BAD_EVENTS = { bounced: 'bounced', complained: 'complained', suppressed: 'bounced' };
const RANK = { repeat: 0, new: 1, existing: 2 };

// Every row of a query, 1000 at a time (PostgREST caps a page).
async function selectAll(db, table, query, size = 1000) {
  const out = [];
  for (let off = 0; ; off += size) {
    const rows = await db.select(table, `${query}&limit=${size}&offset=${off}`);
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

// THE selection (pure). → { due: [{ user, n, kind, dueAtMs, lastResendId }], counts }
// users: candidate rows · progress: promoProgress(logs) · referrers: Set of user ids who
// referred someone · liveOwners: Set of user ids with a live listing (null = not required).
export function pickPromo({ users = [], progress = new Map(), referrers = new Set(), liveOwners = null, cfg, nowMs, testAudience = '' }) {
  const counts = { checked: 0, closed: 0, referred: 0, optedOut: 0, bounced: 0, noListing: 0, finished: 0, excluded: 0, waiting: 0 };
  const due = [];
  for (const u of users) {
    if (testAudience && !norm(u?.email).startsWith(testAudience)) continue;
    counts.checked++;
    if (u?.verified !== true || closed(u)) { counts.closed++; continue; }
    const id = String(u.id);
    const p = progress.get(id) || { sent: 0, lastAtMs: 0, lastResendId: null, stop: null };
    if (p.stop === 'unsubscribed' || u.whatsapp_opted_out_at) { counts.optedOut++; continue; }
    if (p.stop) { counts.bounced++; continue; }
    if (referrers.has(id)) { counts.referred++; continue; }
    if (liveOwners && !liveOwners.has(id)) { counts.noListing++; continue; }
    const next = promoNext({ createdAtMs: Date.parse(u.created_at), sent: p.sent, lastAtMs: p.lastAtMs }, cfg, nowMs);
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
      automation_id: PROMO_ID, channel: 'event', status: 'sent', template_key: 'refpromo_stop', dedupe_key: promoStopKey(user.id),
      run_id: user.id, to_email: norm(user.email) || '-', subject: reason, error: JSON.stringify({ at: new Date().toISOString(), ...extra }),
    }], { returning: 'minimal' });
    return true;
  } catch (e) { if (isDup(e)) return false; throw e; }
}

// deps: { db, automation (the 'referral_promo' row), referralRow (the 'referrals' row),
//         templates, now, deliver, frame, siteUrl, emailOverride, emailStatus(resendId) →
//         'delivered' | 'bounced' | 'complained' | … | null,
//         testAudience, pauseMs, sleep }
export async function runReferralPromo(deps) {
  const { db, automation, referralRow, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '',
    emailOverride = '', emailStatus = null, testAudience = '', pauseMs = 0,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = deps;
  const out = { checked: 0, due: 0, sent: 0, failed: 0, skipped: 0, stopped: 0, held: 0 };
  const audience = testAudience ? norm(testAudience) : '';
  if (audience) out.testAudience = audience;
  const cfg = promoConfig(automation);
  if (!cfg.exists) return { ...out, skippedReason: 'not_set_up' };
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  const ref = referralConfig(referralRow);
  if (!ref.enabled) return { ...out, skippedReason: 'referrals_off' };
  if (!ref.referrer.enabled) return { ...out, skippedReason: 'referrer_reward_off' };
  const tpl = templates.find((t) => String(t.id) === String(cfg.templateId));
  if (!tpl || tpl.is_active === false) return { ...out, skippedReason: 'no_template' };
  if (frame.quiet) return { ...out, skippedReason: 'quiet_hours' };

  const nowMs = now.getTime();
  // Verified accounts old enough for the first email (and, without "existing users", only
  // those who signed up after it was switched on).
  const since = !cfg.includeExisting && cfg.enabledAt ? `&created_at=gte.${enc(cfg.enabledAt)}` : '';
  const users = await selectAll(db, 'users',
    `select=id,email,full_name,verified,active,blocked,suspended,created_at,whatsapp_opted_out_at&verified=eq.true&created_at=lte.${enc(new Date(nowMs - cfg.firstAfterHours * H).toISOString())}${since}&order=id.asc`);
  const [logs, persons] = await Promise.all([
    selectAll(db, 'email_log', `select=id,run_id,dedupe_key,created_at,resend_id,status,channel,subject&automation_id=eq.${PROMO_ID}&order=id.asc`),
    selectAll(db, 'email_log', `select=id,run_id&automation_id=eq.${REFERRALS_ID}&template_key=eq.ref_person&order=id.asc`),
  ]);
  let liveOwners = null;
  if (ref.requireReferrerListing) {
    const live = await selectAll(db, 'properties', 'select=id,created_by,status,admin_status,is_complete,is_delisted&origin=eq.user&admin_status=eq.active&order=id.asc');
    liveOwners = new Set(live.filter(isLive).map((p) => String(p.created_by)));
  }
  const { due, counts } = pickPromo({
    users, progress: promoProgress(logs), referrers: new Set(persons.map((p) => String(p.run_id))), liveOwners, cfg, nowMs, testAudience: audience,
  });
  Object.assign(out, { checked: counts.checked, due: due.length, counts });
  if (!due.length) return out;

  // The variables every email shares: the program's REAL settings + the proof line.
  const site = String(siteUrl || '').replace(/\/$/, '');
  const live = db.selectWithCount
    ? (await db.selectWithCount('properties', 'select=id&admin_status=eq.active&limit=1').catch(() => ({ count: 0 }))).count
    : (await db.select('properties', 'select=id&admin_status=eq.active').catch(() => [])).length;
  const shared = {
    referrals_url: `${site}/cuenta/referidos`,
    reward_plan: PLAN_TEXT[ref.referrer.plan] || PLAN_TEXT.verified,
    reward_days: String(ref.referrer.days),
    new_user_days: String(ref.newUser.days),
    milestone_count: String(ref.milestone.every),
    milestone_days: String(ref.milestone.days),
    active_listings: roundDownProof(live || 0),
  };

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
    const code = await ensureCode(db, { id: user.id, email: norm(user.email) });
    const r = await sendOnce({
      db, automationId: PROMO_ID, runId: user.id, dedupeKey: promoKey(user.id, n), tpl, frame, deliver,
      to: emailOverride || norm(user.email),
      vars: { ...shared, name: firstName(user.full_name), referral_url: referralUrl(site, code) },
    });
    if (r === 'sent') { out.sent++; if (pauseMs) await sleep(pauseMs); }
    else if (r === 'failed') out.failed++;
    else out.skipped++;
  }
  return out;
}

