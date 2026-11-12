// Seller profile photo — the pure part (no I/O, unit-tested in tests/profilePhoto.test.mjs).
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

export const PHOTO_STATUS = { checking: 'checking', approved: 'approved', rejected: 'rejected' };
export const MAX_PROFILE_PHOTO_BYTES = 15 * 1024 * 1024;
export const AVATAR_PREFIX = 'avatars/';
export const avatarKeyFor = (uid, rand) => `${AVATAR_PREFIX}${uid}/${rand}.jpg`;

// The users columns (migration 021).
export const COLUMNS = [
  'profile_photo_url', 'profile_photo_key', 'profile_photo_pending_url', 'profile_photo_pending_key',
  'profile_photo_status', 'profile_photo_category', 'profile_photo_reason', 'profile_photo_checked_at',
  'profile_photo_attempts', 'profile_photo_error', 'profile_photo_updated_at',
];

// Why a photo was rejected — the model answers with one of these codes (FAIL: <code>).
export const FACE_FAIL_CATEGORIES = ['adult', 'violence', 'hate', 'logo', 'drawing', 'animal', 'object', 'group', 'no_face'];

// Short reasons shown to the seller. Spanish = Paraguayan voseo (stored in profile_photo_reason).
export const REASONS = {
  es: {
    adult: 'La foto tiene contenido para adultos. Subí una foto de tu cara.',
    violence: 'La foto muestra violencia o armas. Subí una foto de tu cara.',
    hate: 'La foto tiene símbolos o contenido ofensivo. Subí una foto de tu cara.',
    logo: 'Es un logo o una imagen con texto. Necesitamos una foto real de tu cara.',
    drawing: 'Es un dibujo, una caricatura o una ilustración. Necesitamos una foto real de tu cara.',
    animal: 'En la foto hay un animal, no una persona. Subí una foto de tu cara.',
    object: 'En la foto no aparece ninguna persona (es un objeto, una casa o un paisaje). Subí una foto de tu cara.',
    group: 'Aparecen varias personas y no se distingue una sola cara. Subí una foto donde estés solo vos.',
    no_face: 'No se ve bien tu cara (está tapada, de espaldas, muy lejos o borrosa). Subí una foto donde se vea tu cara de frente.',
    other: 'La foto no cumple las reglas: tiene que ser una foto real de tu cara.',
  },
  en: {
    adult: 'The photo has adult content. Upload a photo of your face.',
    violence: 'The photo shows violence or weapons. Upload a photo of your face.',
    hate: 'The photo has offensive symbols or content. Upload a photo of your face.',
    logo: 'It is a logo or an image with text. We need a real photo of your face.',
    drawing: 'It is a drawing, cartoon or illustration. We need a real photo of your face.',
    animal: 'The photo shows an animal, not a person. Upload a photo of your face.',
    object: 'There is no person in the photo (it is an object, a house or a landscape). Upload a photo of your face.',
    group: 'There are several people and no single face stands out. Upload a photo of just you.',
    no_face: 'Your face is not clearly visible (covered, from behind, too far or blurry). Upload a photo where your face can be seen.',
    other: 'The photo does not meet the rules: it must be a real photo of your face.',
  },
};
export const reasonFor = (category, lang = 'es') => (REASONS[lang] || REASONS.es)[category] || (REASONS[lang] || REASONS.es).other;

// The model's one-line answer → a verdict. "PASS" → pass; "FAIL: logo" → fail/logo (an
// unknown category → 'other'); anything else → error (asked again later, never approved).
export function parseFaceVerdict(text) {
  const s = String(text || '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim().toUpperCase();
  if (s.startsWith('PASS')) return { verdict: 'pass' };
  if (s.startsWith('FAIL')) {
    const c = s.slice(4).replace(/^[\s:–—-]+/, '').split(/[\s,.;]/)[0].toLowerCase().replace(/-/g, '_');
    return { verdict: 'fail', category: FACE_FAIL_CATEGORIES.includes(c) ? c : 'other' };
  }
  return { verdict: 'error', error: `unclear_answer: ${String(text || '').slice(0, 60)}` };
}

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
    const category = FACE_FAIL_CATEGORIES.includes(v.category) ? v.category : 'other';
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
