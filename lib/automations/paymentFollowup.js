// "Waiting for payment → free listing" — its own automation for listings held because the
// seller went over the free listings of the month and didn't pay (status 'payment_pending',
// lib/paidListings.js). While it is on, "Listing not published" (listingHeld.js) leaves the
// payment reason to this one.
//   1. reminders: milestones = HOURS after the listing was saved, e.g. [24, 72, 168] — the
//      payment email (template listing-held-payment) once per step while it is still unpaid.
//   2. gift: wait_days = DAYS after it was saved (0 = no gift) → ONE email "this listing is on
//      us": a signed link that publishes THAT listing for free, for THAT seller only
//      (/api/listing-gift/claim). The offer is valid OFFER_DAYS; after the gift no more reminders.
//   limit: first_tier_count = gifts per person (accounts + listings with the same phone), in
//      the last free_tiers[0].gift_window_days days (0 = ever) — so waiting for the gift doesn't
//      become the way to skip paying for every listing.
//   free_days = days a gifted listing stays live (then it ends like a paid one and can be extended).
// The offer / claim is kept on the listing: raw_data.paid_listing.gift = { offered_at,
// expires_at, claimed_at }. Only listings saved after it was switched on. Messages by the row's
// "Send by" (sendOnce); the gift email has no WhatsApp template, so it goes by email.
import { sendOnce } from './sendOnce.js';
import { dueStep } from './draftReminders.js';
import { isDeletedEmail } from '../accountDeletion.js';
import { paidConfig, priceCents, usd, PAID_LISTINGS_ID, paidInfo } from '../paidListings.js';
import { listingTitle } from './paidListings.js';
import { listingPhone } from '../samePerson.js';

export const PAYMENT_FOLLOWUP_ID = 'payment_followup';
export const REMINDER_KEY = 'listing-held-payment';
export const GIFT_KEY = 'payment-gift';
export const DEFAULT_STEPS = [24, 72, 168];
export const DEFAULTS = Object.freeze({ giftAfterDays: 8, giftsPerPerson: 1, giftWindowDays: 0, giftDays: 90 });
export const OFFER_DAYS = 14;
const LATE_GRACE_HOURS = 7 * 24;
const H = 3600 * 1000;
const D = 24 * H;
const enc = encodeURIComponent;
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const closed = (u) => !u || u.active === false || u.blocked || u.suspended || isDeletedEmail(u.email);
const STEP_KEY = /^payrem:([^:]+):(\d+)(?::wa)?$/;
const int = (v, min, max, dflt) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : dflt; };

// [168, '24', 0, 9999] → [24, 168]: whole hours 1–720, unique, ascending, at most 5.
export const normalizeSteps = (m) => [...new Set((Array.isArray(m) ? m : []).map(Number)
  .filter((n) => Number.isInteger(n) && n >= 1 && n <= 720))].sort((a, b) => a - b).slice(0, 5);

export function paymentFollowupConfig(row) {
  const steps = normalizeSteps(row?.milestones);
  return {
    enabled: row?.enabled === true && !!row?.enabled_at,
    enabledAt: row?.enabled_at || null,
    steps: row ? steps : DEFAULT_STEPS,
    giftAfterDays: int(row?.wait_days, 0, 60, row ? 0 : DEFAULTS.giftAfterDays),
    giftsPerPerson: int(row?.first_tier_count, 1, 100, DEFAULTS.giftsPerPerson),
    giftWindowDays: int(Array.isArray(row?.free_tiers) ? row.free_tiers[0]?.gift_window_days : null, 0, 3650, DEFAULTS.giftWindowDays),
    giftDays: int(row?.free_days, 1, 365, DEFAULTS.giftDays),
    reminderTemplateId: row?.template_id || null,
    giftTemplateId: row?.gift_template_id || null,
  };
}

// The gift record on a listing ({ offered_at, expires_at, claimed_at }) or null.
export const giftOf = (p) => { const g = paidInfo(p)?.gift; return g && typeof g === 'object' ? g : null; };
export const giftOpen = (g, now = new Date()) => !!(g?.offered_at && !g.claimed_at && Date.parse(g.expires_at || 0) > now.getTime());

