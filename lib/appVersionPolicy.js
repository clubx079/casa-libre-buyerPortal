// Force-update policy for the mobile app (served by /api/mobile/app-version).
//
//   installed <  minVersion              → blocking "update required" wall
//   installed <  latestVersion (≥ min)   → dismissible "update available" prompt
//
// Values come from env (per platform first, then generic):
//   MOBILE_MIN_VERSION[_IOS|_ANDROID], MOBILE_LATEST_VERSION[_IOS|_ANDROID]
//
// TEST MODE — try the wall / prompt on your own phone without touching real users:
//   MOBILE_TEST_EMAILS=omar@airosofts.com,other@x.com
//   MOBILE_TEST_MIN_VERSION[_IOS|_ANDROID]=9.9.9      (→ wall)
//   MOBILE_TEST_LATEST_VERSION[_IOS|_ANDROID]=9.9.9   (→ prompt only)
// Only a signed-in account on that list gets the TEST_ values; everyone else keeps
// the normal ones. Remove the TEST_ vars when done.

const pick = (env, plat, name, dflt) => env[`${name}_${plat.toUpperCase()}`] || env[name] || dflt;

export function testerEmails(env) {
  return String(env.MOBILE_TEST_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function appVersionPolicy({ platform, email, env = process.env } = {}) {
  const plat = String(platform || '').toLowerCase() === 'android' ? 'android' : 'ios';
  const storeUrl = plat === 'ios'
    ? env.MOBILE_IOS_STORE_URL || 'https://apps.apple.com/app/id6805488261'
    : env.MOBILE_ANDROID_STORE_URL || 'https://play.google.com/store/apps/details?id=py.casalibre.mobile';
  const out = {
    minVersion: pick(env, plat, 'MOBILE_MIN_VERSION', '1.0.0'),     // never walls until deliberately raised
    latestVersion: pick(env, plat, 'MOBILE_LATEST_VERSION', '1.0.1'),
    storeUrl,
  };
  const e = String(email || '').trim().toLowerCase();
  if (e && testerEmails(env).includes(e)) {
    const tMin = pick(env, plat, 'MOBILE_TEST_MIN_VERSION', null);
    const tLatest = pick(env, plat, 'MOBILE_TEST_LATEST_VERSION', null);
    if (tMin) out.minVersion = tMin;
    if (tLatest) out.latestVersion = tLatest;
    if (tMin || tLatest) out.test = true;
  }
  return out;
}
