// A seller deleted one of their listings (My listings → Delete, /api/account/listings).
//   • recordDeletion — the listing row is gone after this, so we keep ONE record of it:
//     an email_log row with channel 'event' and a dedupe key ending ':ev' (never an email —
//     the admin's email lists skip it), automation_id 'event_listing_deleted', run_id = the listing id, and
//     what it was in `error` (JSON: title, ref, status, when it was listed, views, by).
//     The admin's activity page shows it in "Messages sent" ("Deleted their listing") and
//     counts it in "their Nth listing this month". The admin's own Properties → Delete writes
//     the same record with by 'team'.
//   • askWhy — the "Listing deleted → ask why" automation (automations.id 'listing_deleted',
//     template 'listing-deleted-feedback', Admin → Automations): an email asking why, with a
//     link to /feedback?src=listing_deleted. Only when the automation is on; at most once per
//     person every 7 days (deleting three listings at once = one email).
import 'server-only';
import * as db from './db';
import { sendOnce } from './automations/sendOnce';
import { sendRenderedEmail, templateFrame, siteUrl } from './email';
import { listingRef } from './listingScan';
import { listingTitle } from './automations/duplicateListings';

export const DELETED_EVENT = 'event_listing_deleted';
export const ASK_WHY_AUTOMATION_ID = 'listing_deleted';
export const ASK_WHY_TEMPLATE_KEY = 'listing-deleted-feedback';
const WEEK = 7 * 86400000;

// The record's details, from the listing row as it was (pure — tests/listingDeleted.test.mjs).
export function deletionDetails(p = {}, { views = null, by = 'owner', now = new Date() } = {}) {
  const pl = p.raw_data?.paid_listing || null;
  return {
    user_id: p.created_by || null,
    property_id: p.id,
    title: listingTitle(p),
    ref: listingRef(p.id, p.created_at),
    status: p.status || null,                 // published / payment_pending / …
    paid: pl ? (pl.paid_at ? 'paid' : pl.gift?.claimed_at ? 'gift' : 'unpaid') : 'free',
    listed_at: p.created_at || null,
    live_days: p.created_at ? Math.max(0, Math.round((now.getTime() - Date.parse(p.created_at)) / 86400000)) : null,
    views: views == null ? null : Number(views) || 0,
    by,                                        // owner | team
  };
}

export async function recordDeletion(p, { email, views = null, by = 'owner' } = {}) {
  const d = deletionDetails(p, { views, by });
  await db.insert('email_log', [{
    automation_id: DELETED_EVENT, channel: 'event', run_id: p.id, to_email: String(email || '').trim().toLowerCase() || '-',
    template_key: 'event:listing_deleted', subject: `${d.title} (${d.ref})`, status: 'sent',
    dedupe_key: `deleted:${p.id}:ev`, error: JSON.stringify(d),   // ':ev' = not a message: the admin's email lists skip it
  }], { returning: 'minimal' });
  return d;
}

export async function askWhy(p, { email, name } = {}) {
  const to = String(email || '').trim().toLowerCase();
  if (!to) return 'no_email';
  const [automation] = await db.select('automations', `select=*&id=eq.${ASK_WHY_AUTOMATION_ID}&limit=1`).catch(() => []);
  if (!automation?.enabled) return 'off';
  // once per person every 7 days
  const since = new Date(Date.now() - WEEK).toISOString();
  const recent = await db.select('email_log', `select=id&automation_id=eq.${ASK_WHY_AUTOMATION_ID}&to_email=eq.${encodeURIComponent(to)}&created_at=gte.${encodeURIComponent(since)}&limit=1`).catch(() => []);
  if (recent.length) return 'recent';
  const templates = await db.select('email_templates', 'select=*').catch(() => []);
  const tpl = templates.find((t) => String(t.id) === String(automation.template_id)) || templates.find((t) => t.key === ASK_WHY_TEMPLATE_KEY);
  const site = siteUrl();
  return sendOnce({
    db, automationId: ASK_WHY_AUTOMATION_ID, runId: p.id, dedupeKey: `deleted-ask:${p.id}`, tpl,
    frame: templateFrame(), deliver: sendRenderedEmail, to,
    vars: {
      name: String(name || '').trim().split(/\s+/)[0] || '',
      property_title: listingTitle(p),
      feedback_url: `${site}/feedback?src=listing_deleted&e=${encodeURIComponent(to)}`,
      publish_url: `${site}/?sell=1`,
    },
  }).catch(() => 'failed');
}
