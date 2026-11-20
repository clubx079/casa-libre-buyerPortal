// Decide what an approved profile photo shows (face / logo / other — lib/profilePhotoKind.js) and
// keep it on the users row. Server-only.
//   classifyUserPhoto(row, bytes?)  one account: the CURRENT approved photo → profile_photo_kind,
//                                   _kind_key (that photo's key), _kind_at. Returns the kind or null.
//   classifyMissingKinds(limit)     the accounts whose current photo has no kind yet (photos
//                                   approved before this existed, or a check that failed) — run by
//                                   the automation before it picks who to email.
// Called right after a photo is approved (lib/profilePhotoScan.js) and by the automation.
// Same daily AI quota as the photo checks (lib/scanQuota.js). Without the columns (migration 013
// not applied) every call just returns null.
import 'server-only';
import { select, update, insert } from './db';
import { getBytes } from './b2';
import { classifyProfileImage } from './imageScan';
import { kindIsCurrent, hasApprovedPhoto } from './profilePhotoKind';
import { dailyQuota, usedToday, fitsQuota, logScans } from './scanQuota';
import { COUNTRY } from './country';

const enc = encodeURIComponent;
export const KIND_COLS = 'id,profile_photo_url,profile_photo_key,profile_photo_status,profile_photo_kind,profile_photo_kind_key';

export async function classifyUserPhoto(row, bytes = null) {
  if (!hasApprovedPhoto(row)) return null;
  const key = row.profile_photo_key;
  try {
    const used = await usedToday(select, COUNTRY.code).catch(() => 0);
    if (!fitsQuota(used, 1, dailyQuota())) return null;
    if (!bytes) { try { bytes = await getBytes(key); } catch { bytes = null; } }
    if (!bytes) {
      try { const r = await fetch(row.profile_photo_url, { cache: 'no-store' }); if (r.ok) bytes = Buffer.from(await r.arrayBuffer()); } catch { bytes = null; }
    }
    if (!bytes) return null;
    const v = await classifyProfileImage(bytes, { ref: `user:${row.id}` });
    await logScans(insert, 1, row.id, { source: 'profile_photo_kind', codePath: 'lib/profilePhotoKindScan.js' }).catch(() => {});
    if (v.verdict !== 'pass') return null;
    // only if the account still has THIS photo
    await update('users', `id=eq.${enc(row.id)}&profile_photo_key=eq.${enc(key)}`,
      { profile_photo_kind: v.kind, profile_photo_kind_key: key, profile_photo_kind_at: new Date().toISOString() }, { returning: 'minimal' });
    return v.kind;
  } catch (e) {
    console.error('[profile-photo-kind]', row.id, e?.message || e);
    return null;
  }
}

export async function classifyMissingKinds(limit = 20) {
  const out = { checked: 0, face: 0, logo: 0, other: 0, failed: 0 };
  let rows = [];
  try {
    rows = await select('users', `select=${KIND_COLS}&profile_photo_status=eq.approved&profile_photo_key=not.is.null&order=profile_photo_updated_at.desc&limit=2000`);
  } catch { return { ...out, skippedReason: 'not_set_up' }; }   // migration 013 not applied
  for (const r of rows.filter((x) => !kindIsCurrent(x)).slice(0, limit)) {
    out.checked++;
    const k = await classifyUserPhoto(r);
    if (k) out[k]++; else out.failed++;
  }
  return out;
}
