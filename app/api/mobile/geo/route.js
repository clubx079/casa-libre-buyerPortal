// Lightweight geo hint for the mobile app's country auto-detection. Returns the
// visitor's country from Cloudflare's CF-IPCountry header (the site sits behind
// Cloudflare). No DB, no secrets — the app maps the ISO code to a supported
// country and falls back to device region / Paraguay when this is unavailable.
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = { 'Cache-Control': 'no-store' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  const h = headers();
  const cc = (h.get('cf-ipcountry') || h.get('x-vercel-ip-country') || '').toUpperCase();
  return NextResponse.json({ country: cc || 'PY' }, { headers: CORS });
}
