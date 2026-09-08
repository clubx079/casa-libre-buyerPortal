// Read-only listings feed for the Casa Libre mobile app (React Native / Expo).
// Reuses the same server-side query + shape + completeness gate as the website,
// so the secret AiroBase key never leaves the server. CORS-open (public data).
import { NextResponse } from 'next/server';
import { getListings } from '@/lib/listings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// No wildcard cross-origin allowance: only the native app (not subject to CORS)
// and the same-origin site consume this. Dropping `Access-Control-Allow-Origin: *`
// blocks browser-based cross-origin scrapers with zero impact on the native app.
const CORS = {
  'Cache-Control': 'public, max-age=120',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    // Clamp to the app's real need (≤600). Was 5000 — a single call that dumped
    // the whole catalog. The app requests 600, so this is invisible to it.
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '600', 10) || 600, 600);
    const mode = url.searchParams.get('mode');
    const { rate, listings } = await getListings({ limit });
    let out = listings;
    if (mode === 'venta') out = listings.filter((l) => l.mode === 'venta');
    else if (mode === 'alquiler') out = listings.filter((l) => l.mode === 'alquiler');
    return NextResponse.json({ rate, count: out.length, listings: out }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: String(e?.message || e) }, { status: 500, headers: CORS });
  }
}
