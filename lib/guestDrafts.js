// Sell-wizard drafts for a seller who isn't signed in yet. Same table as the
// signed-in drafts (lib/drafts.js) — listing_drafts.user_id is required, so a guest
// draft is stored under an id derived from the email typed in the wizard: a
// name-based UUID (version 5; real account ids are version 4, so they never
// collide). The browser's own random key is kept inside the draft, so only that
// browser can read or change it while logged out. Signing in with the email moves
// the draft to the account (claimGuestDrafts), from any device, and it shows in
// My listings → Drafts. The IP is kept for the record. Photos are never stored.
// db is injected (lib/db-shaped) so this runs under node --test.
import crypto from 'node:crypto';
import { cleanDraftData, draftReady } from './drafts.js';

const NAMESPACE = 'casa-libre:guest-draft';
const norm = (email) => String(email || '').trim().toLowerCase();
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(e));
const uuidOk = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
const enc = encodeURIComponent;

export function guestOwnerId(email) {
  const h = crypto.createHash('sha1').update(`${NAMESPACE}:${norm(email)}`).digest().subarray(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;   // version 5
  h[8] = (h[8] & 0x3f) | 0x80;   // RFC 4122 variant
  const x = h.toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

// Create or update this browser's draft → { draft: { id } } | { error }.
// An id that isn't this browser's (or is gone) starts a new draft.
export async function saveGuestDraft(db, { email, key, id = null, data: input, ip = null }, now = new Date()) {
  if (!emailOk(email) || !uuidOk(key)) return { error: 'bad_request' };
  const data = cleanDraftData(input);
  if (!draftReady(data)) return { error: 'needs_address' };
  const owner = guestOwnerId(email);
  const stamped = { ...data, _guest_key: key, _guest_email: norm(email), ...(ip ? { _ip: String(ip).slice(0, 64) } : {}) };
  if (uuidOk(id)) {
    const [row] = await db.select('listing_drafts', `select=id,data&id=eq.${enc(id)}&user_id=eq.${owner}&limit=1`);
    if (row && row.data?._guest_key === key) {
      const rows = await db.update('listing_drafts', `id=eq.${enc(id)}&user_id=eq.${owner}`, { data: stamped, updated_at: now.toISOString() });
      if (rows?.length) return { draft: { id: rows[0].id } };
    }
  }
  const [row] = await db.insert('listing_drafts', [{ user_id: owner, data: stamped, created_at: now.toISOString(), updated_at: now.toISOString() }]);
  return { draft: { id: row.id } };
}

// This browser's draft, to resume the wizard → { id, data, updated_at } | null.
export async function getGuestDraft(db, { email, key, id }) {
  if (!emailOk(email) || !uuidOk(key) || !uuidOk(id)) return null;
  const [row] = await db.select('listing_drafts', `select=id,data,updated_at&id=eq.${enc(id)}&user_id=eq.${guestOwnerId(email)}&limit=1`);
  if (!row || row.data?._guest_key !== key) return null;
  return { id: row.id, data: cleanDraftData(row.data), updated_at: row.updated_at };
}

// Signed in as `email` → that email's guest drafts become the account's (the guest
// fields are dropped). Returns how many moved. Safe to call on every request.
export async function claimGuestDrafts(db, email, uid, now = new Date()) {
  if (!emailOk(email) || !uuidOk(uid)) return 0;
  const owner = guestOwnerId(email);
  const rows = await db.select('listing_drafts', `select=id,data&user_id=eq.${owner}&limit=50`);
  for (const r of rows) {
    await db.update('listing_drafts', `id=eq.${enc(r.id)}&user_id=eq.${owner}`, { user_id: uid, data: cleanDraftData(r.data), updated_at: now.toISOString() });
  }
  return rows.length;
}
