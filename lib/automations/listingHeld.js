// "Listing not published" — tells the owner of a USER listing that is held off the site
// why, with a button to My listings (by email, WhatsApp or both: the automation's
// "Send by", lib/automations/sendOnce.js). Row `listing_held` in automations (created by
// the admin's Automations page; until then nothing is sent).
//   reasons (held = not on the site):
//     payment   status 'payment_pending' — over the free listings of the month, not paid
//     photos    status 'rejected'        — a photo failed the AI check
//     paused    admin_status inactive (by hand)
//     incomplete admin-active but is_complete = false — details missing
//   Duplicates and ended paid listings already get their own emails; a listing still being
//   checked ('scanning') is skipped.
//   steps: milestones = hours after the listing was held, e.g. [3, 48] → a first message
//   3 h later and a reminder at 48 h, only while it is still held. Each step once per
//   listing and reason (email_log dedupe "held:<property>:<reason>:<step>").
//   templates: email_templates by key — listing-held-payment / -photos / -paused /
//   -incomplete (switched off template = that reason isn't sent).
// Only listings created since the automation was switched on; daytime only (local time).
import { sendOnce } from './sendOnce.js';
import { dueStep } from './draftReminders.js';
import { isDaytime } from '../ownerPushes.js';
import { isDeletedEmail } from '../accountDeletion.js';
import { paidConfig, priceCents, usd, PAID_LISTINGS_ID } from '../paidListings.js';
import { listingTitle } from './paidListings.js';

export const LISTING_HELD_ID = 'listing_held';
export const HELD_REASONS = ['payment', 'photos', 'paused', 'incomplete'];
export const HELD_TEMPLATE_KEYS = { payment: 'listing-held-payment', photos: 'listing-held-photos', paused: 'listing-held-paused', incomplete: 'listing-held-incomplete' };
export const DEFAULT_STEPS = [3, 48];
const LATE_GRACE_HOURS = 7 * 24;
const H = 60 * 60 * 1000;
const enc = encodeURIComponent;
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const closed = (u) => !u || u.active === false || u.blocked || u.suspended || isDeletedEmail(u.email);
const STEP_KEY = /^held:([^:]+):([a-z]+):(\d+)(?::wa)?$/;

// [3, '48', 0, 9999] → [3, 48]: whole hours 1–720, unique, ascending, at most 3.
export const normalizeSteps = (m) => [...new Set((Array.isArray(m) ? m : []).map(Number)
  .filter((n) => Number.isInteger(n) && n >= 1 && n <= 720))].sort((a, b) => a - b).slice(0, 3);

export function heldConfig(row) {
  const steps = normalizeSteps(row?.milestones);
  return { enabled: row?.enabled === true && !!row?.enabled_at, enabledAt: row?.enabled_at || null, steps: steps.length ? steps : DEFAULT_STEPS };
}

// Why a user listing is held (null = on the site, or not ours to message about).
export function heldReason(p) {
  if (!p) return null;
  if (p.status === 'payment_pending') return 'payment';
  if (p.status === 'rejected') return 'photos';
  if (['duplicate_review', 'expired', 'scanning'].includes(p.status)) return null;   // own emails / still being checked
  if (p.admin_status && p.admin_status !== 'active') return 'paused';
  if (p.is_complete === false) return 'incomplete';
  return null;
}

// When it was held: the photo check's time for rejected photos, else when it was saved.
const heldAt = (p) => Date.parse(p.raw_data?.moderation?.checked_at || p.created_at);

// "precio, superficie y fotos" — what a held-incomplete listing is missing (plain Spanish).
export function missingDetails(p) {
  const out = [];
  if (!(Number(p.price) > 0)) out.push('precio');
  if (!(Number(p.floor_area) > 0 || Number(p.covered_area) > 0 || Number(p.land_area) > 0)) out.push('superficie');
  if (!String(p.neighborhood || p.city || '').trim()) out.push('ubicación');
  if (String(p.contact_phone || '').replace(/\D/g, '').length < 6) out.push('WhatsApp de contacto');
  if (!p.feature_image_url) out.push('fotos');
  if (!out.length) return 'algunos datos de la propiedad';
  return out.length === 1 ? out[0] : `${out.slice(0, -1).join(', ')} y ${out[out.length - 1]}`;
}


