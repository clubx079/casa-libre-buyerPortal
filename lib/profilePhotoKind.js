// What a seller's APPROVED profile photo shows — pure part (tests/profilePhotoKind.test.mjs).
// The "Show your face" automation (lib/automations/photoFace.js) emails people whose photo is a
// logo / text / something else, and stops as soon as it is a real photo of the person.
//   face   a photo of one real person whose face is clearly visible
//   logo   a logo, brand mark, company name, text, business card or banner
//   other  anything else: a house or building, a group / team photo, a drawn or cartoon avatar,
//          a person whose face can't be seen, an object
// Stored on the users row: profile_photo_kind + profile_photo_kind_key (= the profile_photo_key it
// was decided for, so a new photo is checked again) + profile_photo_kind_at.
// Website migration: admin repo migrations/013_profile_photo_kind.sql.

export const PHOTO_KINDS = ['face', 'logo', 'other'];

export const KIND_PROMPT = `This is the profile picture a seller or real-estate agent uses on a property website. Buyers see it next to the seller's name.
Reply with exactly one word:
FACE if it is a photo of one real person and their face is clearly visible (a selfie, headshot, portrait, half or full body photo; glasses, hats, uniforms and any background are fine).
LOGO if it is mainly a logo, a brand mark, a company or agency name, text, a business card, a banner or a sign.
OTHER for anything else: a house, building or property, a group or team photo, a drawn, cartoon or AI avatar, a person whose face cannot be seen, an object.`;

// The model's answer → 'face' | 'logo' | 'other' | null (unreadable → ask again later).
export function parseKind(text) {
  const t = String(text || '').trim().toUpperCase();
  const m = /\b(FACE|LOGO|OTHER)\b/.exec(t);
  return m ? m[1].toLowerCase() : null;
}

// Has THIS photo been checked? (the kind belongs to the current approved photo)
// (kept for the stored kinds; the UPLOAD check below uses UPLOAD_KIND_PROMPT)
export const kindIsCurrent = (u = {}) => !!u.profile_photo_key && !!u.profile_photo_kind && u.profile_photo_kind_key === u.profile_photo_key;

// An approved photo that is not a real photo of the person → the automation's audience.
export const hasApprovedPhoto = (u = {}) => u.profile_photo_status === 'approved' && !!u.profile_photo_url && !!u.profile_photo_key;
// "Show your face" = a LOGO photo (please add a headshot). Since Nov 22 the "?" photos (kind
// 'other') get the wrong-photo emails instead (lib/automations/photoFace.js pickPhotoWrong).
export const needsFace = (u = {}) => hasApprovedPhoto(u) && kindIsCurrent(u) && u.profile_photo_kind === 'logo';

// ── Upload-time check (Roland, Nov 20): block photos that are neither a face nor a logo ──────────
// The upload (/api/account/profile-photo POST — the website, and the app, which opens the
// website's Settings) asks the AI right away with a short timeout. FACE / LOGO → accepted (the kind
// is kept for the "Show your face" emails); OTHER → rejected: nothing is saved, the current photo
// stays, and the person is told what the picture looks like. AI down / slow / unclear → accepted
// and labelled later (lib/profilePhotoKindScan.js): an outage never blocks an upload.
// The model names what an OTHER picture shows with one of these codes (never free text, so the
// message and the emails only ever say words we wrote).
export const WRONG_WHAT = ['house', 'apartment', 'building', 'room', 'land', 'property', 'object', 'animal', 'food', 'vehicle', 'landscape', 'group', 'drawing', 'no_face', 'screenshot', 'document', 'other'];

// "Esta imagen parece ser una foto de <…>"
export const WRONG_WHAT_LABEL = {
  es: {
    house: 'una casa', apartment: 'un departamento', building: 'un edificio', room: 'un ambiente de una casa',
    land: 'un terreno', property: 'una propiedad', object: 'un objeto', animal: 'un animal', food: 'comida',
    vehicle: 'un vehículo', landscape: 'un paisaje', group: 'un grupo de personas', drawing: 'un dibujo o avatar',
    no_face: 'una persona sin que se vea su cara', screenshot: 'una captura de pantalla', document: 'un documento',
    other: 'algo que no es tu cara ni un logo',
  },
  en: {
    house: 'a house', apartment: 'an apartment', building: 'a building', room: 'a room',
    land: 'a plot of land', property: 'a property', object: 'an object', animal: 'an animal', food: 'food',
    vehicle: 'a vehicle', landscape: 'a landscape', group: 'a group of people', drawing: 'a drawing or avatar',
    no_face: "a person whose face can't be seen", screenshot: 'a screenshot', document: 'a document',
    other: "something that isn't your face or a logo",
  },
  pt: {
    house: 'uma casa', apartment: 'um apartamento', building: 'um prédio', room: 'um cômodo',
    land: 'um terreno', property: 'um imóvel', object: 'um objeto', animal: 'um animal', food: 'comida',
    vehicle: 'um veículo', landscape: 'uma paisagem', group: 'um grupo de pessoas', drawing: 'um desenho ou avatar',
    no_face: 'uma pessoa sem que o rosto apareça', screenshot: 'uma captura de tela', document: 'um documento',
    other: 'algo que não é o seu rosto nem um logo',
  },
};
export const whatLabel = (what, lang = 'es') => {
  const L = WRONG_WHAT_LABEL[lang] || WRONG_WHAT_LABEL.es;
  return L[what] || L.other;
};

