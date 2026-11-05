// Region block (AI Operations Plan, step 5 — Roland, 2 Nov: "nobody from Uganda is buying
// properties in Paraguay… suspend it before they've seized all your data"). The site answers
// 403 to visitors from blocked countries, by Cloudflare's CF-IPCountry header (the site sits
// behind Cloudflare). The same rule belongs in Cloudflare itself (Security → WAF → custom rule
// `ip.src.continent eq "AF"` → Block), which stops them before they reach the server; this is
// the safety net and it records each blocked request (PostHog 'geo_blocked') for the Admin
// Manager's security watch.
// Nov 6 2026 (user): the Africa block is LIFTED — no country is blocked by default; single
// suspicious IPs are blocked instead (lib/ipBlock.js, decided by the admin's security watch).
// GEO_BLOCK env: unset / 'off' → nothing blocked · or a list of ISO codes and/or 'africa',
// e.g. "africa,BD" (the old rule, still available).
// Edge-safe and pure — tests/geoBlock.test.mjs.

// ISO 3166-1 alpha-2 codes of every African country and territory.
export const AFRICA = ['DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW', 'EH', 'RE', 'YT', 'SH'];

export function blockedCountries(setting) {
  const raw = setting === undefined || setting === null ? 'off' : String(setting).trim();
  if (!raw || /^(off|none|0|false)$/i.test(raw)) return new Set();
  const out = new Set();
  for (const part of raw.split(/[\s,]+/).filter(Boolean)) {
    if (/^africa$/i.test(part)) AFRICA.forEach((c) => out.add(c));
    else if (/^[a-z]{2}$/i.test(part)) out.add(part.toUpperCase());
  }
  return out;
}

// Paths that must keep working from anywhere: webhooks and crons (servers, not visitors).
const OPEN = [/^\/api\/relay\/webhook/, /^\/api\/stripe\/webhook/, /^\/api\/cron\//, /^\/robots\.txt$/];
export const isOpenPath = (pathname) => OPEN.some((re) => re.test(String(pathname || '')));

// → true when this request is blocked
export function isBlocked({ country, pathname, blocked }) {
  const cc = String(country || '').trim().toUpperCase();
  if (!cc || cc === 'XX' || cc === 'T1') return false;   // unknown / Tor: not judged by country
  return blocked.has(cc) && !isOpenPath(pathname);
}

export const BLOCK_HTML = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Casa-Libre</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#222"><h1 style="font-size:1.4rem">Casa-Libre no está disponible en tu región</h1><p>Este sitio es para personas que buscan o publican propiedades en América Latina.</p></body></html>';
