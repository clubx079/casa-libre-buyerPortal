// Read-only listings feed for the Casa Libre mobile app (React Native / Expo).
// Reuses the same server-side query + shape + completeness gate as the website,
// so the secret AiroBase key never leaves the server. CORS-open (public data).
import { NextResponse } from 'next/server';
import { getListings } from '@/lib/listings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=120',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '600', 10) || 600, 5000);
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
