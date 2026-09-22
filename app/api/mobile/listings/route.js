// Read-only listings feed for the Casa Libre mobile app (React Native / Expo).
// Reuses the same server-side query + shape + completeness gate as the website,
// so the secret AiroBase key never leaves the server. CORS-open (public data).
import { NextResponse } from 'next/server';
import { getListings, getMobileSlimListings } from '@/lib/listings';

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
    const modeParam0 = url.searchParams.get('mode');
    const mode0 = modeParam0 === 'venta' || modeParam0 === 'alquiler' ? modeParam0 : undefined;
    // Slim feed (map-first app): the whole catalog, but ONLY card/map fields + cover
    // url — no phone/contact/description/image array. Cached 5 min server-side.
    if (url.searchParams.get('slim') === '1') {
      const { rate, totalCount, listings } = await getMobileSlimListings(mode0);
      return NextResponse.json({ rate, count: listings.length, total: totalCount, listings }, { headers: CORS });
    }
    // Clamp to the app's real need (≤600). Was 5000 — a single call that dumped
    // the whole catalog. The app requests 600, so this is invisible to it.
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '600', 10) || 600, 600);
    const modeParam = url.searchParams.get('mode');
    const mode = modeParam === 'venta' || modeParam === 'alquiler' ? modeParam : undefined;
    // Pass mode so the fetch AND the exact count are per-mode — `totalCount` is the
    // real total for THIS view, not the all-modes total.
    const { rate, listings, totalCount } = await getListings({ limit, mode });
    // `total` = the real active-inventory total for this view (uncapped, count=exact);
    // the app shows it as the "N results" count instead of the load cap (600).
    return NextResponse.json({ rate, count: listings.length, total: totalCount, listings }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: String(e?.message || e) }, { status: 500, headers: CORS });
  }
}
