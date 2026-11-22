// "Share your listing" automations, run hourly from /api/cron/automations:
//   runShareNudge  — 'share_nudge': "share your listing" emails N hours after publishing
//                    (share-nudge-published) and once when it gets few views
//                    (share-nudge-lowviews). Only listings published after the switch-on.
//   runShareReward — 'share_reward': a listing whose share links brought `visits` unique
//                    people gets Verified / home page for `days` days (the referral program's
//                    stacking rules + grant), once per listing; email share-reward-earned.
// Pure + dependency-injected (tests/shareListing.test.mjs); app/api/cron/automations wires it.
import { sendOnce } from './sendOnce.js';
import { rewardOnListing, isLive, PLAN_TEXT } from '../referrals/core.js';
import { sharePageUrl } from '../shareLinks.js';
import {
  SHARE_NUDGE_ID, SHARE_REWARD_ID, TEMPLATE_KEYS, HOUR, DAY,
  shareNudgeConfig, shareRewardConfig, nudgeStepDue, lowViewsDue, rewardDecision,
} from '../shareReward.js';

const q = (s) => encodeURIComponent(s);
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const titleOf = (p) => [p?.property_type, p?.neighborhood || p?.city].filter(Boolean).join(' · ') || 'Tu propiedad';
const isDup = (e) => e?.status === 409 || e?.code === '23505';
const LISTING_COLS = 'id,created_by,created_at,status,admin_status,is_complete,is_delisted,property_type,neighborhood,city,promotion_plan,promotion_expires_at';
const REWARD_KIND = 'share_reward';

async function usersById(db, ids) {
  const out = new Map();
  for (const part of chunks([...new Set(ids.filter(Boolean).map(String))], 200)) {
    for (const u of await db.select('users', `select=id,email,full_name,active,blocked,suspended&id=${inList(part)}`)) out.set(String(u.id), u);
  }
  return out;
}
const okUser = (u) => !!u && u.active !== false && !u.blocked && !u.suspended;

// The admin's default templates use listing_title / listing_url; property_* kept as aliases.
function baseVars(siteUrl, user, l) {
  const url = `${siteUrl}/propiedad/${l.id}`;
  return {
    name: firstName(user?.full_name),
    listing_title: titleOf(l),
    listing_url: url,
    property_title: titleOf(l),
    property_url: url,
    share_url: sharePageUrl(siteUrl, l.id),
  };
}
// A template by the automation row's id (template_id / reminder_template_id), else by its key.
const pickTpl = (templates, id, key) => (id && templates.find((t) => String(t.id) === String(id))) || templates.find((t) => t.key === key) || null;

