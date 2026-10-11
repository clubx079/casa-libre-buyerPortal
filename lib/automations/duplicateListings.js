// "Same property listed twice" automation. Finds a Casa Libre user's own listings
// (origin 'user') that are EXACT copies of each other — same type, rent/sale, price,
// currency, neighbourhood, city, areas, rooms, contact phone and description — and
// emails the owner once per set of copies: "you listed the same property more than
// once", with a direct link to each copy and a button to My listings (where they can
// delete the extras).
//
//   • Only copies where the newest one was published after the automation was switched
//     on (enabled_at) — switching it on never emails about old duplicates.
//   • Once per set: email_log dedupe key dup:<every id of the set, sorted>, run_id = the
//     newest copy. A new extra copy makes a new set → one more email.
//   • Deleting a copy (owners delete listings for real) simply makes it stop matching.
//   • Closed / blocked / suspended accounts are skipped; one email per person per run.
// Pure + dependency-injected (tests/duplicateListings.test.mjs).
import { sendOnce } from './sendOnce.js';
import { typeLabel } from '../propertyTypeOptions.js';
import { isDeletedEmail } from '../accountDeletion.js';

export const DUPLICATES_AUTOMATION_ID = 'duplicate_listings';
const enc = encodeURIComponent;
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);

export const COLS = 'id,created_by,created_at,listing_type,property_type,price,currency,neighborhood,city,covered_area,land_area,floor_area,bedrooms,bathrooms,parking_spaces,contact_phone,description';
const text = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const num = (v) => (v == null || v === '' ? '' : String(Number(v)));

// Everything the seller filled in, normalised (case, spaces, number formats).
export function fingerprint(p) {
  return [
    p.listing_type, p.property_type, num(p.price), p.currency, text(p.neighborhood), text(p.city),
    num(p.covered_area), num(p.land_area), num(p.floor_area), num(p.bedrooms), num(p.bathrooms), num(p.parking_spaces),
    String(p.contact_phone || '').replace(/\D/g, ''), text(p.description),
  ].map((x) => text(x)).join('|');
}

// listings → [{ owner, ids (oldest first), listings }] for every owner+fingerprint with 2+.
export function findDuplicateSets(listings = []) {
  const groups = new Map();
  for (const p of listings) {
    if (!p.created_by) continue;
    const k = `${p.created_by}#${fingerprint(p)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => {
    const sorted = [...g].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return { owner: String(sorted[0].created_by), ids: sorted.map((p) => String(p.id)), listings: sorted };
  });
}

export const setKey = (ids) => `dup:${[...ids].sort().join(',')}`;
export const listingLink = (siteUrl, p) => `${siteUrl}/propiedad/${enc(p.id)}`;

// "Casa en venta · Villa Morra, Asunción"
export function listingTitle(p = {}) {
  const type = typeLabel(p.property_type, 'es') || p.property_type || '';
  const mode = p.listing_type === 'rent' ? 'en alquiler' : p.listing_type === 'sale' ? 'en venta' : '';
  const n = String(p.neighborhood || '').trim();
  const c = String(p.city || '').trim();
  const place = n && c && n.toLowerCase() !== c.toLowerCase() ? `${n}, ${c}` : (n || c);
  return [type ? [type, mode].filter(Boolean).join(' ') : '', place].filter(Boolean).join(' · ') || 'Tu propiedad';
}

// One markdown link per copy ("[Publicación 1 · 3 de octubre](https://…)"), one per line.
export function linksList(set, siteUrl, formatDate = (s) => String(s).slice(0, 10)) {
  return set.listings.map((p, i) => `[Publicación ${i + 1} · ${formatDate(p.created_at)}](${listingLink(siteUrl, p)})`).join('\n');
}

export async function runDuplicateListings(deps) {
  const { db, automation, templates = [], deliver, frame = {}, siteUrl = '', emailOverride = '',
    formatDate, limit = 100 } = deps;
  const out = { sets: 0, sent: 0, skipped: 0, failed: 0 };
  if (!automation || !automation.enabled || !automation.enabled_at) return { ...out, skippedReason: 'disabled' };
  const tpl = templates.find((t) => String(t.id) === String(automation.template_id));
  if (!tpl || tpl.is_active === false) return { ...out, skippedReason: 'no_template' };

  const listings = [];
  for (let off = 0; ; off += 1000) {
    const part = await db.select('properties', `select=${COLS}&origin=eq.user&created_by=not.is.null&order=created_at.asc&limit=1000&offset=${off}`);
    listings.push(...part);
    if (part.length < 1000) break;
  }
  const since = Date.parse(automation.enabled_at);
  const sets = findDuplicateSets(listings).filter((s) => Date.parse(s.listings[s.listings.length - 1].created_at) >= since);
  out.sets = sets.length;
  if (!sets.length) return out;

  const users = new Map();
  for (const part of chunks([...new Set(sets.map((s) => s.owner))], 100)) {
    for (const u of await db.select('users', `select=id,email,full_name,active,blocked,suspended&id=${inList(part)}`)) users.set(String(u.id), u);
  }

  const mailed = new Set();
  for (const s of sets) {
    if (out.sent + out.failed >= limit) break;
    const u = users.get(s.owner);
    if (closed(u)) { out.skipped++; continue; }
    if (mailed.has(s.owner)) continue;
    const newest = s.listings[s.listings.length - 1];
    const r = await sendOnce({
      db, automationId: DUPLICATES_AUTOMATION_ID, runId: newest.id, dedupeKey: setKey(s.ids), tpl, frame, deliver,
      to: emailOverride || String(u.email).trim().toLowerCase(),
      vars: {
        name: firstName(u.full_name),
        property_title: listingTitle(newest),
        listing_count: String(s.ids.length),
        listing_links: linksList(s, siteUrl, formatDate),
        my_listings_url: `${siteUrl}/cuenta/publicaciones`,
        property_url: listingLink(siteUrl, newest),
      },
    });
    if (r === 'sent') { out.sent++; mailed.add(s.owner); }
    if (r === 'failed') out.failed++;
  }
  return out;
}