// Gifts that count against this person's limit: claimed ones and offers still open, in the
// window (0 = ever), on any listing of the person except `exceptId`.
export function giftsUsed(listings = [], { exceptId = null, windowDays = 0, now = new Date() } = {}) {
  const since = windowDays > 0 ? now.getTime() - windowDays * D : -Infinity;
  return listings.filter((p) => {
    if (exceptId && String(p.id) === String(exceptId)) return false;
    const g = giftOf(p);
    if (!g?.offered_at || Date.parse(g.offered_at) < since) return false;
    return !!g.claimed_at || giftOpen(g, now);
  }).length;
}

// This person's listings: their account's, plus any listing with the same contact phone.
export function personListings(all = [], p, prefix = '') {
  const phone = listingPhone(p, prefix);
  return all.filter((x) => String(x.created_by) === String(p.created_by) || (phone && listingPhone(x, prefix) === phone));
}

const COLS = 'id,created_by,created_at,status,admin_status,property_type,listing_type,neighborhood,city,contact_phone,raw_data';

export async function runPaymentFollowup(deps) {
  const { db, automation, templates = [], now = new Date(), deliver, frame = {}, siteUrl = '', emailOverride = '', phonePrefix = '', claimUrl = () => '', formatDate = (s) => String(s).slice(0, 10), limit = 200 } = deps;
  const out = { checked: 0, reminders: 0, gifts: 0, giftLimit: 0, skipped: 0, failed: 0 };
  const cfg = paymentFollowupConfig(automation);
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  const byId = (id) => { const t = templates.find((x) => String(x.id) === String(id)); return t && t.is_active !== false ? t : null; };
  const reminderTpl = byId(cfg.reminderTemplateId);
  const giftTpl = cfg.giftAfterDays > 0 ? byId(cfg.giftTemplateId) : null;
  if (!reminderTpl && !giftTpl) return { ...out, skippedReason: 'no_template' };

  const pending = await db.select('properties', `select=${COLS}&origin=eq.user&status=eq.payment_pending&created_at=gte.${enc(cfg.enabledAt)}&order=created_at.asc&limit=3000`);
  const held = pending.filter((p) => p.created_by);
  out.checked = held.length;
  if (!held.length) return out;

  const owners = [...new Set(held.map((p) => String(p.created_by)))];
  const [users, logs, [paidRow], mine] = await Promise.all([
    db.select('users', `select=id,email,full_name,active,blocked,suspended&id=${inList(owners)}`),
    db.select('email_log', `select=dedupe_key&automation_id=eq.${PAYMENT_FOLLOWUP_ID}&dedupe_key=like.${enc('payrem:%')}&limit=10000`),
    db.select('automations', `select=*&id=eq.${PAID_LISTINGS_ID}&limit=1`).catch(() => []),
    // user listings (any status) to find each person's gift records — AiroBase can't filter
    // inside raw_data, so it's done below
    giftTpl ? db.select('properties', `select=${COLS}&origin=eq.user&order=created_at.desc&limit=5000`).catch(() => []) : [],
  ]);
  const uBy = new Map(users.map((u) => [String(u.id), u]));
  const lastSent = new Map();
  for (const l of logs) { const m = STEP_KEY.exec(String(l.dedupe_key || '')); if (m) lastSent.set(m[1], Math.max(lastSent.get(m[1]) || 0, Number(m[2]))); }
  const paid = paidConfig(paidRow || null);
  const giftRecords = mine.filter((p) => giftOf(p)?.offered_at);
  const nowMs = now.getTime();

  for (const p of held) {
    if (out.reminders + out.gifts + out.failed >= limit) break;
    const u = uBy.get(String(p.created_by));
    if (closed(u)) { out.skipped++; continue; }
    if (giftOf(p)?.offered_at) continue;   // offered (open, claimed or lapsed): no more reminders
    const age = nowMs - Date.parse(p.created_at);
    const to = emailOverride || String(u.email || '').trim().toLowerCase();
    const vars = {
      name: firstName(u.full_name) || 'hola',
      property_title: listingTitle(p),
      my_listings_url: `${siteUrl}/cuenta/publicaciones`,
      price: usd(priceCents(paid)),
      paid_days: String(paid.days),
      free_limit: String(paid.freePerMonth),
    };

    // The gift, once the wait is over (and the person still has a gift left).
    if (giftTpl && age >= cfg.giftAfterDays * D) {
      const used = giftsUsed(personListings(giftRecords, p, phonePrefix), { exceptId: p.id, windowDays: cfg.giftWindowDays, now });
      if (used >= cfg.giftsPerPerson) { out.giftLimit++; continue; }
      const expires = new Date(nowMs + OFFER_DAYS * D).toISOString();
      const r = await sendOnce({
        db, automationId: PAYMENT_FOLLOWUP_ID, runId: p.id, dedupeKey: `paygift:${p.id}`, tpl: giftTpl, frame, deliver, to,
        vars: { ...vars, claim_url: claimUrl(p), gift_days: String(cfg.giftDays), offer_until: formatDate(expires) },
      });
      if (r === 'sent' || r === 'duplicate') {
        const gift = { offered_at: now.toISOString(), expires_at: expires };
        const raw = { ...(p.raw_data || {}), paid_listing: { ...(paidInfo(p) || {}), gift } };
        await db.update('properties', `id=eq.${enc(p.id)}&status=eq.payment_pending`, { raw_data: raw }, { returning: 'minimal' });
        giftRecords.push({ ...p, raw_data: raw });
        if (r === 'sent') out.gifts++;
      } else if (r === 'failed') out.failed++;
      else out.skipped++;
      continue;
    }

    if (!reminderTpl) continue;
    const step = dueStep(age, cfg.steps, lastSent.get(String(p.id)) || 0, LATE_GRACE_HOURS);
    if (!step) continue;
    const r = await sendOnce({ db, automationId: PAYMENT_FOLLOWUP_ID, runId: p.id, dedupeKey: `payrem:${p.id}:${step}`, tpl: reminderTpl, frame, deliver, to, vars });
    if (r === 'sent') out.reminders++;
    else if (r === 'failed') out.failed++;
    else out.skipped++;
  }
  return out;
}