// ── Nudge ────────────────────────────────────────────────────────────────────────
// deps: { db, automation, templates, now, deliver, frame, siteUrl, emailOverride,
//         fetchViews?(ids) → Map(id → views), shareVisits?() → Map(id → unique visits) }
export async function runShareNudge(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '', emailOverride = '', fetchViews, shareVisits, limit = 200 } = deps;
  const out = { checked: 0, sent: 0, lowViews: 0, failed: 0 };
  const cfg = shareNudgeConfig(automation);
  if (!cfg.exists) return { ...out, skippedReason: 'not_set_up' };
  if (!cfg.enabled || !cfg.enabledAt) return { ...out, skippedReason: 'disabled' };
  const pubTpl = pickTpl(templates, automation.template_id, TEMPLATE_KEYS.published);
  const lowTpl = pickTpl(templates, automation.reminder_template_id, TEMPLATE_KEYS.lowViews);
  const nowMs = now.getTime();

  // listings published after the switch-on, young enough for a step or the low-views check
  const horizon = Math.max(cfg.steps[cfg.steps.length - 1] + cfg.graceHours, cfg.lowViews ? cfg.lowViews.afterHours + 24 * 14 : 0);
  const since = new Date(Math.max(Date.parse(cfg.enabledAt), nowMs - horizon * HOUR)).toISOString();
  const listings = (await db.select('properties', `select=${LISTING_COLS}&origin=eq.user&status=eq.published&admin_status=eq.active&created_at=gte.${q(since)}&order=created_at.asc&limit=2000`))
    .filter((l) => isLive(l) && l.created_by);
  if (!listings.length) return out;
  const sent = new Set((await db.select('email_log', `select=dedupe_key&automation_id=eq.${SHARE_NUDGE_ID}&created_at=gte.${q(since)}&limit=10000`)).map((r) => r.dedupe_key));
  const users = await usersById(db, listings.map((l) => l.created_by));

  const due = [];
  for (const l of listings) {
    out.checked++;
    const done = cfg.steps.filter((h) => sent.has(`share-nudge:${l.id}:${h}`));
    const step = nudgeStepDue(l.created_at, cfg.steps, nowMs, done, cfg.graceHours);
    if (step && pubTpl) due.push({ l, kind: 'published', key: `share-nudge:${l.id}:${step}`, tpl: pubTpl, extra: { hours: String(step), days: String(Math.round(step / 24)) } });
  }
  // low views: listings old enough that haven't had it
  if (cfg.lowViews && lowTpl && fetchViews) {
    const old = listings.filter((l) => nowMs >= Date.parse(l.created_at) + cfg.lowViews.afterHours * HOUR && !sent.has(`share-lowviews:${l.id}`));
    if (old.length) {
      const [views, visits] = await Promise.all([fetchViews(old.map((l) => String(l.id))), shareVisits ? shareVisits() : new Map()]);
      for (const l of old) {
        const v = Number(views.get(String(l.id)) || 0);
        if (lowViewsDue({ publishedAtIso: l.created_at, nowMs, views: v, shareVisits: visits.get(String(l.id)) || 0, lowViews: cfg.lowViews })) {
          due.push({ l, kind: 'lowViews', key: `share-lowviews:${l.id}`, tpl: lowTpl, extra: { views: String(v) } });
        }
      }
    }
  }

  for (const d of due.slice(0, limit)) {
    const user = users.get(String(d.l.created_by));
    if (!okUser(user)) continue;
    const r = await sendOnce({
      db, automationId: SHARE_NUDGE_ID, dedupeKey: d.key, tpl: d.tpl, frame, deliver,
      to: user?.email ? (emailOverride || user.email) : '',
      vars: { ...baseVars(siteUrl, user, d.l), ...d.extra },
    });
    if (r === 'sent') { if (d.kind === 'lowViews') out.lowViews++; else out.sent++; }
    if (r === 'failed') out.failed++;
  }
  return out;
}

