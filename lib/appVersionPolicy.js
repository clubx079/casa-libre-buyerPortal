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
//
// ADMIN CONTROL (admin portal → Mobile app updates): an `automations` row 'app_versions'
// (enabled, settings in free_tiers[0] — no table of its own) written to every country's
// DB. When it is enabled, any value filled in there wins over the env var with the same
// meaning; an empty field, a disabled row or no row at all → the env vars, exactly as
// before. Shape: { android: { min, latest, storeUrl }, ios: { … }, testEmails: [..],
//                  test: { android: { min, latest }, ios: { … } } }

import { PLAY_STORE_URL } from './appLinks.js';

export const APP_VERSIONS_ID = 'app_versions';

const VER = /^\d{1,3}(\.\d{1,3}){0,2}$/;
const ver = (v) => (typeof v === 'string' && VER.test(v.trim()) ? v.trim() : null);
const url = (v) => (typeof v === 'string' && /^https:\/\//.test(v.trim()) ? v.trim() : null);

// automations row → the env-style keys it overrides ({} when off / missing / junk).
export function settingsToEnv(row) {
  const s = row && row.enabled && Array.isArray(row.free_tiers) ? row.free_tiers[0] : null;
  if (!s || typeof s !== 'object') return {};
  const out = {};
  for (const plat of ['android', 'ios']) {
    const P = plat.toUpperCase(), p = s[plat] || {}, t = (s.test || {})[plat] || {};
    if (ver(p.min)) out[`MOBILE_MIN_VERSION_${P}`] = ver(p.min);
    if (ver(p.latest)) out[`MOBILE_LATEST_VERSION_${P}`] = ver(p.latest);
    if (url(p.storeUrl)) out[`MOBILE_${P}_STORE_URL`] = url(p.storeUrl);
    if (ver(t.min)) out[`MOBILE_TEST_MIN_VERSION_${P}`] = ver(t.min);
    if (ver(t.latest)) out[`MOBILE_TEST_LATEST_VERSION_${P}`] = ver(t.latest);
  }
  const emails = Array.isArray(s.testEmails) ? s.testEmails.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes('@')) : [];
  if (emails.length) out.MOBILE_TEST_EMAILS = emails.join(',');
  return out;
}

const pick = (env, plat, name, dflt) => env[`${name}_${plat.toUpperCase()}`] || env[name] || dflt;

export function testerEmails(env) {
  return String(env.MOBILE_TEST_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function appVersionPolicy({ platform, email, env: baseEnv = process.env, settings = null } = {}) {
  const fromAdmin = settingsToEnv(settings);
  const env = { ...baseEnv, ...fromAdmin };
  const plat = String(platform || '').toLowerCase() === 'android' ? 'android' : 'ios';
  const storeUrl = plat === 'ios'
    ? env.MOBILE_IOS_STORE_URL || 'https://apps.apple.com/app/id6805488261'
    : env.MOBILE_ANDROID_STORE_URL || PLAY_STORE_URL;
  const out = {
    minVersion: pick(env, plat, 'MOBILE_MIN_VERSION', '1.0.0'),     // never walls until deliberately raised
    latestVersion: pick(env, plat, 'MOBILE_LATEST_VERSION', '1.0.1'),
    storeUrl,
    source: Object.keys(fromAdmin).length ? 'admin' : 'env',
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
