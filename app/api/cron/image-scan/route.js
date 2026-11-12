// GET|POST /api/cron/image-scan — every hour (lib/cronJobs.js): listings whose photo
// check didn't finish (the AI was down, no key yet, the server restarted mid-check) are
// checked again until they're published or rejected — never let through unchecked.
// Auth: CRON_SECRET (also callable manually with ?secret=<CRON_SECRET>).
import { NextResponse } from 'next/server';
import { scanPending } from '@/lib/listingScan';
import { scanPendingProfilePhotos } from '@/lib/profilePhotoScan';

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
  try {
    const out = await scanPending(60);
    // Sellers' profile photos still 'checking' (lib/profilePhotoScan.js) — same rule: never approved unchecked.
    const profilePhotos = await scanPendingProfilePhotos(30);
    return NextResponse.json({ ok: true, ...out, profilePhotos, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