// ── Reward ───────────────────────────────────────────────────────────────────────
// Records: email_log { automation_id 'share_reward', channel 'event', template_key
// 'share_reward', dedupe_key 'share:reward:<listing id>:<step>:ev', run_id = owner,
// subject = listing id, error = JSON details { step, visits, plan, days, until, emailed } }.
export const dataOf = (row) => { try { const v = JSON.parse(row?.error || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
// step 1 (the only one while perListingOnce) → share:reward:<listing id>:ev (the admin reads it)
export const rewardKey = (pid, step) => (Number(step) === 1 ? `share:reward:${pid}:ev` : `share:reward:${pid}:${step}:ev`);

export async function rewardsFor(db, listingIds) {
  const rows = [];
  for (const part of chunks(listingIds.map(String), 150)) {
    rows.push(...await db.select('email_log', `select=id,run_id,subject,error,dedupe_key,created_at&automation_id=eq.${SHARE_REWARD_ID}&template_key=eq.${REWARD_KIND}&subject=${inList(part)}&limit=2000`));
  }
  return rows;
}

// deps: { db, automation, templates, now, shareVisits() → Map(id → unique visits),
//         grant(pid, plan, { days, extendFrom }) → until ISO, deliver, frame, siteUrl,
//         emailOverride, formatDate }
export async function runShareReward(deps) {
  const { db, automation, templates = [], now = new Date(), shareVisits, grant, deliver, frame = {}, siteUrl = '', emailOverride = '', formatDate = (s) => String(s).slice(0, 10) } = deps;
  const out = { checked: 0, granted: 0, emailed: 0, failed: 0 };
  const cfg = shareRewardConfig(automation);
  if (!cfg.exists) return { ...out, skippedReason: 'not_set_up' };
  const nowMs = now.getTime();
  const tpl = pickTpl(templates, automation?.template_id, TEMPLATE_KEYS.reward);

  if (cfg.enabled) {
    const visits = await shareVisits();
    const ids = [...visits.entries()].filter(([, v]) => v >= cfg.visits).map(([id]) => String(id));
    if (ids.length) {
      const listings = [];
      for (const part of chunks(ids, 150)) listings.push(...await db.select('properties', `select=${LISTING_COLS}&origin=eq.user&id=${inList(part)}`));
      const given = new Map();
      for (const r of await rewardsFor(db, ids)) {
        const k = String(r.subject);
        given.set(k, [...(given.get(k) || []), Number(dataOf(r).step)]);
      }
      const users = await usersById(db, listings.map((l) => l.created_by));
      for (const l of listings) {
        out.checked++;
        const user = users.get(String(l.created_by));
        const v = Number(visits.get(String(l.id)) || 0);
        const d = rewardDecision({ visits: v, cfg, given: given.get(String(l.id)) || [], live: isLive(l) && okUser(user) });
        if (!d) continue;
        const pick = rewardOnListing(l, cfg.reward, nowMs);
        if (!pick) continue;
        // claim it first (unique key), then write the promotion: never twice
        const from = pick.extendFrom && Date.parse(pick.extendFrom) > nowMs ? Date.parse(pick.extendFrom) : nowMs;
        const data = { step: d.step, visits: v, needed: cfg.visits * d.step, plan: pick.plan, days: cfg.days, granted_at: now.toISOString(), until: new Date(from + cfg.days * DAY).toISOString() };
        let row;
        try {
          [row] = await db.insert('email_log', [{ automation_id: SHARE_REWARD_ID, channel: 'event', status: 'sent', template_key: REWARD_KIND, dedupe_key: rewardKey(l.id, d.step), run_id: l.created_by, to_email: user.email || '-', subject: String(l.id), error: JSON.stringify(data) }]);
        } catch (e) { if (isDup(e)) continue; throw e; }
        try {
          const until = await grant(pick.id, pick.plan, { days: cfg.days, extendFrom: pick.extendFrom });
          if (until && until !== data.until) {
            data.until = until;
            await db.update('email_log', `id=eq.${q(row.id)}`, { error: JSON.stringify(data) }, { returning: 'minimal' });
            row.error = JSON.stringify(data);
          }
          out.granted++;
        } catch {
          await db.remove('email_log', `id=eq.${q(row.id)}`);
          out.failed++;
        }
      }
    }
  }

  // the "you earned it" email: sent once per reward, retried by later runs (quiet hours)
  if (tpl) {
    const pending = (await db.select('email_log', `select=id,run_id,subject,error,dedupe_key,created_at&automation_id=eq.${SHARE_REWARD_ID}&template_key=eq.${REWARD_KIND}&created_at=gte.${q(new Date(nowMs - 14 * DAY).toISOString())}&limit=500`))
      .filter((r) => !dataOf(r).emailed);
    if (pending.length) {
      const users = await usersById(db, pending.map((r) => r.run_id));
      const props = new Map();
      for (const part of chunks(pending.map((r) => String(r.subject)), 150)) {
        for (const p of await db.select('properties', `select=id,property_type,neighborhood,city&id=${inList(part)}`)) props.set(String(p.id), p);
      }
      for (const r of pending) {
        const d = dataOf(r);
        const user = users.get(String(r.run_id));
        const p = props.get(String(r.subject)) || { id: r.subject };
        const res = await sendOnce({
          db, automationId: SHARE_REWARD_ID, dedupeKey: `share-reward:${r.subject}:${d.step}`, tpl, frame, deliver,
          to: user?.email ? (emailOverride || user.email) : '',
          vars: {
            ...baseVars(siteUrl, user, p),
            visits: String(d.visits || ''),
            visits_needed: String(d.needed || d.visits || ''),
            reward_text: PLAN_TEXT[d.plan] || PLAN_TEXT.verified,
            reward_plan: PLAN_TEXT[d.plan] || PLAN_TEXT.verified,
            reward_days: String(d.days || ''),
            free_days: String(d.days || ''),
            free_until: d.until ? formatDate(d.until) : '',
          },
        });
        if (res === 'sent' || res === 'duplicate' || res === 'no_email' || res === 'no_template') {
          await db.update('email_log', `id=eq.${q(r.id)}`, { error: JSON.stringify({ ...d, emailed: res === 'sent' || res === 'duplicate' ? true : res }) }, { returning: 'minimal' });
          if (res === 'sent') out.emailed++;
        } else if (res === 'failed') out.failed++;
      }
    }
  }
  return out;
}
