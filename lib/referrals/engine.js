// Referral program — the hourly engine (run from /api/cron/automations) and the instant
// check when a listing goes live (lib/listingScan.js publishListing). Every step is
// safe to run again: states only move forward with a compare-and-set, rewards are keyed
// once-only, and each email is claimed in email_log before it is sent (sendOnce).
//
//   1. people who signed up through a link: once their first listing is LIVE (passed the
//      photo check, not a held duplicate, not waiting for payment) → same-person check →
//      qualified (+ rewards) or rejected
//   2. pending rewards → put on a listing (grant), email the person
//   3. granted rewards → "ends soon" reminders (remindDays), then expired
// Pure + dependency-injected (tests/referrals.test.mjs); lib/referrals/run.js wires it.
import { sendOnce } from '../automations/sendOnce.js';
import { linkedAccounts } from '../samePerson.js';
import { toE164 } from '../whatsappPhone.js';
import {
  REFERRALS_ID, TEMPLATE_KEYS, PLAN_TEXT, DAY, referralConfig, dataOf, isLive, listingHold,
  pickRewardListing, rewardOnListing, milestonesDue, reminderDue, maskName,
} from './core.js';
import { peopleIn, personOf, personsOf, updateRecord, createReward, rewardsIn } from './store.js';

const q = (s) => encodeURIComponent(s);
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const titleOf = (p) => [p?.property_type, p?.neighborhood || p?.city].filter(Boolean).join(' · ') || 'Tu propiedad';
const LISTING_COLS = 'id,created_by,created_at,status,admin_status,is_complete,is_delisted,contact_phone,raw_data,property_type,neighborhood,city,promotion_plan,promotion_expires_at';
const USER_COLS = 'id,email,full_name,phone,phone_verified_at,verified,active,blocked,suspended';

async function userById(db, id) {
  const [u] = await db.select('users', `select=${USER_COLS}&id=eq.${q(id)}&limit=1`);
  return u || null;
}
const listingsOf = (db, uid) => db.select('properties', `select=${LISTING_COLS}&created_by=eq.${q(uid)}&origin=eq.user&order=created_at.asc&limit=200`);
const okAccount = (u) => !!u && u.active !== false && !u.blocked && !u.suspended;

// deps: { db, automation (the row), templates, now, grant(pid, plan, { days, extendFrom }) → until,
//         deliver, frame, siteUrl, extendUrl(reward, data) → url, formatDate, priceFor(plan),
//         emailOverride, phonePrefix, samePersonMin }
function context(deps) {
  const cfg = referralConfig(deps.automation);
  const now = deps.now || new Date();
  const tpl = new Map((deps.templates || []).map((t) => [t.key, t]));
  return { ...deps, cfg, now, nowMs: now.getTime(), tpl };
}

// ── 1. A person who signed up through a link ───────────────────────────────────────
// → 'qualified' | 'rejected' | 'waiting' | 'skipped'
async function evaluate(ctx, person, out) {
  const { db, cfg, nowMs } = ctx;
  const d = dataOf(person);
  const referredId = d.referred_id;
  const referrerId = String(person.run_id);
  const [referred, referrer] = await Promise.all([userById(db, referredId), userById(db, referrerId)]);
  if (!referred) return 'skipped';                     // account deleted: leave it as it was
  const listings = await listingsOf(db, referredId);
  const live = listings.find(isLive);
  if (!live) {
    const hold = listingHold(listings);
    if (d.hold !== hold) await updateRecord(db, person, { patch: { hold } });
    out.waiting++;
    return 'waiting';
  }
  const reject = async (reason, extra = {}) => {
    const row = await updateRecord(db, person, { from: 'signed_up', to: 'rejected', patch: { reason, rejected_at: new Date(nowMs).toISOString(), listing_id: live.id, hold: null, ...extra } });
    if (row) out.rejected++;
    return 'rejected';
  };
  if (!okAccount(referrer)) return reject('referrer_inactive');
  if (!okAccount(referred)) return reject('referred_blocked');
  if (String(referrerId) === String(referredId)) return reject('same_person', { matched: ['account'] });

  // Same person, different account (lib/samePerson.js): their listing's signals and phones
  // against the referrer's listings and verified WhatsApp. An admin can override it.
  if (!d.override) {
    const prefix = ctx.phonePrefix || '';
    const theirs = await db.select('properties', `select=id,created_by,contact_phone,raw_data&created_by=eq.${q(referrerId)}&limit=500`);
    const phones = [...new Set([
      ...listings.map((p) => toE164(p.contact_phone, prefix)),
      referred.phone_verified_at ? toE164(referred.phone, prefix) : null,
      toE164(referred.phone, prefix),
    ].filter(Boolean))];
    const verified = referrer.phone_verified_at && referrer.phone ? [{ id: referrerId, phone: toE164(referrer.phone, prefix) }] : [];
    const signals = live.raw_data?.signals || {};
    const hit = linkedAccounts(referredId, signals, theirs, ctx.samePersonMin || 2, { phones, prefix, verified })
      .find((x) => String(x.userId) === referrerId);
    // the same device / connection on any of the new person's listings counts too
    const anySig = !hit && listings.some((p) => linkedAccounts(referredId, p.raw_data?.signals || {}, theirs, ctx.samePersonMin || 2, { prefix }).some((x) => String(x.userId) === referrerId));
    if (hit || anySig) return reject('same_person', { matched: hit?.matched || ['device'] });
  }

  const row = await updateRecord(db, person, { from: 'signed_up', to: 'qualified', patch: { qualified_at: new Date(nowMs).toISOString(), listing_id: live.id, hold: null } });
  if (!row) return 'skipped';                          // another run got there first
  out.qualified++;

  const done = (await personsOf(db, referrerId)).filter((p) => p.subject === 'qualified');
  const capped = cfg.maxRewardsPerReferrer > 0 && done.length > cfg.maxRewardsPerReferrer;
  if (cfg.newUser.enabled) {
    await createReward(db, { key: `new:${referredId}`, user: referred, data: { type: 'new_user', plan: cfg.newUser.plan, days: cfg.newUser.days, property_id: live.id, referred_id: referredId, referrer_id: referrerId, person_id: person.id } });
  }
  if (cfg.referrer.enabled && !capped) {
    await createReward(db, { key: `referrer:${referredId}`, user: referrer, data: { type: 'referrer', plan: cfg.referrer.plan, days: cfg.referrer.days, referred_id: referredId, referred_name: maskName(referred.full_name, referred.email), person_id: person.id } });
  }
  if (!capped) {
    for (const k of milestonesDue(done.length, cfg)) {
      await createReward(db, { key: `milestone:${referrerId}:${k}`, user: referrer, data: { type: 'milestone', plan: cfg.milestone.plan, days: cfg.milestone.days, step: k, at_count: k * cfg.milestone.every } });
    }
  }
  return 'qualified';
}

