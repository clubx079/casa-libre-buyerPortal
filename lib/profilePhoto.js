// Seller profile photo (the seller's face OR their company logo) — the pure part (no I/O, unit-tested in tests/profilePhoto.test.mjs).
//
// One photo per account, on the users row (migration 021). Every upload or replacement is
// saved at once as the PENDING photo (a draft: nothing is lost) with status 'checking',
// and the AI checks it (lib/profilePhotoScan.js, same Groq vision model as listing photos):
//   checking → approved   the pending photo becomes THE photo; the one it replaces is deleted
//   checking → rejected   the pending photo stays (only its owner sees it, in Mi cuenta,
//                         with the reason) until the next upload or removal; the previously
//                         approved photo, if any, keeps showing on the listings
//   AI error              stays 'checking' (attempts + error recorded); the hourly cron asks
//                         again — never approved without a check
// Only the APPROVED photo is ever shown to buyers.
//
// Files (B2, same bucket as listing photos, avatars/<uid>/<random>.jpg): the transitions
// below say which keys to delete. A replaced or removed file is deleted right away (never
// kept as an orphan): approved → the old approved file; new upload → the previous pending
// (checking/rejected) file; remove → both.

import { lastRejected } from './profilePhotoKind.js';

export const PHOTO_STATUS = { checking: 'checking', approved: 'approved', rejected: 'rejected' };
export const MAX_PROFILE_PHOTO_BYTES = 15 * 1024 * 1024;
export const AVATAR_PREFIX = 'avatars/';
export const avatarKeyFor = (uid, rand) => `${AVATAR_PREFIX}${uid}/${rand}.jpg`;
// The full photo the seller picked is kept next to the cropped one (same name + '-orig'), so
// clicking the photo can open the crop dialog again on the whole picture. Never shown to buyers.
export const origKeyOf = (key) => (key && /\.jpg$/.test(key) ? key.replace(/\.jpg$/, '-orig.jpg') : null);
// Same-origin URLs for the crop dialog (a canvas can only export same-origin images).
const editPath = (key) => (key ? `/api/media/${key.split('/').map(encodeURIComponent).join('/')}` : null);

// The users columns (migration 021).
export const COLUMNS = [
  'profile_photo_url', 'profile_photo_key', 'profile_photo_pending_url', 'profile_photo_pending_key',
  'profile_photo_status', 'profile_photo_category', 'profile_photo_reason', 'profile_photo_checked_at',
  'profile_photo_attempts', 'profile_photo_error', 'profile_photo_updated_at',
];

// Why a photo was rejected — the model answers with one of these codes (FAIL: <code>).
// Since Nov 2026 the photo can be the seller's face OR their company logo (or any normal
// professional image); only clearly inappropriate or unrelated images are rejected.
export const PROFILE_FAIL_CATEGORIES = ['adult', 'violence', 'hate', 'junk'];
// Older answers / stored rows (the faces-only check) are still understood and explained.
const LEGACY_CATEGORIES = ['logo', 'drawing', 'animal', 'object', 'group', 'no_face'];
export const FACE_FAIL_CATEGORIES = PROFILE_FAIL_CATEGORIES;   // old name, kept for callers

