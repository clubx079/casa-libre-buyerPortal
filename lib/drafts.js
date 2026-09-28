// Sell-wizard drafts ("Borradores"). Pure helpers + a tiny store with the db
// injected (lib/db-shaped), so the API routes stay thin and the logic runs under
// node --test against the in-memory PostgREST stand-in.
//
// Every store call is scoped to the signed-in user's id — a user can only ever
// read, change or delete their own drafts.

// The wizard fields a draft keeps. Photos are not stored (they're files; the user
// re-adds them when finishing the listing).
export const DRAFT_KEYS = ['mode', 'seller_type', 'contact_name', 'neighborhood', 'city', 'addressText', 'ptype', 'price', 'currency', 'area', 'description', 'contact_phone'];
const MAX_LEN = { description: 5000 };

export function cleanDraftData(input) {
  const out = {};
  const src = input && typeof input === 'object' ? input : {};
  for (const k of DRAFT_KEYS) {
    if (src[k] == null) continue;
    const v = String(src[k]).slice(0, MAX_LEN[k] || 300);
    if (v !== '') out[k] = v;
  }
  return out;
}

// A draft is only worth keeping once the address is chosen.
export const draftReady = (data) => !!(data && String(data.neighborhood || '').trim());

// What's still missing before it can be published (drives the "Falta: …" hint).
export function draftMissing(data) {
  const d = data || {};
  const miss = [];
  if (!d.price) miss.push('price');
  if (!d.area) miss.push('area');
  if (String(d.contact_phone || '').replace(/\D/g, '').length < 6) miss.push('phone');
  miss.push('photos');   // never stored in a draft
  return miss;
}

const uuidOk = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
const enc = encodeURIComponent;

export async function listDrafts(db, uid) {
  return db.select('listing_drafts', `select=id,data,created_at,updated_at&user_id=eq.${enc(uid)}&order=updated_at.desc&limit=50`);
}

export async function getDraft(db, uid, id) {
  if (!uuidOk(id)) return null;
  const [row] = await db.select('listing_drafts', `select=id,data,created_at,updated_at&id=eq.${enc(id)}&user_id=eq.${enc(uid)}&limit=1`);
  return row || null;
}

export async function createDraft(db, uid, input, now = new Date()) {
  const data = cleanDraftData(input);
  if (!draftReady(data)) return { error: 'needs_address' };
  const [row] = await db.insert('listing_drafts', [{ user_id: uid, data, created_at: now.toISOString(), updated_at: now.toISOString() }]);
  return { draft: row };
}

export async function updateDraft(db, uid, id, input, now = new Date()) {
  if (!uuidOk(id)) return { error: 'not_found' };
  const data = cleanDraftData(input);
  const rows = await db.update('listing_drafts', `id=eq.${enc(id)}&user_id=eq.${enc(uid)}`, { data, updated_at: now.toISOString() });
  if (!rows?.length) return { error: 'not_found' };
  return { draft: rows[0] };
}

export async function deleteDraft(db, uid, id) {
  if (!uuidOk(id)) return false;
  const before = await getDraft(db, uid, id);
  if (!before) return false;
  await db.remove('listing_drafts', `id=eq.${enc(id)}&user_id=eq.${enc(uid)}`);
  return true;
}
