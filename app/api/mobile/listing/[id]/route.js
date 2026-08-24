// Single listing for the mobile app. `id` is the property UUID (or slug).
import { NextResponse } from 'next/server';
import { getListing } from '@/lib/listings';

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

export async function GET(req, { params }) {
  try {
    const l = await getListing(params.id);
    if (!l) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: CORS });
    return NextResponse.json({ listing: l }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: String(e?.message || e) }, { status: 500, headers: CORS });
  }
}