// Short reasons shown to the seller. Spanish = Paraguayan voseo (stored in profile_photo_reason).
export const REASONS = {
  es: {
    adult: 'La imagen tiene contenido para adultos. Subí una foto tuya o el logo de tu empresa.',
    violence: 'La imagen muestra violencia o armas. Subí una foto tuya o el logo de tu empresa.',
    hate: 'La imagen tiene símbolos o contenido ofensivo. Subí una foto tuya o el logo de tu empresa.',
    junk: 'La imagen no parece una foto de perfil (meme, captura de pantalla u objeto sin relación). Subí una foto tuya o el logo de tu empresa.',
    // faces-only check (before Nov 2026) — only for rows rejected back then
    logo: 'La imagen no cumplía las reglas anteriores. Ahora podés subir una foto tuya o el logo de tu empresa.',
    drawing: 'La imagen no cumplía las reglas anteriores. Ahora podés subir una foto tuya o el logo de tu empresa.',
    animal: 'La imagen no parece una foto de perfil. Subí una foto tuya o el logo de tu empresa.',
    object: 'La imagen no parece una foto de perfil. Subí una foto tuya o el logo de tu empresa.',
    group: 'La imagen no cumplía las reglas anteriores. Ahora podés subir una foto tuya o el logo de tu empresa.',
    no_face: 'La imagen no cumplía las reglas anteriores. Ahora podés subir una foto tuya o el logo de tu empresa.',
    other: 'La imagen no cumple las reglas: subí una foto tuya o el logo de tu empresa.',
  },
  en: {
    adult: 'The image has adult content. Upload a photo of yourself or your company logo.',
    violence: 'The image shows violence or weapons. Upload a photo of yourself or your company logo.',
    hate: 'The image has offensive symbols or content. Upload a photo of yourself or your company logo.',
    junk: "The image doesn't look like a profile photo (a meme, a screenshot or an unrelated object). Upload a photo of yourself or your company logo.",
    logo: "The image didn't meet the old rules. You can now upload a photo of yourself or your company logo.",
    drawing: "The image didn't meet the old rules. You can now upload a photo of yourself or your company logo.",
    animal: "The image doesn't look like a profile photo. Upload a photo of yourself or your company logo.",
    object: "The image doesn't look like a profile photo. Upload a photo of yourself or your company logo.",
    group: "The image didn't meet the old rules. You can now upload a photo of yourself or your company logo.",
    no_face: "The image didn't meet the old rules. You can now upload a photo of yourself or your company logo.",
    other: 'The image does not meet the rules: upload a photo of yourself or your company logo.',
  },
  pt: {
    adult: 'A imagem tem conteúdo adulto. Envie uma foto sua ou o logo da sua empresa.',
    violence: 'A imagem mostra violência ou armas. Envie uma foto sua ou o logo da sua empresa.',
    hate: 'A imagem tem símbolos ou conteúdo ofensivo. Envie uma foto sua ou o logo da sua empresa.',
    junk: 'A imagem não parece uma foto de perfil (um meme, uma captura de tela ou um objeto sem relação). Envie uma foto sua ou o logo da sua empresa.',
    logo: 'A imagem não cumpria as regras anteriores. Agora você pode enviar uma foto sua ou o logo da sua empresa.',
    drawing: 'A imagem não cumpria as regras anteriores. Agora você pode enviar uma foto sua ou o logo da sua empresa.',
    animal: 'A imagem não parece uma foto de perfil. Envie uma foto sua ou o logo da sua empresa.',
    object: 'A imagem não parece uma foto de perfil. Envie uma foto sua ou o logo da sua empresa.',
    group: 'A imagem não cumpria as regras anteriores. Agora você pode enviar uma foto sua ou o logo da sua empresa.',
    no_face: 'A imagem não cumpria as regras anteriores. Agora você pode enviar uma foto sua ou o logo da sua empresa.',
    other: 'A imagem não cumpre as regras: envie uma foto sua ou o logo da sua empresa.',
  },
};
export const reasonFor = (category, lang = 'es') => (REASONS[lang] || REASONS.es)[category] || (REASONS[lang] || REASONS.es).other;

