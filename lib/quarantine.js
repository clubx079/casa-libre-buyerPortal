// Buyer-portal → admin Quarantine bridge. When a user completes the wizard's
// address step but doesn't verify, we hold their property ADDRESS (only) in the
// same `ingest_quarantine` table the scraper uses, so it shows in the admin
// Quarantine section for review (Release → promote, Discard → drop).
import 'server-only';
import { select, insert, remove } from './db';
import { COUNTRY } from './country';

const SOURCE_KEY = 'user_submissions';
let cachedSourceId = null;

async function findUserSubmissionsSourceId() {
  if (cachedSourceId) return cachedSourceId;
  try {
    const rows = await select('scrape_sources', `select=id&key=eq.${SOURCE_KEY}&limit=1`);
    if (Array.isArray(rows) && rows.length) cachedSourceId = rows[0].id;
  } catch {}
  return cachedSourceId;
}

// The inert scrape_sources row that owns buyer-portal user submissions. Never
// scrapes (is_active / cron_enabled false); it only gives quarantine rows a
// valid source_id so they slot into the existing admin UI. Created on first use.
export async function getUserSubmissionsSourceId() {
  if (await findUserSubmissionsSourceId()) return cachedSourceId;
  const res = await insert('scrape_sources', {
    key: SOURCE_KEY,
    name: 'User submissions — buyer portal',
    adapter: 'manual',
    base_url: COUNTRY.defaultUrl,
    is_active: false,
    cron_enabled: false,
  }, { upsert: true, onConflict: 'key', returning: 'representation' });
  const row = Array.isArray(res) ? res[0] : res;
  cachedSourceId = row?.id || null;
  return cachedSourceId;
}

// Quarantine an unverified user's property ADDRESS (only — no price/photos).
// Upsert-stable per email so a re-submit updates the same row instead of piling
// up duplicates. Reason `unverified_seller` shows in the admin Quarantine filter.
export async function quarantineUserAddress({ email, mode, sellerType, neighborhood, city, address, fullName }) {
  const sourceId = await getUserSubmissionsSourceId();
  if (!sourceId) throw new Error('no user_submissions source');
  const payload = {
    slug: `user-${Date.now().toString(36)}`,
    listing_type: mode === 'alquiler' ? 'rent' : 'sale',
    address: address || neighborhood || null,
    neighborhood: neighborhood || null,
    city: city || null,
    province: COUNTRY.defaultProvince,
    country: COUNTRY.name,
    origin: 'user',
    is_complete: false,
    status: 'draft',
    property_status: 'available',
    contact_name: fullName || null,
    raw_data: {
      submitted_via: 'buyer-portal-wizard',
      unverified: true,
      user_email: String(email || '').trim().toLowerCase(),
      seller_type: sellerType || null,
      note: 'Address captured from a user who completed the address step but did not verify.',
    },
  };
  await insert('ingest_quarantine', [{
    source_id: sourceId,
    external_id: `user:${String(email).trim().toLowerCase()}`,
    reasons: ['unverified_seller'],
    payload,
    status: 'pending',
    created_at: new Date().toISOString(),
  }], { upsert: true, onConflict: 'source_id,external_id', returning: 'minimal' });
}

// The address above is held only for people who never verify. Once that email becomes a
// verified account (code or Google) they're a user who publishes through the normal flow,
// so the held record is removed. Called from lib/users.js wherever an account is verified.
// Best-effort: never blocks a sign-in.
export async function clearUserAddress(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return;
  try {
    const sourceId = await findUserSubmissionsSourceId();
    if (sourceId) await remove('ingest_quarantine', `source_id=eq.${sourceId}&external_id=eq.${encodeURIComponent(`user:${e}`)}&status=eq.pending`);
  } catch (err) {
    console.error('[quarantine] clearing a verified user\'s address failed:', err?.message || err);
  }
}
