// All-time 'property_viewed' counts per listing for THIS country site, from PostHog
// (HogQL). Same filters as the admin's Property analytics tab, so the number in the
// seller's email matches what the admin sees: the dev team's country is never
// counted, old Saudi test traffic is hidden, and events are scoped to this site.
//   POSTHOG_PERSONAL_API_KEY  phx_… (query:read)   POSTHOG_PROJECT_ID   POSTHOG_HOST
// AUTOMATION_FAKE_VIEWS_FILE (local end-to-end tests only): path to a JSON file
// {"<propertyId>": views}, re-read on every run so a test can change the counts.
import 'server-only';
import fs from 'node:fs';
import { COUNTRY } from './country';

const HOST = process.env.POSTHOG_HOST || 'https://us.posthog.com';
const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT = process.env.POSTHOG_PROJECT_ID;

const SITE_EXPR = String.raw`
  multiIf(
    coalesce(properties.site_country, '') != '', lower(properties.site_country),
    match(coalesce(properties.$host, ''), '(?i)casa-libre\\.com\\.bo'), 'bo',
    match(coalesce(properties.$host, ''), '(?i)(^|\\.)uy\\.casa-libre\\.com'), 'uy',
    match(coalesce(properties.$host, ''), '(?i)casa-libre\\.com\\.ve'), 've',
    'py'
  )`;
const HIDE_SAUDI_BEFORE = '2026-09-21';
const GEO = `coalesce(properties.$geoip_country_name, '') != 'Pakistan' AND NOT (coalesce(properties.$geoip_country_name, '') = 'Saudi Arabia' AND timestamp < toDateTime('${HIDE_SAUDI_BEFORE} 00:00:00'))`;

export const viewsConfigured = () => !!(process.env.AUTOMATION_FAKE_VIEWS_FILE || (KEY && PROJECT));

async function hogql(query) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).results || [];
}

// ids → Map(id → views). Only uuid-shaped ids are sent to the query.
export async function fetchListingViews(ids) {
  if (process.env.AUTOMATION_FAKE_VIEWS_FILE) {
    const fake = JSON.parse(fs.readFileSync(process.env.AUTOMATION_FAKE_VIEWS_FILE, 'utf8'));
    return new Map(ids.filter((id) => fake[id] != null).map((id) => [id, Number(fake[id])]));
  }
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(String(id)));
  const out = new Map();
  for (let i = 0; i < clean.length; i += 200) {
    const part = clean.slice(i, i + 200).map((id) => `'${id}'`).join(',');
    const rows = await hogql(`
      SELECT properties.property_id AS pid, count() AS views
      FROM events
      WHERE event = 'property_viewed'
        AND properties.property_id IN (${part})
        AND ${GEO}
        AND ${SITE_EXPR} = '${COUNTRY.code}'
      GROUP BY pid`);
    for (const r of rows) {
      const [pid, v] = Array.isArray(r) ? r : Object.values(r);
      if (pid) out.set(String(pid), Number(v) || 0);
    }
  }
  return out;
}
