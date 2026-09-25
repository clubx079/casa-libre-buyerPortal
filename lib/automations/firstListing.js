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
//                wait_days old → grant free home display + gift email
// Every email is claimed in email_log by a unique dedupe key BEFORE it is sent, so a
// crash, retry or overlapping tick can never send it twice.
import { renderTemplate } from '../emailTemplateRender.js';

export const AUTOMATION_ID = 'first_listing_free_home';
const DAY = 86400000;
const ACTIVE = ['gifted', 'reminded'];

const q = (s) => encodeURIComponent(s);
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const titleOf = (p) => [p.property_type, p.neighborhood || p.city].filter(Boolean).join(' · ') || 'Tu propiedad';
const isDup = (e) => e?.status === 409 || e?.code === '23505';

export async function runFirstListing(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, grant, frame = {}, siteUrl = '',
    extendUrl, formatDate = (s) => s, price = 'US$20', emailOverride = '', limit = 200 } = deps;
  const out = { gifted: 0, reminded: 0, converted: 0, done: 0, skipped: 0, failed: 0, retried: 0 };
  if (!automation || !automation.enabled || !automation.enabled_at) return { ...out, skippedReason: 'disabled' };

  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const tplById = new Map(templates.map((t) => [String(t.id), t]));
  const giftTpl = tplById.get(String(automation.gift_template_id));
  const remindTpl = tplById.get(String(automation.reminder_template_id));
  const setRun = (id, patch) => db.update('automation_runs', `id=eq.${q(id)}`, { ...patch, updated_at: nowIso }, { returning: 'minimal' });

  // Send one templated email exactly once (claim → deliver → record).
  async function sendOnce({ key, run, tpl, user, property, extra = {} }) {
    if (!tpl || tpl.is_active === false) return 'no_template';
    if (!user?.email) return 'no_email';
    const vars = {
      name: firstName(user.full_name),
      property_title: titleOf(property),
      property_url: `${siteUrl}/propiedad/${property.id}`,
      free_until: run.free_until ? formatDate(run.free_until) : '',
      days_left: run.free_until ? String(Math.max(1, Math.ceil((Date.parse(run.free_until) - nowMs) / DAY))) : '',
      free_days: String(automation.free_days),
      extend_url: extendUrl ? extendUrl(run, property) : '',
      price,
      ...extra,
    };
    const msg = renderTemplate(tpl, vars, frame);
    const to = emailOverride || user.email;
    let log;
    try {
      [log] = await db.insert('email_log', [{ automation_id: AUTOMATION_ID, run_id: run.id, template_id: tpl.id, template_key: tpl.key || null, to_email: to, subject: msg.subject, status: 'sending', dedupe_key: key }]);
    } catch (e) {
      if (isDup(e)) return 'duplicate';
      throw e;
    }
    const res = await deliver({ to, subject: msg.subject, html: msg.html, text: msg.text }).catch((e) => ({ ok: false, error: e?.message || 'send_failed' }));
    if (!res?.ok) {
      await db.remove('email_log', `id=eq.${q(log.id)}`);   // free the claim → retried next tick
      await setRun(run.id, { last_error: String(res?.error || 'send_failed').slice(0, 300) });
      out.failed++;
      return 'failed';
    }
    await db.update('email_log', `id=eq.${q(log.id)}`, { status: 'sent', resend_id: res.id || null }, { returning: 'minimal' });
    if (run.last_error) await setRun(run.id, { last_error: null });
    return 'sent';
  }

  const loadUsers = async (ids) => {
    if (!ids.length) return new Map();
    const rows = await db.select('users', `select=id,email,full_name&id=${inList(ids)}`);
    return new Map(rows.map((u) => [String(u.id), u]));
  };
  const loadProps = async (ids) => {
    if (!ids.length) return new Map();
    const rows = await db.select('properties', `select=id,created_by,property_type,neighborhood,city,promotion_plan,promotion_expires_at&id=${inList(ids)}`);
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
      `select=id,created_by,created_at,admin_status,is_complete,feature_image_url,property_type,neighborhood,city,promotion_plan,promotion_expires_at&created_by=eq.${q(uid)}&origin=eq.user&order=created_at.asc&limit=1`);
    if (!first) continue;
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

    // Claim the user first (unique automation_id+user_id), then grant, then email.
    const freeUntil = new Date(nowMs + automation.free_days * DAY).toISOString();
    let run;
    try {
      [run] = await db.insert('automation_runs', [{ ...base, status: 'gifted', gifted_at: nowIso, free_until: freeUntil }]);
    } catch (e) { if (isDup(e)) continue; throw e; }
    try {
      const until = await grant(first.id, automation.free_days, now);
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
