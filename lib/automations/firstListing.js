// "First listing → free home display" automation. Pure and dependency-injected so it
// can be unit-tested against an in-memory PostgREST (tests/firstListing.test.mjs); the
// cron route (app/api/cron/automations) wires in the real DB, Resend and Stripe helpers.
//
// Each tick:
//   1. convert — gifted/reminded runs whose listing got a paid promotion after the gift
//   2. finish  — gifted/reminded runs past free_until
//   3. remind  — gifted runs within remind_days_before of the end → ending-soon email
//   4. retry   — gifted runs whose gift email never went out (a failed send)
//   5. gift    — users whose FIRST user listing (created after the switch-on) is
//                wait_days old → grant free home display + gift email.
//                Tiers (migration 009): the first `first_tier_count` sellers ever to list
//                get `free_days`; everyone after that gets `later_free_days`. A seller's
//                place in line counts every seller whose first listing came before theirs.
//      With `claimUrl` (the cron passes it): the gift is only OFFERED — the email's
//      "Verificar mi publicación" button (/api/gift/claim) grants it when clicked
//      (claimGift below). An open offer is a run with status 'skipped' +
//      skip_reason 'offered' (no migration: 'skipped' already means "never pick this
//      user again"); unclaimed after OFFER_DAYS → skip_reason 'not_claimed'.
// Every email is claimed in email_log by a unique dedupe key BEFORE it is sent, so a
// crash, retry or overlapping tick can never send it twice.
import { sendOnce as sendTemplated } from './sendOnce.js';

export const AUTOMATION_ID = 'first_listing_free_home';
const DAY = 86400000;
const ACTIVE = ['gifted', 'reminded'];
export const OFFER_DAYS = 14;          // the claim link + offer stay valid this long

const q = (s) => encodeURIComponent(s);
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const titleOf = (p) => [p.property_type, p.neighborhood || p.city].filter(Boolean).join(' · ') || 'Tu propiedad';
const isDup = (e) => e?.status === 409 || e?.code === '23505';

// The tier list: free_tiers (migration 010) = [{ sellers, days }, …] in order; before
// that, the single first_tier_count/free_days pair (009); before that, no tiers at all.
export function tiersOf(automation) {
  const list = Array.isArray(automation.free_tiers) ? automation.free_tiers : null;
  const clean = (list || []).map((t) => ({ sellers: Number(t?.sellers), days: Number(t?.days) }))
    .filter((t) => Number.isInteger(t.sellers) && t.sellers > 0 && Number.isInteger(t.days) && t.days > 0);
  if (clean.length) return clean;
  if (automation.first_tier_count != null) return [{ sellers: Number(automation.first_tier_count), days: Number(automation.free_days) }];
  return [];
}

// Free days for a seller at `place` (1 = first seller ever): walk the tiers
// (#1–30 → 30 days, next 20 → 20, …); past the last tier → later_free_days.
// Without any tier settings everyone gets free_days, as before.
export function freeDaysFor(automation, place) {
  const tiers = tiersOf(automation);
  const later = automation.later_free_days;
  if (!tiers.length || later == null) return automation.free_days;
  let upTo = 0;
  for (const t of tiers) { upTo += t.sellers; if (place <= upTo) return t.days; }
  return later;
}
// Free days a seller's first listing earns: their place in line = sellers whose first
// listing came before it, + 1 (used when offering, re-sending the offer and claiming).
async function daysForListing(db, automation, userId, createdAt) {
  const earlier = await db.select('properties', `select=created_by&origin=eq.user&created_at=lt.${q(createdAt)}&limit=100000`);
  const place = new Set(earlier.map((p) => String(p.created_by)).filter((id) => id && id !== String(userId))).size + 1;
  return freeDaysFor(automation, place);
}
// Days a run was granted (for the emails' {{free_days}}).
const runDays = (run, fallback) => (run.gifted_at && run.free_until ? Math.round((Date.parse(run.free_until) - Date.parse(run.gifted_at)) / DAY) : fallback);