// ── 2. Put a pending reward on a listing ─────────────────────────────────────────────
async function grantOne(ctx, reward, out) {
  const { db, nowMs } = ctx;
  const d = dataOf(reward);
  const uid = String(reward.run_id);
  const listings = await listingsOf(db, uid);
  const pick = d.property_id
    ? rewardOnListing(listings.find((p) => String(p.id) === String(d.property_id)), d.plan, nowMs)
    : pickRewardListing(listings, d.plan, nowMs);
  if (!pick) {
    const wait = d.property_id ? 'listing_not_live' : 'no_live_listing';
    if (d.wait !== wait) await updateRecord(db, reward, { patch: { wait } });
    out.rewardsWaiting++;
    return null;
  }
  // Take it first (pending → granted), then write the promotion: a retry or a second run
  // can never add the days twice. A failed write puts it back to pending.
  const from = pick.extendFrom && Date.parse(pick.extendFrom) > nowMs ? Date.parse(pick.extendFrom) : nowMs;
  const planned = new Date(from + d.days * DAY).toISOString();
  const taken = await updateRecord(db, reward, { from: 'pending', to: 'granted', patch: { property_id: pick.id, plan_applied: pick.plan, granted_at: new Date(nowMs).toISOString(), until: planned, wait: null } });
  if (!taken) return null;
  try {
    const until = await ctx.grant(pick.id, pick.plan, { days: d.days, extendFrom: pick.extendFrom });
    const row = until && until !== planned ? await updateRecord(db, taken, { patch: { until } }) : taken;
    out.rewardsGranted++;
    return row || taken;
  } catch (e) {
    await updateRecord(db, taken, { to: 'pending', patch: { property_id: d.property_id || null, plan_applied: null, granted_at: null, until: null, last_error: String(e?.message || e).slice(0, 300) } });
    out.failed++;
    return null;
  }
}

// ── Emails ───────────────────────────────────────────────────────────────────────────
async function emailVars(ctx, reward, d) {
  const { db, cfg } = ctx;
  const user = await userById(db, reward.run_id);
  const [p] = d.property_id ? await db.select('properties', `select=id,property_type,neighborhood,city&id=eq.${q(d.property_id)}&limit=1`) : [null];
  const qualified = (await personsOf(db, reward.run_id)).filter((x) => x.subject === 'qualified').length;
  let referrerName = '';
  if (d.type === 'new_user' && d.referrer_id) { const r = await userById(db, d.referrer_id); referrerName = maskName(r?.full_name, r?.email); }
  const site = ctx.siteUrl || '';
  return {
    user,
    vars: {
      name: firstName(user?.full_name),
      property_title: titleOf(p),
      property_url: p ? `${site}/propiedad/${p.id}` : `${site}/cuenta/publicaciones`,
      free_until: d.until ? (ctx.formatDate || ((s) => s))(d.until) : '',
      days_left: d.until ? String(Math.max(1, Math.ceil((Date.parse(d.until) - ctx.nowMs) / DAY))) : '',
      free_days: String(d.days || ''),
      reward_plan: PLAN_TEXT[d.plan_applied || d.plan] || PLAN_TEXT.verified,
      referred_name: d.referred_name || '',
      referrer_name: referrerName,
      referral_count: String(qualified),
      milestone_count: String(cfg.milestone.every),
      milestone_days: String(cfg.milestone.days),
      reward_days: String(cfg.referrer.days),
      new_user_days: String(cfg.newUser.days),
      referrals_url: `${site}/cuenta/referidos`,
      extend_url: ctx.extendUrl && p ? ctx.extendUrl(reward, { ...d, property_id: p.id }) : `${site}/cuenta/publicaciones`,
      price: ctx.priceFor ? ctx.priceFor(d.plan_applied || d.plan) : '',
    },
  };
}
const REWARD_TEMPLATE = { new_user: TEMPLATE_KEYS.newUser, referrer: TEMPLATE_KEYS.referrer, milestone: TEMPLATE_KEYS.milestone };

