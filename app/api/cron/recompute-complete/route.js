// Keep new scraped listings searchable: recompute is_complete + price_usd for
// active building rows that aren't yet flagged (is_complete=false — the default
// for freshly-inserted scraper rows). Light enough for a route; schedule it
// hourly with the CRON_SECRET. A periodic full recompute (scripts/recompute-
// complete.mjs --commit) additionally catches demotions on older listings.
import { NextResponse } from 'next/server';
import { select, update } from '@/lib/db';
import { buildingsParts } from '@/lib/land';
import { getUsdToPyg } from '@/lib/fx';
import { isCompleteListing, shapeForGate } from '@/lib/completeness';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const COLS = 'id,price,currency,listing_type,contact_phone,city,neighborhood,bedrooms,bathrooms,parking_spaces,covered_area,floor_area,land_area,property_type,price_usd';

async function handle(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rate = await getUsdToPyg();
  const parts = ['is_complete=eq.false', 'admin_status=eq.active', ...buildingsParts()].join('&');

  let scanned = 0, promoted = 0, priceFixed = 0;
  for (let off = 0; off < 20000; off += 1000) {
    let rows = [];
    try { rows = await select('properties', `${parts}&select=${COLS}&order=id&limit=1000&offset=${off}`); }
    catch { break; }
    if (!Array.isArray(rows) || !rows.length) break;
    scanned += rows.length;
    for (const r of rows) {
      const shaped = shapeForGate(r, rate);
      const ok = isCompleteListing(shaped);
      const priceUsd = shaped.usd ?? null;
      const priceChanged = (r.price_usd == null ? null : Number(r.price_usd)) !== (priceUsd == null ? null : Number(priceUsd));
      if (ok || priceChanged) {
        try { await update('properties', `id=eq.${r.id}`, { is_complete: ok, price_usd: priceUsd }, { returning: 'minimal' }); if (ok) promoted++; else if (priceChanged) priceFixed++; } catch {}
      }
    }
    if (rows.length < 1000) break;
  }
  return NextResponse.json({ ok: true, scanned, promoted, priceFixed });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
