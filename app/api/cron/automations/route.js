// GET|POST /api/cron/automations — runs the "first listing → free home display"
// automation for THIS country's DB (lib/automations/firstListing.js). Schedule hourly
// with the CRON_SECRET, like the other crons; also callable manually with ?secret=.
// Does nothing until an admin switches the automation on (Automations page).
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import * as db from '@/lib/db';
import { grantPromotion } from '@/lib/billing';
import { sendRenderedEmail, templateFrame, siteUrl } from '@/lib/email';
import { signRenewToken } from '@/lib/promoToken';
import { promoUsd } from '@/lib/stripe';
import { COUNTRY } from '@/lib/country';
import { runFirstListing, AUTOMATION_ID } from '@/lib/automations/firstListing';

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

  let automation, templates;
  try {
    [automation] = await db.select('automations', `id=eq.${AUTOMATION_ID}&limit=1`);
    templates = await db.select('email_templates', 'select=*');
  } catch (e) {
    // Migration 005 not applied on this country's DB yet.
    return NextResponse.json({ ok: true, pending: true, detail: e?.message });
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
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: 'automation_failed', detail: e?.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