// The model's one-line answer → a verdict. "PASS" → pass; "FAIL: junk" → fail/junk. A code
// outside PROFILE_FAIL_CATEGORIES (e.g. an old "logo" or "no_face" habit) is NOT a reason to
// reject any more → pass; anything else → error (asked again later, never approved).
export function parseProfileVerdict(text) {
  const s = String(text || '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim().toUpperCase();
  if (s.startsWith('PASS')) return { verdict: 'pass' };
  if (s.startsWith('FAIL')) {
    const c = s.slice(4).replace(/^[\s:–—-]+/, '').split(/[\s,.;]/)[0].toLowerCase().replace(/-/g, '_');
    if (PROFILE_FAIL_CATEGORIES.includes(c)) return { verdict: 'fail', category: c };
    if (LEGACY_CATEGORIES.includes(c)) return { verdict: 'pass' };      // faces and logos are fine now
    return { verdict: 'fail', category: 'other' };
  }
  return { verdict: 'error', error: `unclear_answer: ${String(text || '').slice(0, 60)}` };
}
export const parseFaceVerdict = parseProfileVerdict;   // old name

const keysToDelete = (...keys) => [...new Set(keys.filter(Boolean))];

// A new photo was stored (upload or replacement) → it is the pending one, being checked.
// The previous pending file (still checking, or rejected) is no longer needed.
export function onUpload(row = {}, { key, url }, now = new Date()) {
  const prevPending = row.profile_photo_pending_key && row.profile_photo_pending_key !== row.profile_photo_key ? row.profile_photo_pending_key : null;
  return {
    patch: {
      profile_photo_pending_url: url,
      profile_photo_pending_key: key,
      profile_photo_status: PHOTO_STATUS.checking,
      profile_photo_category: null,
      profile_photo_reason: null,
      profile_photo_attempts: 0,
      profile_photo_error: null,
      profile_photo_updated_at: now.toISOString(),
    },
    deleteKeys: keysToDelete(prevPending !== key ? prevPending : null),
  };
}

// The AI check answered for the pending photo. Returns { outcome, patch, deleteKeys };
// outcome 'skipped' when there is nothing being checked (removed or replaced meanwhile).
export function onVerdict(row = {}, v = {}, now = new Date()) {
  if (row.profile_photo_status !== PHOTO_STATUS.checking || !row.profile_photo_pending_key) return { outcome: 'skipped', patch: null, deleteKeys: [] };
  const attempts = (Number(row.profile_photo_attempts) || 0) + 1;
  const at = now.toISOString();
  if (v.verdict === 'pass') {
    return {
      outcome: PHOTO_STATUS.approved,
      patch: {
        profile_photo_url: row.profile_photo_pending_url,
        profile_photo_key: row.profile_photo_pending_key,
        profile_photo_pending_url: null,
        profile_photo_pending_key: null,
        profile_photo_status: PHOTO_STATUS.approved,
        profile_photo_category: null,
        profile_photo_reason: null,
        profile_photo_checked_at: at,
        profile_photo_attempts: attempts,
        profile_photo_error: null,
      },
      // the photo it replaces — deleted only now, so it kept showing during the check
      deleteKeys: keysToDelete(row.profile_photo_key !== row.profile_photo_pending_key ? row.profile_photo_key : null),
    };
  }
  if (v.verdict === 'fail') {
    const category = PROFILE_FAIL_CATEGORIES.includes(v.category) ? v.category : 'other';
    return {
      outcome: PHOTO_STATUS.rejected,
      patch: {
        profile_photo_status: PHOTO_STATUS.rejected,
        profile_photo_category: category,
        profile_photo_reason: reasonFor(category, 'es'),
        profile_photo_checked_at: at,
        profile_photo_attempts: attempts,
        profile_photo_error: null,
      },
      deleteKeys: [],   // the approved photo (if any) stays; the rejected file waits for the next upload/removal
    };
  }
  return {
    outcome: 'retry',
    patch: { profile_photo_attempts: attempts, profile_photo_error: String(v.error || 'unknown_error').slice(0, 300) },
    deleteKeys: [],
  };
}

// Remove: no photo at all any more (the approved one disappears from the listings too).
export function onRemove(row = {}, now = new Date()) {
  return {
    patch: {
      profile_photo_url: null, profile_photo_key: null, profile_photo_pending_url: null, profile_photo_pending_key: null,
      profile_photo_status: null, profile_photo_category: null, profile_photo_reason: null, profile_photo_checked_at: null,
      profile_photo_attempts: 0, profile_photo_error: null, profile_photo_updated_at: now.toISOString(),
    },
    deleteKeys: keysToDelete(row.profile_photo_key, row.profile_photo_pending_key),
  };
}

// What the owner sees in Mi cuenta. `photo` = the approved photo (what buyers see);
// `pending` = the photo being checked / rejected (owner-only).
export function ownerView(row = {}, lang = 'es') {
  const status = row.profile_photo_status || null;
  const pending = status === PHOTO_STATUS.checking || status === PHOTO_STATUS.rejected ? row.profile_photo_pending_url || null : null;
  return {
    status: status || (row.profile_photo_url ? PHOTO_STATUS.approved : null),
    photo: row.profile_photo_url || null,
    pending,
    category: status === PHOTO_STATUS.rejected ? row.profile_photo_category || 'other' : null,
    reason: status === PHOTO_STATUS.rejected ? (lang === 'es' ? row.profile_photo_reason || reasonFor(row.profile_photo_category, 'es') : reasonFor(row.profile_photo_category, lang)) : null,
    checked_at: row.profile_photo_checked_at || null,
    updated_at: row.profile_photo_updated_at || null,
    // to re-crop the approved photo: the whole original first, the cropped photo as fallback (older uploads)
    edit_src: row.profile_photo_url ? editPath(origKeyOf(row.profile_photo_key)) : null,
    edit_fallback: row.profile_photo_url ? editPath(row.profile_photo_key) : null,
    // the last upload turned down because it was neither a face nor a logo (nothing was saved):
    // { at, what, label, message, kept } while nothing newer was uploaded — Mi cuenta and the app show it
    last_rejected: lastRejected(row, lang),
  };
}

// The photo buyers see (approved only; null = the site looks exactly as before).
export const publicPhoto = (row = {}) => row.profile_photo_url || null;

// Should a page view nudge a check that seems stuck (server restarted mid-check, AI down)?
// Only for 'checking' photos untouched for at least minAgeMs.
export function isStale(row = {}, now = new Date(), minAgeMs = 60_000) {
  if (row.profile_photo_status !== PHOTO_STATUS.checking || !row.profile_photo_pending_key) return false;
  const t = Date.parse(row.profile_photo_updated_at || 0);
  return !Number.isFinite(t) || now.getTime() - t >= minAgeMs;
}

// Attach the approved seller photos to listings ({ id, ... }) from a Map property id → url.
// Listings without one are returned untouched (same object), so nothing else changes.
export function withSellerPhotos(listings, byProperty) {
  if (!Array.isArray(listings) || !byProperty || !byProperty.size) return listings;
  return listings.map((l) => (l && byProperty.has(String(l.id)) ? { ...l, seller_photo: byProperty.get(String(l.id)) } : l));
}
