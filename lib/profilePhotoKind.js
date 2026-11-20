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
export const kindIsCurrent = (u = {}) => !!u.profile_photo_key && !!u.profile_photo_kind && u.profile_photo_kind_key === u.profile_photo_key;

// An approved photo that is not a real photo of the person → the automation's audience.
export const hasApprovedPhoto = (u = {}) => u.profile_photo_status === 'approved' && !!u.profile_photo_url && !!u.profile_photo_key;
export const needsFace = (u = {}) => hasApprovedPhoto(u) && kindIsCurrent(u) && u.profile_photo_kind !== 'face';
