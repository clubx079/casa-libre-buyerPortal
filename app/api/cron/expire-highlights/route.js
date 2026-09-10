// Expiry sweep for paid highlights: once highlighted_until passes, flip
// is_highlighted back off so the property drops from the "destacadas on top"
// ranking and loses its ribbon. Schedule alongside the other crons with the
// CRON_SECRET; also callable manually with ?secret=<CRON_SECRET> for testing.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { update } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function handle(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const qs = new URL(req.url).searchParams.get('secret');
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const nowIso = new Date().toISOString();
  let expired = 0;      // legacy is_highlighted rows (keeps the deployed prod site correct)
  let expiredPromos = 0; // new promotion_plan rows (verified/home)
  try {
    const res = await update(
      'properties',
      `is_highlighted=eq.true&highlighted_until=lt.${encodeURIComponent(nowIso)}`,
      { is_highlighted: false },
      { returning: 'representation' }
    );
    expired = Array.isArray(res) ? res.length : 0;
  } catch (e) {
    return NextResponse.json({ error: 'update_failed', detail: e?.message }, { status: 500 });
  }
  try {
    // Promotion lapsed → back to a normal listing (drops the Verified badge, map star,
    // and any home-page placement). Reads already double-guard on the date, so this is
    // just cleanup for ordering/scan clarity + resets the reminder flag for next cycle.
    const res2 = await update(
      'properties',
      `promotion_plan=not.is.null&promotion_expires_at=lt.${encodeURIComponent(nowIso)}`,
      { promotion_plan: null, renewal_reminded_at: null },
      { returning: 'representation' }
    );
    expiredPromos = Array.isArray(res2) ? res2.length : 0;
  } catch (e) {
    return NextResponse.json({ error: 'promo_update_failed', detail: e?.message }, { status: 500 });
  }
  if (expired || expiredPromos) { try { revalidateTag('listings'); } catch {} }
  return NextResponse.json({ ok: true, expired, expiredPromos, at: nowIso });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
