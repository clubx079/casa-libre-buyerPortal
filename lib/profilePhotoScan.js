// Seller profile photo — storage + the AI check (the state rules are in lib/profilePhoto.js).
//   storeProfilePhoto  shrink the upload (≤800px JPEG, no watermark: a face or a logo) and put it
//                      in the listing-photo bucket under avatars/<uid>/<random>.jpg
//   scanProfilePhoto   Groq vision (lib/imageScan.js scanProfileImage, same model as listing
//                      photos), counted in the same daily quota / api_usage_log; approve or
//                      reject the pending photo, delete the file it replaces, tell the seller
//   scanPendingProfilePhotos  the hourly retry (/api/cron/image-scan) for photos still
//                      'checking' (AI error, quota used up, server restarted mid-check)
import 'server-only';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { select, update, insert, remove } from './db';
import { put, getBytes, remove as removeObject } from './b2';
import { scanProfileImage } from './imageScan';
import { COLUMNS, PHOTO_STATUS, avatarKeyFor, origKeyOf, onVerdict } from './profilePhoto';
import { dailyQuota, usedToday, fitsQuota, logScans } from './scanQuota';
import { maybeSendQuotaAlert } from './scanAlert';
import { sendProfilePhotoResultEmail, sendScanQuotaAlertEmail } from './email';
import { COUNTRY } from './country';
import { invalidateSellerPhotos } from './sellerPhotos';

const running = new Set();   // user ids being checked in this process
const ROW = `id,email,full_name,${COLUMNS.join(',')}`;
const enc = encodeURIComponent;

export async function getPhotoRow(uid) {
  const [row] = await select('users', `select=${ROW}&id=eq.${enc(uid)}&limit=1`);
  return row || null;
}