async function send(ctx, { key, tplKey, reward, d }) {
  const tpl = ctx.tpl.get(tplKey);
  if (!tpl) return 'no_template';
  const { user, vars } = await emailVars(ctx, reward, d);
  return sendOnce({
    db: ctx.db, automationId: REFERRALS_ID, runId: null, dedupeKey: key, tpl, vars, frame: ctx.frame, deliver: ctx.deliver,
    to: user?.email ? (ctx.emailOverride || user.email) : '',
  });
}

// "You earned it" email for a granted reward (once; retried by later runs until it goes).
async function rewardEmail(ctx, reward, out) {
  const d = dataOf(reward);
  if (d.emailed || !REWARD_TEMPLATE[d.type]) return;
  const r = await send(ctx, { key: `ref-granted:${reward.id}`, tplKey: REWARD_TEMPLATE[d.type], reward, d });
  if (r === 'sent' || r === 'duplicate' || r === 'no_template') {
    await updateRecord(ctx.db, reward, { patch: { emailed: r === 'no_template' ? 'no_template' : true } });
    if (r === 'sent') out.emailed++;
  } else if (r === 'failed') out.failed++;
}

// ── 3. Reminders, then the end ───────────────────────────────────────────────────────
async function followUp(ctx, reward, out) {
  const { db, nowMs, cfg } = ctx;
  const d = dataOf(reward);
  if (!d.until) return;
  if (Date.parse(d.until) <= nowMs) {
    if (await updateRecord(db, reward, { from: 'granted', to: 'expired', patch: { expired_at: new Date(nowMs).toISOString() } })) out.expired++;
    return;
  }
  const step = reminderDue(d.until, cfg.remindDays, nowMs);
  if (!step || (d.reminded || []).includes(step)) return;
  // Only the reward that ends the listing's promotion reminds (a paid renewal or a later
  // reward moved the end → nothing to remind about for this one).
  const [p] = await db.select('properties', `select=id,promotion_plan,promotion_expires_at&id=eq.${q(d.property_id)}&limit=1`);
  if (!p?.promotion_plan || Math.abs(Date.parse(p.promotion_expires_at) - Date.parse(d.until)) > 3600000) return;
  const r = await send(ctx, { key: `ref-remind:${reward.id}:${step}`, tplKey: TEMPLATE_KEYS.ending, reward, d });
  if (r === 'sent' || r === 'duplicate') {
    await updateRecord(db, reward, { patch: { reminded: [...(d.reminded || []), step] } });
    if (r === 'sent') out.reminded++;
  } else if (r === 'failed') out.failed++;
}

const emptyOut = () => ({ qualified: 0, rejected: 0, waiting: 0, rewardsGranted: 0, rewardsWaiting: 0, emailed: 0, reminded: 0, expired: 0, failed: 0 });

export async function runReferrals(deps) {
  const ctx = context(deps);
  const out = emptyOut();
  if (!ctx.cfg.exists) return { ...out, skippedReason: 'not_set_up' };
  // Switched off: no new referrals or rewards; rewards already given still end on time
  // and still get their reminder.
  if (ctx.cfg.enabled) {
    for (const person of await peopleIn(ctx.db, 'signed_up')) await evaluate(ctx, person, out);
    for (const reward of await rewardsIn(ctx.db, ['pending'])) await grantOne(ctx, reward, out);
  }
  for (const reward of await rewardsIn(ctx.db, ['granted'])) {
    await rewardEmail(ctx, reward, out);
    await followUp(ctx, reward, out);
  }
  return out;
}

// A listing just went live: settle that owner's referral now instead of at the next
// hourly run (the referrer may be waiting on the page).
export async function settleReferred(deps, userId) {
  const ctx = context(deps);
  const out = emptyOut();
  if (!ctx.cfg.enabled) return out;
  const person = await personOf(ctx.db, userId);
  if (person?.subject === 'signed_up') await evaluate(ctx, person, out);
  // their own pending rewards (new-user reward, or a referrer who just got a listing)
  // and the referrer's, granted + emailed
  const ids = [String(userId), person ? String(person.run_id) : null].filter(Boolean);
  for (const reward of await rewardsIn(ctx.db, ['pending'])) if (ids.includes(String(reward.run_id))) await grantOne(ctx, reward, out);
  for (const reward of await rewardsIn(ctx.db, ['granted'])) if (ids.includes(String(reward.run_id))) await rewardEmail(ctx, reward, out);
  return out;
}
