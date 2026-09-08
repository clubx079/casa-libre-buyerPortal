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
  let expired = 0;
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
  if (expired) { try { revalidateTag('listings'); } catch {} }
  return NextResponse.json({ ok: true, expired, at: nowIso });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
