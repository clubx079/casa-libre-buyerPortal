// Photos of sell-wizard drafts. Each one is uploaded as soon as it's added, stored
// under drafts/<owner>/<draft id>/<random>.webp (owner = account id, or a guest's
// email-derived id — lib/guestDrafts.js) and listed in the draft, so any device that
// opens the draft shows them and publishing reuses them. Deleted when the photo is
// removed, the draft is deleted or published, or (cron) the draft sits untouched for
// 30 days. Server-only.
import 'server-only';
import crypto from 'node:crypto';
import { put, remove, getBytes } from './b2';
import { guestOwnerId } from './guestDrafts';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const STALE_DAYS = 30;

// The draft folders a signed-in user may publish photos from: their own, and the
// guest folder of their email (drafts saved before they signed in).
export const ownerFolders = (session) => [`drafts/${session.uid}/`, ...(session.email ? [`drafts/${guestOwnerId(session.email)}/`] : [])];

// Shrink to ≤2000px WebP (best-effort; the original bytes if sharp isn't available).
async function compact(raw, type) {
  try {
    const mod = await import('sharp');
    const sharp = mod.default || mod;
    const buf = await sharp(raw).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return { buf, ext: 'webp', ct: 'image/webp' };
  } catch {
    return { buf: raw, ext: type === 'image/png' ? 'png' : 'jpg', ct: type || 'image/jpeg' };
  }
}

// Store one uploaded File for a draft → { key, url }.
export async function storeDraftPhoto(owner, draftId, file) {
  const { buf, ext, ct } = await compact(Buffer.from(await file.arrayBuffer()), file.type);
  const stored = await put(`drafts/${owner}/${draftId}/${crypto.randomUUID()}.${ext}`, buf, ct);
  return { key: stored.key, url: stored.url };
}

export const draftPhotoBytes = (key) => getBytes(key);
export const removeDraftPhotos = (keys) => Promise.all((keys || []).map((k) => remove(k)));
