// The newsletter's numbers for THIS country (last 30 days): PostHog (listing views, searches)
// + this country's DB (prices, cities, types, photos, live listings). Same filters as the
// admin's analytics: the dev team's country never counted, events scoped to this site.
// → { vars, measuredAt } — vars as lib/newsletter/insightsCore.js insightVars(); a number that
// can't be measured is simply missing. Cached 6 h per process. Server only.
import 'server-only';
import * as db from '../db';
import { COUNTRY } from '../country';
import { insightVars } from './insightsCore';

const HOST = process.env.POSTHOG_HOST || 'https://us.posthog.com';
const SITE = String.raw`multiIf(
    coalesce(properties.site_country, '') != '', lower(properties.site_country),
    match(coalesce(properties.$host, ''), '(?i)casa-libre\\.com\\.bo'), 'bo',
    match(coalesce(properties.$host, ''), '(?i)(^|\\.)uy\\.casa-libre\\.com'), 'uy',
    match(coalesce(properties.$host, ''), '(?i)casa-libre\\.com\\.ve'), 've',
    match(coalesce(properties.$host, ''), '(?i)(^|\\.)sv\\.casa-libre\\.com'), 'sv',
    'py')`;
const UKEY = `if(coalesce(person.properties.email, '') != '', toString(person_id), coalesce(nullIf(properties.$ip, ''), 'unknown'))`;

export const insightsConfigured = () => !!(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID);

async function hogql(query) {
  const res = await fetch(`${HOST}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}`);
  return (await res.json()).results || [];
}

async function measure(cc) {
  const where = `timestamp >= now() - INTERVAL 30 DAY AND coalesce(properties.$geoip_country_name, '') != 'Pakistan' AND ${SITE} = '${cc}'`;
  const raw = { totals: [], listings: [], searches: {}, queries: [] };
  const live = await db.selectWithCount('properties', 'select=id&admin_status=eq.active&limit=1').catch(() => ({ count: 0 }));
  raw.activeListings = live.count || 0;
  if (!insightsConfigured()) return raw;
  const [totals, per, ops, queries] = await Promise.all([
    hogql(`SELECT count(), uniqExact(${UKEY}) FROM events WHERE event = 'property_viewed' AND ${where}`).catch(() => []),
    hogql(`SELECT toString(properties.property_id) AS pid, count() AS v FROM events WHERE event = 'property_viewed' AND ${where} GROUP BY pid ORDER BY v DESC LIMIT 5000`).catch(() => []),
    hogql(`SELECT toString(properties.operation) AS op, count() FROM events WHERE event = 'search_applied' AND ${where} GROUP BY op`).catch(() => []),
    hogql(`SELECT toString(properties.query) AS q, count() AS n FROM events WHERE event = 'search_applied' AND ${where} AND coalesce(toString(properties.query), '') != '' GROUP BY q ORDER BY n DESC LIMIT 60`).catch(() => []),
  ]);
  raw.totals = totals[0] || [];
  for (const [op, n] of ops) {
    if (op === 'alquiler') raw.searches.rent = Number(n) || 0;
    if (op === 'venta') raw.searches.sale = Number(n) || 0;
  }
  raw.queries = queries;
  const views = new Map(per.filter(([pid]) => /^[0-9a-f-]{36}$/i.test(String(pid))).map(([pid, v]) => [String(pid), Number(v) || 0]));
  const ids = [...views.keys()];
  for (let i = 0; i < ids.length; i += 150) {
    const rows = await db.select('properties', `select=id,price_usd,listing_type,city,property_type,origin,feature_image_url,additional_photos&id=in.(${ids.slice(i, i + 150).join(',')})`).catch(() => []);
    for (const p of rows) {
      raw.listings.push({
        views: views.get(String(p.id)) || 0, price_usd: p.price_usd, listing_type: p.listing_type, city: p.city,
        property_type: p.property_type, origin: p.origin,
        photos: (p.feature_image_url ? 1 : 0) + (Array.isArray(p.additional_photos) ? p.additional_photos.length : 0),
      });
    }
  }
  return raw;
}

const cache = (globalThis.__clNewsletterInsights ||= new Map());
export async function newsletterInsights({ country = COUNTRY.code, fresh = false } = {}) {
  const hit = cache.get(country);
  if (!fresh && hit && Date.now() - hit.at < 6 * 3600e3) return hit.value;
  const value = { vars: insightVars(await measure(country)), measuredAt: new Date().toISOString() };
  cache.set(country, { at: Date.now(), value });
  return value;
}