// The seller takes the gift (email link or the My listings button): THAT listing, THAT
// seller, an offer still open → it goes through the photo check like a paid one and stays
// live cfg.giftDays. Clicking again is harmless.
//   → { ok: true, already? } | { ok: false, reason: 'invalid' | 'expired' | 'paid' | 'unavailable' }
export async function claimListingGift({ db, userId, propertyId, now = new Date(), startScan = () => {} }) {
  const [p] = await db.select('properties', `select=${COLS}&id=eq.${enc(propertyId)}&limit=1`);
  if (!p || String(p.created_by) !== String(userId)) return { ok: false, reason: 'invalid' };
  const gift = giftOf(p);
  if (gift?.claimed_at) return { ok: true, already: true };
  if (p.status !== 'payment_pending') return { ok: false, reason: paidInfo(p)?.paid_at ? 'paid' : 'unavailable' };
  if (!gift?.offered_at) return { ok: false, reason: 'invalid' };
  if (!giftOpen(gift, now)) return { ok: false, reason: 'expired' };
  const [row] = await db.select('automations', `select=*&id=eq.${PAYMENT_FOLLOWUP_ID}&limit=1`).catch(() => []);
  const cfg = paymentFollowupConfig(row || null);
  const at = now.toISOString();
  const info = paidInfo(p) || {};
  const raw = {
    ...(p.raw_data || {}),
    paid_listing: { ...info, state: 'active', until: new Date(now.getTime() + cfg.giftDays * D).toISOString(), gift: { ...gift, claimed_at: at }, reminded_for: null },
    moderation: { ...(p.raw_data?.moderation || {}), state: 'scanning', started_at: at },
  };
  const done = await db.update('properties', `id=eq.${enc(p.id)}&status=eq.payment_pending`, { status: 'scanning', raw_data: raw }, { returning: 'representation' });
  if (!Array.isArray(done) || !done.length) return { ok: true, already: true };   // a parallel click won
  await startScan(p.id);
  return { ok: true };
}