export async function runListingHeld(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '', emailOverride = '', countryCode = '', limit = 200 } = deps;
  const out = { checked: 0, due: 0, sent: 0, skipped: 0, failed: 0 };
  const cfg = heldConfig(automation);
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  const tplFor = (reason) => { const t = templates.find((x) => x.key === HELD_TEMPLATE_KEYS[reason]); return t && t.is_active !== false ? t : null; };
  if (!HELD_REASONS.some(tplFor)) return { ...out, skippedReason: 'no_template' };
  if (countryCode && !isDaytime(now, countryCode)) return { ...out, skippedReason: 'night' };

  const props = await db.select('properties',
    `select=id,created_by,created_at,status,admin_status,is_complete,property_type,neighborhood,city,price,floor_area,covered_area,land_area,contact_phone,feature_image_url,raw_data&origin=eq.user&created_at=gte.${enc(cfg.enabledAt)}&order=created_at.asc&limit=3000`);
  const held = props.map((p) => ({ p, reason: heldReason(p) })).filter((x) => x.reason && x.p.created_by);
  out.checked = held.length;
  if (!held.length) return out;

  const ids = held.map((x) => String(x.p.id));
  const owners = [...new Set(held.map((x) => String(x.p.created_by)))];
  const [users, logs, [paidRow]] = await Promise.all([
    db.select('users', `select=id,email,full_name,active,blocked,suspended&id=${inList(owners)}`),
    db.select('email_log', `select=dedupe_key&automation_id=eq.${LISTING_HELD_ID}&dedupe_key=like.${enc('held:%')}&limit=10000`),
    db.select('automations', `select=*&id=eq.${PAID_LISTINGS_ID}&limit=1`).catch(() => []),
  ]);
  const byId = new Map(users.map((u) => [String(u.id), u]));
  const lastSent = new Map();   // "<property>:<reason>" → highest step sent
  for (const l of logs) {
    const m = STEP_KEY.exec(String(l.dedupe_key || ''));
    if (m && ids.includes(m[1])) { const k = `${m[1]}:${m[2]}`; lastSent.set(k, Math.max(lastSent.get(k) || 0, Number(m[3]))); }
  }
  const paid = paidConfig(paidRow || null);
  const nowMs = now.getTime();

  for (const { p, reason } of held) {
    if (out.sent + out.failed >= limit) break;
    const tpl = tplFor(reason);
    const u = byId.get(String(p.created_by));
    if (!tpl || closed(u)) { out.skipped++; continue; }
    const step = dueStep(nowMs - heldAt(p), cfg.steps, lastSent.get(`${p.id}:${reason}`) || 0, LATE_GRACE_HOURS);
    if (!step) continue;
    out.due++;
    const r = await sendOnce({
      db, automationId: LISTING_HELD_ID, runId: p.id, dedupeKey: `held:${p.id}:${reason}:${step}`, tpl, frame, deliver,
      to: emailOverride || String(u.email || '').trim().toLowerCase(),
      vars: {
        name: firstName(u.full_name) || 'hola',
        property_title: listingTitle(p),
        my_listings_url: `${siteUrl}/cuenta/publicaciones${reason === 'photos' ? '?tab=rechazadas' : ''}`,
        price: usd(priceCents(paid)),
        paid_days: String(paid.days),
        free_limit: String(paid.freePerMonth),
        missing: reason === 'incomplete' ? missingDetails(p) : '',
      },
    });
    if (r === 'sent') out.sent++;
    else if (r === 'failed') out.failed++;
    else out.skipped++;
  }
  return out;
}
