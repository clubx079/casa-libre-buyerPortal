// Lightweight geo hint for the mobile app's country auto-detection. Returns the
// visitor's country from Cloudflare's CF-IPCountry header (the site sits behind
// Cloudflare) plus the app's country list (lib/mobileCountries.js), in one request.
// No DB, no secrets — the app maps the ISO code to a live country, Paraguay if
// it's none of ours. Older app versions read only `country`.
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { MOBILE_COUNTRIES } from '@/lib/mobileCountries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = { 'Cache-Control': 'no-store' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  const h = headers();
  const cc = (h.get('cf-ipcountry') || h.get('x-vercel-ip-country') || '').toUpperCase();
  return NextResponse.json({ country: cc || 'PY', countries: MOBILE_COUNTRIES }, { headers: CORS });
}
