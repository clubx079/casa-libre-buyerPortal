// What a listing's share links brought, from PostHog (HogQL), for the owner's share sheet,
// Mis publicaciones, the app and the share reward:
//   visits   unique people who opened a share link (server-side `share_link_click`, bots
//            filtered, the owner's own clicks not recorded — app/l/[code]/route.js)
//   contacts unique people who then tapped WhatsApp / call on the listing; the listing page
//            tags those events with `share_channel` when the visit came from a share link
//            (lib/shareVisit.js)
//   signups  accounts whose first visit was a share link of this listing (account_created,
//            first_medium 'share' + first_content = the code — lib/signupAttribution.js)
// Needs POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID (the same as the views automation).
// SHARE_FAKE_VISITS_FILE (local tests only): JSON { "<listing id>": visits } for the cron.
import 'server-only';
import fs from 'node:fs';
import { COUNTRY } from './country';
import { hogql, GEO } from './posthogViews';
import { CHANNELS, shareCode, isUuid } from './shareLinks';

export const statsConfigured = () => !!(process.env.SHARE_FAKE_VISITS_FILE || (process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID));
const CONTACT_EVENTS = "('contact_whatsapp_click','contact_call_click')";
const rowsOf = (r) => (Array.isArray(r) ? r : Object.values(r));

// rows → the stats object of the contract (pure; exported for the tests)
// visitRows/contactRows: [channel, total, last7, prev7]
export function assembleStats(visitRows = [], contactRows = [], signups = 0) {
  const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, { visits: 0, contacts: 0 }]));
  const sum = { visits: 0, contacts: 0 };
  const last7 = { visits: 0, contacts: 0 };
  const prev7 = { visits: 0, contacts: 0 };
  const add = (rows, k) => {
    for (const r of rows) {
      const [ch, total, l7, p7] = rowsOf(r);
      const c = CHANNELS.includes(ch) ? ch : 'copy';
      byChannel[c][k] += Number(total) || 0;
      sum[k] += Number(total) || 0;
      last7[k] += Number(l7) || 0;
      prev7[k] += Number(p7) || 0;
    }
  };
  add(visitRows, 'visits');
  add(contactRows, 'contacts');
  return { visits: sum.visits, contacts: sum.contacts, signups: Number(signups) || 0, byChannel, last7, prev7 };
}

const cache = (globalThis.__clShareStats ||= new Map());

// One listing's stats, or null when PostHog can't be read. Cached 5 minutes.
export async function listingShareStats(listingId) {
  if (!isUuid(listingId)) return null;
  const hit = cache.get(listingId);
  if (hit && hit.at > Date.now() - 5 * 60000) return hit.v;
  if (process.env.SHARE_FAKE_VISITS_FILE) {
    const fake = JSON.parse(fs.readFileSync(process.env.SHARE_FAKE_VISITS_FILE, 'utf8'));
    const v = Number(fake[listingId] || 0);
    return assembleStats(v ? [['wa', v, v, 0]] : [], [], 0);
  }
  if (!process.env.POSTHOG_PERSONAL_API_KEY || !process.env.POSTHOG_PROJECT_ID) return null;
  const id = listingId.toLowerCase();
  const windows = `count(DISTINCT distinct_id),
        count(DISTINCT if(timestamp > now() - INTERVAL 7 DAY, distinct_id, NULL)),
        count(DISTINCT if(timestamp <= now() - INTERVAL 7 DAY AND timestamp > now() - INTERVAL 14 DAY, distinct_id, NULL))`;
  try {
    const [visits, contacts, signups] = await Promise.all([
      hogql(`SELECT properties.channel, ${windows} FROM events
        WHERE event = 'share_link_click' AND properties.listing_id = '${id}' AND ${GEO}
        GROUP BY properties.channel`),
      hogql(`SELECT properties.share_channel, ${windows} FROM events
        WHERE event IN ${CONTACT_EVENTS} AND properties.property_id = '${id}' AND coalesce(properties.share_channel, '') != '' AND ${GEO}
        GROUP BY properties.share_channel`),
      hogql(`SELECT count() FROM events
        WHERE event = 'account_created' AND properties.first_medium = 'share' AND properties.first_content = '${shareCode(id)}'`),
    ]);
    const v = assembleStats(visits, contacts, rowsOf(signups?.[0] || [0])[0]);
    cache.set(listingId, { at: Date.now(), v });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    return v;
  } catch {
    return null;
  }
}

// Every listing of this country with share visits → Map(listing id → unique people), for the
// reward and the low-views nudge (cron). Empty Map when PostHog can't be read.
export async function shareVisitsByListing() {
  if (process.env.SHARE_FAKE_VISITS_FILE) {
    const fake = JSON.parse(fs.readFileSync(process.env.SHARE_FAKE_VISITS_FILE, 'utf8'));
    return new Map(Object.entries(fake).map(([k, v]) => [k, Number(v) || 0]));
  }
  if (!process.env.POSTHOG_PERSONAL_API_KEY || !process.env.POSTHOG_PROJECT_ID) return new Map();
  const rows = await hogql(`SELECT properties.listing_id, count(DISTINCT distinct_id) FROM events
    WHERE event = 'share_link_click' AND properties.site_country = '${COUNTRY.code}' AND ${GEO}
      AND timestamp > now() - INTERVAL 120 DAY
    GROUP BY properties.listing_id`);
  return new Map(rows.map(rowsOf).filter(([id]) => isUuid(String(id))).map(([id, n]) => [String(id), Number(n) || 0]));
}

// Several listings at once (Mis publicaciones): Map(id → { visits, contacts, last7: { visits, contacts } }).
export async function manyShareStats(ids) {
  const clean = [...new Set(ids.map(String).filter(isUuid).map((x) => x.toLowerCase()))].slice(0, 300);
  const out = new Map();
  if (!clean.length) return out;
  const blank = () => ({ visits: 0, contacts: 0, last7: { visits: 0, contacts: 0 } });
  if (process.env.SHARE_FAKE_VISITS_FILE) {
    const fake = JSON.parse(fs.readFileSync(process.env.SHARE_FAKE_VISITS_FILE, 'utf8'));
    for (const id of clean) if (fake[id]) out.set(id, { visits: Number(fake[id]), contacts: 0, last7: { visits: Number(fake[id]), contacts: 0 } });
    return out;
  }
  if (!process.env.POSTHOG_PERSONAL_API_KEY || !process.env.POSTHOG_PROJECT_ID) return out;
  const list = clean.map((id) => `'${id}'`).join(',');
  const windows = `count(DISTINCT distinct_id), count(DISTINCT if(timestamp > now() - INTERVAL 7 DAY, distinct_id, NULL))`;
  try {
    const [visits, contacts] = await Promise.all([
      hogql(`SELECT properties.listing_id, ${windows} FROM events WHERE event = 'share_link_click' AND properties.listing_id IN (${list}) AND ${GEO} GROUP BY properties.listing_id`),
      hogql(`SELECT properties.property_id, ${windows} FROM events WHERE event IN ${CONTACT_EVENTS} AND properties.property_id IN (${list}) AND coalesce(properties.share_channel, '') != '' AND ${GEO} GROUP BY properties.property_id`),
    ]);
    for (const [k, rows] of [['visits', visits], ['contacts', contacts]]) {
      for (const r of rows) {
        const [id, total, l7] = rowsOf(r);
        const s = out.get(String(id)) || blank();
        s[k] = Number(total) || 0;
        s.last7[k] = Number(l7) || 0;
        out.set(String(id), s);
      }
    }
  } catch { /* unknown → no numbers */ }
  return out;
}
