// "Listing getting views" automation. When a seller's own listing (origin=user,
// active) reaches one of the admin's view numbers (automations.milestones, e.g.
// [50] or [25,50,100]) it emails the seller once for that number: the listing, its
// real view count, and an invite to publish another property. Views come from
// PostHog (fetchViews, injected) — the same count as the admin's Property analytics.
//
// listing_view_milestones remembers the last number handled per listing:
//   • first time a listing is seen: listings created BEFORE the switch-on start at the
//     highest number they already passed (no email for it); newer ones start at 0.
//   • jumping past several numbers at once sends ONE email (for the highest).
// Pure + dependency-injected (tested in tests/viewsMilestone.test.mjs).
import { sendOnce } from './sendOnce.js';

export const VIEWS_AUTOMATION_ID = 'listing_views_milestone';

const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const titleOf = (p) => [p.property_type, p.neighborhood || p.city].filter(Boolean).join(' · ') || 'Tu propiedad';
const isDup = (e) => e?.status === 409 || e?.code === '23505';
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export const normalizeMilestones = (m) => [...new Set((Array.isArray(m) ? m : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);

export async function runViewsMilestone(deps) {
  const { db, automation, templates = [], now = new Date(), fetchViews, deliver, frame = {}, siteUrl = '',
    emailOverride = '', limit = 200 } = deps;
  const out = { checked: 0, sent: 0, baselined: 0, failed: 0 };
  if (!automation || !automation.enabled || !automation.enabled_at) return { ...out, skippedReason: 'disabled' };
  const milestones = normalizeMilestones(automation.milestones);
  if (!milestones.length) return { ...out, skippedReason: 'no_milestones' };
  const tpl = templates.find((t) => String(t.id) === String(automation.template_id));
  if (!tpl || tpl.is_active === false) return { ...out, skippedReason: 'no_template' };

  const nowIso = now.toISOString();
  const listings = await db.select('properties',
    'select=id,created_by,created_at,property_type,neighborhood,city&origin=eq.user&admin_status=eq.active&order=created_at.desc&limit=2000');
  if (!listings.length) return out;
  const ids = listings.map((l) => String(l.id));
  const views = await fetchViews(ids);

  const state = new Map();
  for (const part of chunks(ids, 200)) {
    for (const r of await db.select('listing_view_milestones', `select=*&property_id=${inList(part)}`)) state.set(String(r.property_id), r);
  }
  const reachedOf = (v) => milestones.filter((m) => v >= m).pop() || 0;

  // Who to email: listings past a new number.
  const due = [];
  for (const l of listings) {
    const id = String(l.id);
    const v = Number(views.get(id) || 0);
    const reached = reachedOf(v);
    out.checked++;
    let st = state.get(id);
    if (!st) {
      const baseline = Date.parse(l.created_at) < Date.parse(automation.enabled_at) ? reached : 0;
      try {
        [st] = await db.insert('listing_view_milestones', [{ property_id: id, user_id: l.created_by, last_milestone: baseline, last_views: v, updated_at: nowIso }]);
      } catch (e) {
        if (!isDup(e)) throw e;
        [st] = await db.select('listing_view_milestones', `select=*&property_id=eq.${encodeURIComponent(id)}`);
      }
      if (baseline && baseline === reached) out.baselined++;
    }
    if (reached > Number(st.last_milestone || 0)) due.push({ l, v, reached });
  }
  if (!due.length) return out;

  const userIds = [...new Set(due.map((d) => String(d.l.created_by)).filter(Boolean))];
  const users = new Map();
  for (const part of chunks(userIds, 200)) {
    for (const u of await db.select('users', `select=id,email,full_name&id=${inList(part)}`)) users.set(String(u.id), u);
  }

  for (const { l, v, reached } of due.slice(0, limit)) {
    const user = users.get(String(l.created_by));
    const r = await sendOnce({
      db, automationId: VIEWS_AUTOMATION_ID, dedupeKey: `views:${l.id}:${reached}`, tpl, frame, deliver,
      to: user?.email ? (emailOverride || user.email) : '',
      vars: {
        name: firstName(user?.full_name),
        property_title: titleOf(l),
        property_url: `${siteUrl}/propiedad/${l.id}`,
        publish_url: `${siteUrl}/publicar`,
        views: v.toLocaleString('es-PY'),
      },
    });
    if (r === 'sent') out.sent++;
    if (r === 'failed') { out.failed++; continue; }
    // sent / duplicate / no_email → this number is handled for this listing.
    await db.update('listing_view_milestones', `property_id=eq.${encodeURIComponent(l.id)}`, { last_milestone: reached, last_views: v, updated_at: nowIso }, { returning: 'minimal' });
  }
  return out;
}
