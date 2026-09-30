// Force-update config for the mobile app's UpdateGate (see the app's
// components/UpdateGate.js + lib/appVersion.js). The app calls this on startup /
// foreground: GET /api/mobile/app-version?platform=ios|android&version=<installed>.
//
//   { minVersion, latestVersion, storeUrl, test? }
//
//   installed <  minVersion   → BLOCKING "update required" wall (store link)
//   installed <  latestVersion (but ≥ min) → dismissible "update available" prompt
//   installed ≥ latestVersion  → nothing
//
// ⚠️ Only raise minVersion AFTER the newer build is actually live in BOTH stores,
// or you wall users with no update to install. Values come from env — see
// lib/appVersionPolicy.js, incl. the tester-only TEST MODE (MOBILE_TEST_*).
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appVersionPolicy } from '@/lib/appVersionPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = { 'Cache-Control': 'no-store' };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function GET(req) {
  const platform = new URL(req.url).searchParams.get('platform') || '';
  // The app sends its session cookie; only used to recognise tester accounts.
  let email = null;
  try { email = getSession()?.email || null; } catch { email = null; }
  return NextResponse.json(appVersionPolicy({ platform, email }), { headers: CORS });
}