export async function runFirstListing(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, grant, frame = {}, siteUrl = '',
    extendUrl, claimUrl, formatDate = (s) => s, price = 'US$20', emailOverride = '', limit = 200 } = deps;
  const out = { gifted: 0, offered: 0, expired: 0, reminded: 0, converted: 0, done: 0, skipped: 0, failed: 0, retried: 0 };
  if (!automation || !automation.enabled || !automation.enabled_at) return { ...out, skippedReason: 'disabled' };

  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const tplById = new Map(templates.map((t) => [String(t.id), t]));
  const giftTpl = tplById.get(String(automation.gift_template_id));
  const remindTpl = tplById.get(String(automation.reminder_template_id));
  const setRun = (id, patch) => db.update('automation_runs', `id=eq.${q(id)}`, { ...patch, updated_at: nowIso }, { returning: 'minimal' });

  // Send one templated email exactly once (see ./sendOnce.js).
  async function sendOnce({ key, run, tpl, user, property, extra = {} }) {
    const vars = {
      name: firstName(user?.full_name),
      property_title: titleOf(property),
      property_url: `${siteUrl}/propiedad/${property.id}`,
      free_until: run.free_until ? formatDate(run.free_until) : '',
      days_left: run.free_until ? String(Math.max(1, Math.ceil((Date.parse(run.free_until) - nowMs) / DAY))) : '',
      free_days: String(runDays(run, automation.free_days)),
      extend_url: extendUrl ? extendUrl(run, property) : '',
      claim_url: claimUrl ? claimUrl(run, property) : '',
      price,
      ...extra,
    };
    const r = await sendTemplated({
      db, automationId: AUTOMATION_ID, runId: run.id, dedupeKey: key, tpl, vars, frame, deliver,
      to: user?.email ? (emailOverride || user.email) : '',
      onError: (msg) => setRun(run.id, { last_error: msg }),
    });
    if (r === 'failed') out.failed++;
    if (r === 'sent' && run.last_error) await setRun(run.id, { last_error: null });
    return r;
  }

  const loadUsers = async (ids) => {
    if (!ids.length) return new Map();
    const rows = await db.select('users', `select=id,email,full_name&id=${inList(ids)}`);
    return new Map(rows.map((u) => [String(u.id), u]));
  };
  const loadProps = async (ids) => {
    if (!ids.length) return new Map();
    const rows = await db.select('properties', `select=id,created_by,created_at,property_type,neighborhood,city,promotion_plan,promotion_expires_at&id=${inList(ids)}`);
    return new Map(rows.map((p) => [String(p.id), p]));
  };

  // ── 1–4: runs already in the flow ─────────────────────────────────────────────
  const active = await db.select('automation_runs', `automation_id=eq.${AUTOMATION_ID}&status=${inList(ACTIVE)}&order=gifted_at.asc&limit=1000`);
  if (active.length) {
    const users = await loadUsers([...new Set(active.map((r) => r.user_id))]);
    const props = await loadProps([...new Set(active.map((r) => r.property_id).filter(Boolean))]);
    const pays = await db.select('payments', `select=property_id,created_at&status=eq.succeeded&property_id=${inList(active.map((r) => r.property_id).filter(Boolean))}`);
    const sentGift = new Set((await db.select('email_log', `select=dedupe_key&dedupe_key=${inList(active.map((r) => `gift:${r.id}`))}`)).map((l) => l.dedupe_key));

    for (const run of active) {
      const paidAfter = pays.some((p) => String(p.property_id) === String(run.property_id) && Date.parse(p.created_at) > Date.parse(run.gifted_at));
      if (paidAfter) { await setRun(run.id, { status: 'converted', converted_at: nowIso }); out.converted++; continue; }
      if (Date.parse(run.free_until) <= nowMs) { await setRun(run.id, { status: 'done' }); out.done++; continue; }
      const user = users.get(String(run.user_id));
      const property = props.get(String(run.property_id));
      if (!property) continue;
      if (run.status === 'gifted' && !sentGift.has(`gift:${run.id}`)) {
        if ((await sendOnce({ key: `gift:${run.id}`, run, tpl: giftTpl, user, property })) === 'sent') out.retried++;
      }
      const remindFrom = Date.parse(run.free_until) - automation.remind_days_before * DAY;
      if (run.status === 'gifted' && nowMs >= remindFrom) {
        const r = await sendOnce({ key: `remind:${run.id}`, run, tpl: remindTpl, user, property });
        if (r === 'sent' || r === 'duplicate') { await setRun(run.id, { status: 'reminded', reminded_at: nowIso }); if (r === 'sent') out.reminded++; }
      }
    }
  }

  // ── open offers (claim mode): resend a failed offer email; expire old offers ──
  const offers = await db.select('automation_runs', `automation_id=eq.${AUTOMATION_ID}&status=eq.skipped&skip_reason=eq.offered&order=created_at.asc&limit=1000`);
  if (offers.length) {
    const users = await loadUsers([...new Set(offers.map((r) => r.user_id))]);
    const props = await loadProps([...new Set(offers.map((r) => r.property_id).filter(Boolean))]);
    const sentGift = new Set((await db.select('email_log', `select=dedupe_key&dedupe_key=${inList(offers.map((r) => `gift:${r.id}`))}`)).map((l) => l.dedupe_key));
    for (const run of offers) {
      if (nowMs - Date.parse(run.created_at) > OFFER_DAYS * DAY) { await setRun(run.id, { skip_reason: 'not_claimed' }); out.expired++; continue; }
      const property = props.get(String(run.property_id));
      if (property && claimUrl && !sentGift.has(`gift:${run.id}`)) {
        const days = await daysForListing(db, automation, run.user_id, run.first_listed_at || property.created_at);
        if ((await sendOnce({ key: `gift:${run.id}`, run, tpl: giftTpl, user: users.get(String(run.user_id)), property, extra: { free_days: String(days) } })) === 'sent') out.retried++;
      }
    }
  }

  // ── 5: new first listings ─────────────────────────────────────────────────────
  const cutoff = new Date(nowMs - automation.wait_days * DAY).toISOString();
  const candidates = await db.select('properties',
    `select=id,created_by,created_at&origin=eq.user&created_at=gte.${q(automation.enabled_at)}&created_at=lte.${q(cutoff)}&order=created_at.asc&limit=2000`);
  const userIds = [...new Set(candidates.map((p) => p.created_by).filter(Boolean).map(String))];
  if (!userIds.length) return out;
  const known = new Set((await db.select('automation_runs', `select=user_id&automation_id=eq.${AUTOMATION_ID}&user_id=${inList(userIds)}`)).map((r) => String(r.user_id)));
  const todo = userIds.filter((u) => !known.has(u)).slice(0, limit);
  const users = await loadUsers(todo);

  for (const uid of todo) {
    const [first] = await db.select('properties',
      `select=id,created_by,created_at,admin_status,status,is_complete,feature_image_url,property_type,neighborhood,city,promotion_plan,promotion_expires_at&created_by=eq.${q(uid)}&origin=eq.user&order=created_at.asc&limit=1`);
    if (!first) continue;
    // Photos still being checked, or rejected and waiting for the seller to fix them: decide
    // later (a skip is final), once the listing is live or definitely not.
    if (first.status === 'scanning' || first.status === 'rejected') continue;
    const base = { automation_id: AUTOMATION_ID, user_id: uid, property_id: first.id, first_listed_at: first.created_at };
    let reason = null;
    if (Date.parse(first.created_at) < Date.parse(automation.enabled_at)) reason = 'not_first';
    else if (first.admin_status !== 'active' || first.is_complete === false) reason = 'inactive';
    else if (!first.feature_image_url) reason = 'no_photo';
    else if (first.promotion_plan && first.promotion_expires_at && Date.parse(first.promotion_expires_at) > nowMs) reason = 'already_promoted';
    if (reason) {
      try { await db.insert('automation_runs', [{ ...base, status: 'skipped', skip_reason: reason }], { returning: 'minimal' }); out.skipped++; }
      catch (e) { if (!isDup(e)) throw e; }
      continue;
    }

    const days = await daysForListing(db, automation, uid, first.created_at);

    // Claim mode: only offer it — the email's button grants it (claimGift).
    if (claimUrl) {
      let run;
      try {
        [run] = await db.insert('automation_runs', [{ ...base, status: 'skipped', skip_reason: 'offered' }]);
      } catch (e) { if (isDup(e)) continue; throw e; }
      out.offered++;
      await sendOnce({ key: `gift:${run.id}`, run, tpl: giftTpl, user: users.get(uid), property: first, extra: { free_days: String(days) } });
      continue;
    }

    // Claim the user first (unique automation_id+user_id), then grant, then email.
    const freeUntil = new Date(nowMs + days * DAY).toISOString();
    let run;
    try {
      [run] = await db.insert('automation_runs', [{ ...base, status: 'gifted', gifted_at: nowIso, free_until: freeUntil }]);
    } catch (e) { if (isDup(e)) continue; throw e; }
    try {
      const until = await grant(first.id, days, now);
      if (until && until !== freeUntil) { await setRun(run.id, { free_until: until }); run.free_until = until; }
    } catch (e) {
      await setRun(run.id, { status: 'skipped', skip_reason: 'grant_failed', last_error: String(e?.message || e).slice(0, 300) });
      out.skipped++;
      continue;
    }
    out.gifted++;
    await sendOnce({ key: `gift:${run.id}`, run, tpl: giftTpl, user: users.get(uid), property: first });
  }
  return out;
}

