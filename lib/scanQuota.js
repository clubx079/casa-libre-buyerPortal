// Daily cap on AI photo checks (Groq vision): at most SCAN_DAILY_QUOTA photos a day per
// country site (default 5,000). Each check is logged in api_usage_log (api 'groq_vision',
// one row per listing checked, calls = photos sent). When a listing's photos don't fit in
// what is left of today's quota, it is NOT checked: it stays 'scanning' (the seller keeps
// seeing "Checking photos…") with moderation.state 'queued', and the hourly cron
// (/api/cron/image-scan, oldest first) checks it once the quota resets at local midnight.
export const SCAN_API = 'groq_vision';
export const DEFAULT_DAILY_QUOTA = 5000;
export const TZ = { py: 'America/Asuncion', bo: 'America/La_Paz', uy: 'America/Montevideo', ve: 'America/Caracas', sv: 'America/El_Salvador' };

export const dailyQuota = (env = process.env) => {
  const n = Number(env.SCAN_DAILY_QUOTA);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DAILY_QUOTA;
};

// Start of "today" in the country's local time, as an ISO instant (UTC).
export function dayStartIso(countryCode = 'py', now = new Date()) {
  const tz = TZ[countryCode] || TZ.py;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((x) => [x.type, x.value]));
  const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day) - offset).toISOString();
}

// Do `needed` more photo checks fit in today's quota, given `used` so far?
export const fitsQuota = (used, needed, quota) => needed <= 0 || used + needed <= quota;

// Photos checked so far today (sum of api_usage_log.calls since local midnight).
export async function usedToday(select, countryCode, now = new Date()) {
  const rows = await select('api_usage_log', `select=calls&api=eq.${SCAN_API}&created_at=gte.${encodeURIComponent(dayStartIso(countryCode, now))}&limit=100000`);
  return rows.reduce((s, r) => s + (Number(r.calls) || 0), 0);
}

// Record photo checks (best effort — a failed log must never block a listing).
export async function logScans(insert, calls, listingId) {
  if (!(calls > 0)) return;
  try {
    await insert('api_usage_log', [{ api: SCAN_API, source: 'listing_photo_check', code_path: `lib/listingScan.js#${listingId || ''}`, calls }], { returning: 'minimal' });
  } catch { /* table missing / network: ignore */ }
}