// The uploaded File → a ≤800px JPEG (EXIF rotation applied, metadata dropped) in B2.
// Throws 'unreadable_image' when it isn't an image sharp can read.
// original: the full picture the crop came from (a File), or reuseKey: the current photo's key
// when the seller only re-cropped it (its original is copied to the new name). Best effort: the
// photo itself never fails because of the original.
export async function storeProfilePhoto(uid, file, { original = null, reuseKey = null } = {}) {
  const raw = Buffer.from(await file.arrayBuffer());
  let buf;
  try {
    buf = await sharp(raw, { failOn: 'none' }).rotate()
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch {
    throw new Error('unreadable_image');
  }
  const stored = await put(avatarKeyFor(uid, crypto.randomUUID()), buf, 'image/jpeg');
  try {
    let orig = null;
    if (original && typeof original.arrayBuffer === 'function' && original.size) {
      orig = await sharp(Buffer.from(await original.arrayBuffer()), { failOn: 'none' }).rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } else if (reuseKey && origKeyOf(reuseKey)) {
      try { orig = await getBytes(origKeyOf(reuseKey)); } catch { orig = null; }
    }
    if (orig) await put(origKeyOf(stored.key), orig, 'image/jpeg');
  } catch (e) { console.error('[profile-photo] original', uid, e?.message || e); }
  return { key: stored.key, url: stored.url, bytes: buf };
}

// Each photo goes with its '-orig' full picture (missing for older uploads: ignored).
export const deletePhotoFiles = (keys) => Promise.all((keys || []).filter(Boolean)
  .flatMap((k) => [k, origKeyOf(k)]).filter(Boolean)
  .map((k) => removeObject(k).catch(() => null)));

// The approved photo changed → listings show the new one (or none). Photos are attached after
// the listing caches (lib/sellerPhotos.js), so only the 30 s photo map is dropped (other server
// processes pick it up within 30 s); the listing caches are left alone.
export function photoChanged() {
  invalidateSellerPhotos();
}

// Fire-and-forget from a request (the upload already answered 'checking').
export function startProfilePhotoScan(uid, bytes = null) {
  scanProfilePhoto(uid, bytes).catch((e) => console.error('[profile-photo-scan]', uid, e?.message || e));
}

// Check the account's pending photo. Returns 'approved' | 'rejected' | 'retry' | 'queued' | 'skipped'.
export async function scanProfilePhoto(uid, bytes = null, { email = true } = {}) {
  if (!uid || running.has(uid)) return 'skipped';
  running.add(uid);
  try {
    const row = await getPhotoRow(uid);
    if (!row || row.profile_photo_status !== PHOTO_STATUS.checking || !row.profile_photo_pending_key) return 'skipped';
    const key = row.profile_photo_pending_key;
    // Only update the row if it still holds THIS photo (a replacement mid-check wins).
    const sameRow = `id=eq.${enc(uid)}&profile_photo_pending_key=eq.${enc(key)}&profile_photo_status=eq.${PHOTO_STATUS.checking}`;

    // Same daily quota as listing photos (lib/scanQuota.js): over it → wait for the cron.
    let used = 0;
    try { used = await usedToday(select, COUNTRY.code); } catch { used = 0; }
    if (!fitsQuota(used, 1, dailyQuota())) {
      maybeSendQuotaAlert({ db: { select, insert, update, remove }, send: sendScanQuotaAlertEmail, countryCode: COUNTRY.code, countryName: COUNTRY.name, used, quota: dailyQuota() }).catch(() => {});
      await update('users', sameRow, { profile_photo_error: 'queued: daily AI check quota reached' }, { returning: 'minimal' }).catch(() => {});
      return 'queued';
    }

    if (!bytes) { try { bytes = await getBytes(key); } catch { bytes = null; } }
    if (!bytes && row.profile_photo_pending_url) {
      try { const r = await fetch(row.profile_photo_pending_url, { cache: 'no-store' }); if (r.ok) bytes = Buffer.from(await r.arrayBuffer()); } catch {}
    }
    const v = bytes ? await scanProfileImage(bytes, { ref: `user:${uid}` }) : { verdict: 'error', error: 'photo_unavailable' };
    // Count the check when the model was actually asked (as listing photos do).
    if (!(v.verdict === 'error' && /^(no_groq_key|unreadable_image|photo_unavailable)/.test(v.error || ''))) {
      await logScans(insert, 1, uid, { source: 'profile_photo_check', codePath: 'lib/profilePhotoScan.js' });
    }

    const { outcome, patch, deleteKeys } = onVerdict(row, v);
    if (outcome === 'skipped' || !patch) return 'skipped';
    const res = await update('users', sameRow, patch, { returning: 'representation' });
    if (!Array.isArray(res) || !res.length) return 'skipped';   // replaced/removed meanwhile
    if (outcome === 'retry') return 'retry';

    await deletePhotoFiles(deleteKeys);
    if (outcome === PHOTO_STATUS.approved) photoChanged();
    if (email && row.email && !/@deleted\.invalid$/.test(row.email)) {
      await sendProfilePhotoResultEmail(row.email, { name: row.full_name, approved: outcome === PHOTO_STATUS.approved, reason: patch.profile_photo_reason }).catch(() => {});
    }
    return outcome;
  } finally {
    running.delete(uid);
  }
}

// The hourly retry, oldest first; stops when today's quota is used up.
export async function scanPendingProfilePhotos(limit = 30) {
  const out = { checked: 0, approved: 0, rejected: 0, retry: 0, queued: 0 };
  let rows = [];
  try {
    rows = await select('users', `select=id&profile_photo_status=eq.${PHOTO_STATUS.checking}&order=profile_photo_updated_at.asc&limit=${limit}`);
  } catch { return out; }   // columns missing (migration 021 not applied) → nothing to do
  for (const r of rows) {
    const o = await scanProfilePhoto(r.id);
    if (o === 'skipped') continue;
    if (o === 'queued') { out.queued = rows.length - out.checked; break; }
    out.checked++; out[o]++;
  }
  return out;
}
