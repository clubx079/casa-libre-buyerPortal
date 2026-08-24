// Hydrate a set of listing ids (used by the mobile Saved tab). POST { ids: [] }.
import { NextResponse } from 'next/server';
import { getListingsByIds } from '@/lib/listings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.slice(0, 200) : [];
    const { rate, listings } = await getListingsByIds(ids);
    return NextResponse.json({ rate, listings }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: String(e?.message || e) }, { status: 500, headers: CORS });
  }
}
