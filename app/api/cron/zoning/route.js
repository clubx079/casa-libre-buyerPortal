// GET|POST /api/cron/zoning — hourly: zone new/moved listings (Asunción today;
// see lib/zoning/providers.js). Off unless ZONING_ENABLED=1 (needs migration 007).
// Schedule with the CRON_SECRET like the other crons; also callable with ?secret=.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import * as db from '@/lib/db';
import { runZoning } from '@/lib/zoning/runZoning';
import { providerForCity } from '@/lib/zoning/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}` && url.searchParams.get('secret') !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (process.env.ZONING_ENABLED !== '1') return NextResponse.json({ ok: true, skipped: 'zoning_disabled' });

  const limit = Math.min(Number(url.searchParams.get('limit')) || 300, 1000);
  try {
    const r = await runZoning({ db, now: new Date(), providerFor: providerForCity, limit });
    if (r.zoned || r.noZone) revalidateTag('listings');
    return NextResponse.json({ ok: true, ...r, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: 'zoning_failed', detail: e?.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
