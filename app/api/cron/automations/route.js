// GET|POST /api/cron/automations — runs the automations for THIS country's DB:
// "first listing → free home display" (lib/automations/firstListing.js),
// "listing getting views" (lib/automations/viewsMilestone.js) and "unfinished draft
// reminders" (lib/automations/draftReminders.js) and "same property listed twice"
// (lib/automations/duplicateListings.js) and paid listings (lib/automations/paidListings.js). Schedule hourly with the
// CRON_SECRET, like the other crons; also callable manually with ?secret=.
// Each does nothing until an admin switches it on (Automations page).
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import * as db from '@/lib/db';
import { grantPromotion } from '@/lib/billing';
import { sendRenderedEmail, templateFrame, siteUrl } from '@/lib/email';
import { signRenewToken } from '@/lib/promoToken';
import { promoUsd } from '@/lib/stripe';
import { COUNTRY } from '@/lib/country';
import { runFirstListing, AUTOMATION_ID } from '@/lib/automations/firstListing';
import { runViewsMilestone, VIEWS_AUTOMATION_ID } from '@/lib/automations/viewsMilestone';
import { runDraftReminders, DRAFTS_AUTOMATION_ID } from '@/lib/automations/draftReminders';
import { runDuplicateListings, DUPLICATES_AUTOMATION_ID } from '@/lib/automations/duplicateListings';
import { runPaidListings, PAID_AUTOMATION_ID } from '@/lib/automations/paidListings';
import { fetchListingViews, viewsConfigured } from '@/lib/posthogViews';
import { sendPush } from '@/lib/push';
import { runOwnerPushes } from '@/lib/ownerPushes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const qs = new URL(req.url).searchParams.get('secret');
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Owner push notifications (views milestones, highlight ending, unfinished drafts) —
  // daytime only, independent of the email automations below. lib/ownerPushes.js
  const pushes = process.env.PUSH_AUTOMATIONS === 'off'
    ? { skipped: 'off' }
    : await runOwnerPushes(db, (o) => sendPush(db, o), { now: new Date(), countryCode: COUNTRY.code }).catch((e) => ({ error: e?.message || 'push_failed' }));

  let automation, viewsAutomation, draftsAutomation, dupAutomation, paidAutomation, templates;
  try {
    [automation] = await db.select('automations', `id=eq.${AUTOMATION_ID}&limit=1`);
    [viewsAutomation] = await db.select('automations', `id=eq.${VIEWS_AUTOMATION_ID}&limit=1`).catch(() => []);
    [draftsAutomation] = await db.select('automations', `id=eq.${DRAFTS_AUTOMATION_ID}&limit=1`).catch(() => []);
    [dupAutomation] = await db.select('automations', `id=eq.${DUPLICATES_AUTOMATION_ID}&limit=1`).catch(() => []);
    [paidAutomation] = await db.select('automations', `id=eq.${PAID_AUTOMATION_ID}&limit=1`).catch(() => []);
    templates = await db.select('email_templates', 'select=*');
  } catch (e) {
    // Migration 005 not applied on this country's DB yet.
    return NextResponse.json({ ok: true, pending: true, pushes, detail: e?.message });
  }

  const site = siteUrl();
  try {
    const result = await runFirstListing({
      db,
      automation,
      templates,
      now: new Date(),
      deliver: sendRenderedEmail,
      grant: (propertyId, days) => grantPromotion(propertyId, 'home', { days }),
      frame: templateFrame(),
      siteUrl: site,
      extendUrl: (run) => `${site}/api/promo/extend?token=${encodeURIComponent(signRenewToken({ pid: run.property_id, uid: run.user_id, plan: 'home', purpose: 'extend' }))}`,
      formatDate: (s) => { try { return new Date(s).toLocaleDateString(COUNTRY.locale, { day: 'numeric', month: 'long' }); } catch { return s; } },
      price: `US$${promoUsd('home')}`,
      emailOverride: process.env.AUTOMATION_EMAIL_OVERRIDE || '',
    });
    if (result.gifted || result.done || result.converted) revalidateTag('listings');

    // Listing getting views (needs migration 006 + PostHog read access).
    let views = { skippedReason: 'not_set_up' };
    if (viewsAutomation) {
      views = !viewsConfigured()
        ? { skippedReason: 'posthog_not_configured' }
        : await runViewsMilestone({
          db, automation: viewsAutomation, templates, now: new Date(),
          fetchViews: fetchListingViews, deliver: sendRenderedEmail, frame: templateFrame(), siteUrl: site,
          emailOverride: process.env.AUTOMATION_EMAIL_OVERRIDE || '',
        }).catch((e) => ({ error: e?.message || 'views_failed' }));
    }

    // Unfinished draft reminders (row seeded by migrations/013_draft_reminders.sql).
    const drafts = !draftsAutomation
      ? { skippedReason: 'not_set_up' }
      : await runDraftReminders({
        db, automation: draftsAutomation, templates, now: new Date(),
        deliver: sendRenderedEmail, frame: templateFrame(), siteUrl: site,
        emailOverride: process.env.AUTOMATION_EMAIL_OVERRIDE || '',
      }).catch((e) => ({ error: e?.message || 'drafts_failed' }));
    // Same property listed twice by one user (lib/automations/duplicateListings.js).
    const duplicates = !dupAutomation
      ? { skippedReason: 'not_set_up' }
      : await runDuplicateListings({
        db, automation: dupAutomation, templates, deliver: sendRenderedEmail, frame: templateFrame(), siteUrl: site,
        emailOverride: process.env.AUTOMATION_EMAIL_OVERRIDE || '',
        formatDate: (s) => { try { return new Date(s).toLocaleDateString(COUNTRY.locale, { day: 'numeric', month: 'long' }); } catch { return String(s).slice(0, 10); } },
      }).catch((e) => ({ error: e?.message || 'duplicates_failed' }));
    // Paid listings: ends-soon / ended emails, ending the paid time, the agents-plan email
    // (lib/automations/paidListings.js). Off until switched on in the admin.
    const paid = !paidAutomation
      ? { skippedReason: 'not_set_up' }
      : await runPaidListings({
        db, automation: paidAutomation, templates, now: new Date(), deliver: sendRenderedEmail, frame: templateFrame(), siteUrl: site,
        emailOverride: process.env.AUTOMATION_EMAIL_OVERRIDE || '',
        formatDate: (s) => { try { return new Date(s).toLocaleDateString(COUNTRY.locale, { day: 'numeric', month: 'long' }); } catch { return String(s).slice(0, 10); } },
      }).catch((e) => ({ error: e?.message || 'paid_failed' }));
    if (paid.ended) revalidateTag('listings');
    return NextResponse.json({ ok: true, ...result, views, drafts, duplicates, paid, pushes, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: 'automation_failed', detail: e?.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