// The message shown when an upload is turned down (Roland's wording).
export function wrongPhotoMessage(what, lang = 'es') {
  const w = whatLabel(what, lang);
  if (lang === 'en') return `This image looks like a photo of ${w}. Upload your professional photo (your face) or your company logo.`;
  if (lang === 'pt') return `Esta imagem parece ser uma foto de ${w}. Envie sua foto profissional (seu rosto) ou o logo da sua empresa.`;
  return `Esta imagen parece ser una foto de ${w}. Subí tu foto profesional (tu cara) o el logo de tu empresa.`;
}

export const UPLOAD_KIND_PROMPT = `This is the profile picture a seller or real-estate agent wants to use on a property website. Buyers see it next to the seller's name. It must be a photo of the person OR the logo of their company.
Reply with exactly one line:
FACE if it is a photo of a real person and their face is visible (a selfie, headshot, portrait, half or full body photo; glasses, hats, uniforms, any background, any age; other people in the background are fine).
LOGO if it is mainly a logo, a brand mark, a company or agency name, text with a company name, a business card, a banner or a sign.
OTHER: <code> for anything else, where <code> is the one that fits best: house, apartment, building, room, land, property, object, animal, food, vehicle, landscape, group, drawing, no_face, screenshot, document, other
(group = several people and no single main person; drawing = a drawn, cartoon or AI avatar; no_face = a person whose face cannot be seen).
When unsure whether it is FACE or OTHER, reply FACE. When unsure whether it is LOGO or OTHER, reply LOGO.`;

// The model's answer → { kind: 'face'|'logo'|'other', what } | null (unclear → treated like an outage).
export function parseUploadKind(text) {
  const s = String(text || '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  const m = /\b(FACE|LOGO|OTHER)\b\s*[:\-–—]?\s*([a-z_]+)?/i.exec(s);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (kind !== 'other') return { kind, what: null };
  const code = String(m[2] || '').toLowerCase();
  return { kind, what: WRONG_WHAT.includes(code) ? code : 'other' };
}

// The upload's decision from the AI result ({ verdict: 'pass', kind, what } | { verdict: 'error' }).
//   → { action: 'accept', kind } (kind null = not known yet, labelled later) | { action: 'reject', what }
export function uploadDecision(v) {
  if (!v || v.verdict !== 'pass' || !PHOTO_KINDS.includes(v.kind)) return { action: 'accept', kind: null };
  if (v.kind === 'other') return { action: 'reject', what: WRONG_WHAT.includes(v.what) ? v.what : 'other' };
  return { action: 'accept', kind: v.kind };
}

// Re-cropping a photo that is already known to be a face / logo needs no new check.
export const knownGoodKind = (u = {}) => (kindIsCurrent(u) && (u.profile_photo_kind === 'face' || u.profile_photo_kind === 'logo') ? u.profile_photo_kind : null);

// What the account's photo is, for the automation:
//   'valid'   an approved photo the AI saw as their face or a logo
//   'unknown' the "?" photos: approved, but the AI saw neither (photos from before the upload check,
//             or uploaded while the AI was down) — treated like a turned-down upload
//   'pending' a photo still being checked, or approved but not labelled yet → wait
//   'none'    no photo
export function photoState(u = {}) {
  if (u.profile_photo_status === 'checking') return 'pending';
  if (u.profile_photo_url && u.profile_photo_key) {
    if (!kindIsCurrent(u)) return 'pending';
    return u.profile_photo_kind === 'other' ? 'unknown' : 'valid';
  }
  return 'none';
}

// The last turned-down upload, for the owner (Mi cuenta / the app) — only while nothing newer was
// uploaded since, and for 30 days. Needs migration 014 (profile_photo_rejected_*); else null.
export function lastRejected(row = {}, lang = 'es', now = Date.now(), maxAgeMs = 30 * 24 * 3600e3) {
  const at = Date.parse(row.profile_photo_rejected_at || '');
  if (!Number.isFinite(at) || now - at > maxAgeMs) return null;
  const since = Date.parse(row.profile_photo_updated_at || '');
  if (Number.isFinite(since) && since > at) return null;
  const what = row.profile_photo_rejected_what || 'other';
  return { at: new Date(at).toISOString(), what, label: whatLabel(what, lang), message: wrongPhotoMessage(what, lang), kept: !!row.profile_photo_url };
}
