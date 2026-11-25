// Permanently deletes listings whose "Recently deleted" window is over (lib/listingTrash.js).
// Schedule hourly with the CRON_SECRET (Authorization: Bearer <CRON_SECRET>, or ?secret=).
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { select, remove } from '@/lib/db';
import { purgeExpired } from '@/lib/listingTrash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function run(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const qs = new URL(req.url).searchParams.get('secret');
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const res = await purgeExpired({ select, remove });
    if (res.purged) { try { revalidateTag('listings'); } catch {} }
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: 'purge_failed', detail: e?.message }, { status: 500 });
  }
}
export const GET = run;
export const POST = run;