// The seller clicked "Verificar mi publicación" in the offer email (/api/gift/claim):
// turn the open offer into the gift — free home display for the days their place in
// line earns — exactly once. → { ok, until, already? } | { ok: false, reason }
//   reason: 'invalid' (no such offer for this user + listing) · 'expired' · 'inactive'
//   (the listing is no longer live) · 'grant_failed'
export async function claimGift({ db, userId, propertyId, grant, now = new Date() }) {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const [run] = await db.select('automation_runs', `automation_id=eq.${AUTOMATION_ID}&user_id=eq.${q(userId)}&limit=1`);
  if (!run || String(run.property_id) !== String(propertyId)) return { ok: false, reason: 'invalid' };
  if (run.status !== 'skipped') return { ok: true, already: true, until: run.free_until };
  if (run.skip_reason !== 'offered' || nowMs - Date.parse(run.created_at) > OFFER_DAYS * DAY) return { ok: false, reason: 'expired' };

  const [automation] = await db.select('automations', `id=eq.${AUTOMATION_ID}&limit=1`);
  const [p] = await db.select('properties', `select=id,created_at,admin_status,is_complete&id=eq.${q(propertyId)}&limit=1`);
  if (!automation || !p) return { ok: false, reason: 'invalid' };
  if (p.admin_status !== 'active' || p.is_complete === false) return { ok: false, reason: 'inactive' };

  const days = await daysForListing(db, automation, userId, p.created_at);

  // Take the offer (only while it is still open, so a double click grants once).
  const taken = await db.update('automation_runs', `id=eq.${q(run.id)}&status=eq.skipped&skip_reason=eq.offered`,
    { status: 'gifted', skip_reason: null, gifted_at: nowIso, free_until: new Date(nowMs + days * DAY).toISOString(), updated_at: nowIso },
    { returning: 'representation' });
  if (!Array.isArray(taken) || !taken.length) {
    const [again] = await db.select('automation_runs', `id=eq.${q(run.id)}&limit=1`);
    return again?.status === 'skipped' ? { ok: false, reason: 'expired' } : { ok: true, already: true, until: again?.free_until };
  }
  try {
    const until = await grant(propertyId, days, now);
    if (until) await db.update('automation_runs', `id=eq.${q(run.id)}`, { free_until: until, updated_at: nowIso }, { returning: 'minimal' });
    return { ok: true, until: until || taken[0].free_until, days };
  } catch (e) {
    await db.update('automation_runs', `id=eq.${q(run.id)}`, { status: 'skipped', skip_reason: 'offered', gifted_at: null, free_until: null, last_error: String(e?.message || e).slice(0, 300), updated_at: nowIso }, { returning: 'minimal' });
    return { ok: false, reason: 'grant_failed' };
  }
}
