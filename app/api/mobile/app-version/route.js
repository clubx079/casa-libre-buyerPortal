// Force-update config for the mobile app's UpdateGate (see the app's
// components/UpdateGate.js + lib/appVersion.js). The app calls this on startup /
// foreground: GET /api/mobile/app-version?platform=ios|android&version=<installed>.
//
//   { minVersion, latestVersion, storeUrl }
//
//   installed <  minVersion   → BLOCKING "update required" wall (store link)
//   installed <  latestVersion (but ≥ min) → dismissible "update available" prompt
//   installed ≥ latestVersion  → nothing
//
// ⚠️ Only raise minVersion AFTER the newer build is actually live in BOTH stores,
// or you wall users with no update to install. Values come from env so they can be
// changed without a code edit (a redeploy still applies them); defaults are safe
// (minVersion 1.0.0 never walls anyone).
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = { 'Cache-Control': 'no-store' };

// App store links (from eas.json ascAppId / app.json package).
const STORE_URL = {
  ios: process.env.MOBILE_IOS_STORE_URL || 'https://apps.apple.com/app/id6805488261',
  android: process.env.MOBILE_ANDROID_STORE_URL || 'https://play.google.com/store/apps/details?id=py.casalibre.mobile',
};

// Per-platform override → generic override → safe default.
const pick = (plat, kind, dflt) =>
  process.env[`MOBILE_${kind}_${plat.toUpperCase()}`] || process.env[`MOBILE_${kind}`] || dflt;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function GET(req) {
  const platform = (new URL(req.url).searchParams.get('platform') || '').toLowerCase() === 'android' ? 'android' : 'ios';
  return NextResponse.json(
    {
      minVersion: pick(platform, 'MIN_VERSION', '1.0.0'),      // never wall until deliberately raised
      latestVersion: pick(platform, 'LATEST_VERSION', '1.0.1'), // current shipped build
      storeUrl: STORE_URL[platform],
    },
    { headers: CORS },
  );
}
