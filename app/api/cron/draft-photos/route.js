// GET|POST /api/cron/draft-photos — once a day (lib/cronJobs.js): drafts nobody has
// touched for 30 days lose their photos (the files in storage; the draft's text
// stays in My listings → Drafts), so abandoned drafts don't fill the bucket.
// Auth: CRON_SECRET (also callable manually with ?secret=<CRON_SECRET>).
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { draftPhotoKeys, setDraftPhotos } from '@/lib/drafts';
import { removeDraftPhotos, STALE_DAYS } from '@/lib/draftPhotos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function handle(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const qs = new URL(req.url).searchParams.get('secret');
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();
  let drafts = 0, photos = 0;
  try {
    const rows = await db.select('listing_drafts', `select=id,user_id,data,updated_at&updated_at=lt.${encodeURIComponent(cutoff)}&order=updated_at.asc&limit=500`);
    for (const row of rows) {
      const keys = draftPhotoKeys(row.data);
      if (!keys.length) continue;
      await removeDraftPhotos(keys);
      await setDraftPhotos(db, row.user_id, row, [], new Date(row.updated_at));   // keep its "last touched" date
      drafts += 1; photos += keys.length;
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, drafts, photos, at: new Date().toISOString() });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
