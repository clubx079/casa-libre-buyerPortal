// Sell-wizard drafts ("Borradores"). Pure helpers + a tiny store with the db
// injected (lib/db-shaped), so the API routes stay thin and the logic runs under
// node --test against the in-memory PostgREST stand-in.
//
// Every store call is scoped to the signed-in user's id — a user can only ever
// read, change or delete their own drafts.

// The wizard fields a draft keeps. Photos are uploaded as they're added (POST
// /api/drafts/photos → storage under drafts/<owner>/<draft>/…) and the draft keeps
// their list, so any device that opens it shows them; publishing reuses them.
export const DRAFT_KEYS = ['mode', 'seller_type', 'contact_name', 'neighborhood', 'city', 'addressText', 'ptype', 'price', 'currency', 'area', 'description', 'contact_phone'];
const MAX_LEN = { description: 5000 };
export const MAX_DRAFT_PHOTOS = 20;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const DRAFT_PHOTO_KEY = new RegExp(`^drafts/${UUID}/${UUID}/${UUID}\\.(webp|jpe?g|png)$`, 'i');

// [{ key, url }] → only well-formed draft-photo keys, at most 20, no repeats.
export function cleanDraftPhotos(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((p) => p && DRAFT_PHOTO_KEY.test(String(p.key || '')) && !seen.has(p.key) && seen.add(p.key))
    .slice(0, MAX_DRAFT_PHOTOS)
    .map((p) => ({ key: String(p.key), url: String(p.url || '').slice(0, 500) }));
}
export const draftPhotoKeys = (data) => cleanDraftPhotos(data?.photos).map((p) => p.key);

export function cleanDraftData(input) {
  const out = {};
  const src = input && typeof input === 'object' ? input : {};
  for (const k of DRAFT_KEYS) {
    if (src[k] == null) continue;
    const v = String(src[k]).slice(0, MAX_LEN[k] || 300);
    if (v !== '') out[k] = v;
  }
  const photos = cleanDraftPhotos(src.photos);
  if (photos.length) out.photos = photos;
  return out;
}

// Which of the previous photos are no longer in the draft (their files get deleted).
export const removedPhotoKeys = (before, after) => {
  const keep = new Set(draftPhotoKeys(after));
  return draftPhotoKeys(before).filter((k) => !keep.has(k));
};

// The publish request's photos, in the seller's order: `order` = [{ k: draft photo key }
// | { f: index into the uploaded files }]. A key must sit under one of `prefixes` (the
// publisher's own draft folders). → [{ key } | { file: i }], at most 20.
export function orderedPhotoSources(order, fileCount, prefixes) {
  const out = [];
  for (const o of Array.isArray(order) ? order : []) {
    if (o && typeof o.k === 'string' && DRAFT_PHOTO_KEY.test(o.k) && prefixes.some((p) => o.k.startsWith(p))) out.push({ key: o.k });
    else if (o && Number.isInteger(o.f) && o.f >= 0 && o.f < fileCount) out.push({ file: o.f });
  }
  return out.slice(0, MAX_DRAFT_PHOTOS);
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
  if (!cleanDraftPhotos(d.photos).length) miss.push('photos');
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

// The photo list is written ONLY by the photo endpoints (setDraftPhotos), never by the
// wizard's autosave — so a save racing an upload can't drop a photo.
export const withoutPhotos = (input) => { const d = cleanDraftData(input); delete d.photos; return d; };

export async function createDraft(db, uid, input, now = new Date()) {
  const data = withoutPhotos(input);
  if (!draftReady(data)) return { error: 'needs_address' };
  const [row] = await db.insert('listing_drafts', [{ user_id: uid, data, created_at: now.toISOString(), updated_at: now.toISOString() }]);
  return { draft: row };
}

export async function updateDraft(db, uid, id, input, now = new Date()) {
  if (!uuidOk(id)) return { error: 'not_found' };
  const before = await getDraft(db, uid, id);
  if (!before) return { error: 'not_found' };
  const data = withoutPhotos(input);
  const photos = cleanDraftPhotos(before.data?.photos);
  if (photos.length) data.photos = photos;
  const rows = await db.update('listing_drafts', `id=eq.${enc(id)}&user_id=eq.${enc(uid)}`, { data, updated_at: now.toISOString() });
  if (!rows?.length) return { error: 'not_found' };
  return { draft: rows[0] };
}

// A draft row by its owner (account id, or a guest's email-derived id) with its data
// as stored — the photo endpoints check ownership with it. → { id, data } | null
export async function getDraftRow(db, owner, id) {
  if (!uuidOk(id) || !uuidOk(owner)) return null;
  const [row] = await db.select('listing_drafts', `select=id,data,updated_at&id=eq.${enc(id)}&user_id=eq.${enc(owner)}&limit=1`);
  return row || null;
}
// Replace a draft's photo list (keeps everything else in its data as stored).
export async function setDraftPhotos(db, owner, row, photos, now = new Date()) {
  const data = { ...(row.data || {}) };
  const list = cleanDraftPhotos(photos);
  if (list.length) data.photos = list; else delete data.photos;
  await db.update('listing_drafts', `id=eq.${enc(row.id)}&user_id=eq.${enc(owner)}`, { data, updated_at: now.toISOString() });
  return list;
}

export async function deleteDraft(db, uid, id) {
  if (!uuidOk(id)) return false;
  const before = await getDraft(db, uid, id);
  if (!before) return false;
  await db.remove('listing_drafts', `id=eq.${enc(id)}&user_id=eq.${enc(uid)}`);
  return true;
}
