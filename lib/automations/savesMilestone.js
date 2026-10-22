// "Listing getting saved" automation. When a seller's own listing (origin=user, active)
// reaches one of the admin's save numbers (automations.milestones, e.g. [5, 10, 25]) the
// seller gets ONE message for that number — by email, WhatsApp or both (the automation's
// channel, lib/automations/sendOnce.js): how many people saved it, and a link to it.
// Saves = accounts (favorites) + visitors without an account (guest_favorites).
//
// No state table: every save has a time, so we know WHEN a listing reached each number
// (the time of its Nth save).
//   • numbers reached BEFORE the automation was switched on (enabled_at) send nothing;
//   • passing several numbers at once sends ONE message (for the highest);
//   • each number once per listing (email_log dedupe key "saves:<listing>:<number>").
// Pure + dependency-injected (tests/savesMilestone.test.mjs).
import { sendOnce } from './sendOnce.js';
import { normalizeMilestones } from './viewsMilestone.js';

export const SAVES_AUTOMATION_ID = 'listing_saves_milestone';
export const SAVES_TEMPLATE_KEY = 'listing-saves';

const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const titleOf = (p) => [p.property_type, p.neighborhood || p.city].filter(Boolean).join(' · ') || 'Tu propiedad';
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// times: save times of one listing → the highest number reached AFTER `since` (or 0), and
// the total. A number counts as reached at the time of the Nth save.
export function dueMilestone(times, milestones, sinceMs) {
  const t = times.map((x) => Date.parse(x)).filter(Number.isFinite).sort((a, b) => a - b);
  const total = t.length;
  let due = 0;
  for (const m of milestones) {
    if (total < m) break;
    if (t[m - 1] >= sinceMs) due = m;     // reached after the switch-on
    else due = 0;                          // reached before: a higher one may still be new
  }
  return { due, total };
}

export async function runSavesMilestone(deps) {
  const { db, automation, templates = [], deliver, frame = {}, siteUrl = '', emailOverride = '', limit = 200 } = deps;
  const out = { checked: 0, sent: 0, duplicate: 0, failed: 0 };
  if (!automation || !automation.enabled || !automation.enabled_at) return { ...out, skippedReason: 'disabled' };
  const milestones = normalizeMilestones(automation.milestones);
  if (!milestones.length) return { ...out, skippedReason: 'no_milestones' };
  const tpl = templates.find((t) => String(t.id) === String(automation.template_id));
  if (!tpl || tpl.is_active === false) return { ...out, skippedReason: 'no_template' };
  const since = Date.parse(automation.enabled_at);

  const listings = await db.select('properties',
    'select=id,created_by,property_type,neighborhood,city&origin=eq.user&admin_status=eq.active&order=created_at.desc&limit=2000');
  if (!listings.length) return out;
  const ids = listings.map((l) => String(l.id));

  const times = new Map();
  const add = (r) => { const k = String(r.property_id); if (!times.has(k)) times.set(k, []); times.get(k).push(r.created_at); };
  for (const part of chunks(ids, 150)) {
    for (const r of await db.select('favorites', `select=property_id,created_at&property_id=${inList(part)}`)) add(r);
    for (const r of await db.select('guest_favorites', `select=property_id,created_at&property_id=${inList(part)}`).catch(() => [])) add(r);
  }

  const due = [];
  for (const l of listings) {
    out.checked++;
    const { due: m, total } = dueMilestone(times.get(String(l.id)) || [], milestones, since);
    if (m) due.push({ l, m, total });
  }
  if (!due.length) return out;

  const users = new Map();
  for (const part of chunks([...new Set(due.map((d) => String(d.l.created_by)).filter(Boolean))], 150)) {
    for (const u of await db.select('users', `select=id,email,full_name&id=${inList(part)}`)) users.set(String(u.id), u);
  }

  for (const { l, m, total } of due.slice(0, limit)) {
    const user = users.get(String(l.created_by));
    const r = await sendOnce({
      db, automationId: SAVES_AUTOMATION_ID, dedupeKey: `saves:${l.id}:${m}`, tpl, frame, deliver,
      to: user?.email ? (emailOverride || user.email) : '',
      vars: {
        name: firstName(user?.full_name),
        property_title: titleOf(l),
        property_url: `${siteUrl}/propiedad/${l.id}`,
        my_listings_url: `${siteUrl}/cuenta/publicaciones`,
        publish_url: `${siteUrl}/publicar`,
        saves: total.toLocaleString('es-PY'),
      },
    });
    if (r === 'sent') out.sent++;
    else if (r === 'duplicate') out.duplicate++;
    else if (r === 'failed') out.failed++;
  }
  return out;
}
