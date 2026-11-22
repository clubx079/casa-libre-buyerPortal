// /api/account/profile-photo — the seller's profile photo (Mi cuenta → "Tu foto de perfil").
//   GET                  → the photo and its check status (lib/profilePhoto.js ownerView)
//   POST multipart photo → first the AI looks at it (≤12 s, lib/profilePhotoKind.js uploadDecision):
//                          neither a face nor a logo (a house, an apartment, an object…) →
//                          422 { error: 'wrong_photo', what, label, message } — NOTHING is saved,
//                          the current photo stays, the attempt is recorded for the follow-up
//                          emails (lib/automations/photoFace.js). AI down/slow → accepted.
//                          Then: upload or replace: saved at once as the pending photo
//                          ('checking'), checked by the AI in the background
//                          (lib/profilePhotoScan.js); the approved one keeps showing meanwhile
//   DELETE               → remove the photo (approved and pending) and its files
// ?lang=en for English reasons (stored reasons are Spanish).
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { update } from '@/lib/db';
import { MAX_PROFILE_PHOTO_BYTES, onUpload, onRemove, ownerView, isStale } from '@/lib/profilePhoto';
import { getPhotoRow, storeProfilePhoto, deletePhotoFiles, startProfilePhotoScan, photoChanged, checkUploadKind, recordRejectedUpload } from '@/lib/profilePhotoScan';
import { uploadDecision, knownGoodKind, whatLabel, wrongPhotoMessage } from '@/lib/profilePhotoKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const missingColumn = (e) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /profile_photo/.test(String(e.message || '')));
const langOf = (req) => { const l = new URL(req.url).searchParams.get('lang'); return l === 'en' || l === 'pt' ? l : 'es'; };

// A few uploads per person per 10 minutes (each one is an AI check).
const UPLOADS = new Map();
function tooMany(uid) {
  const now = Date.now();
  const recent = (UPLOADS.get(uid) || []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 8) { UPLOADS.set(uid, recent); return true; }
  recent.push(now); UPLOADS.set(uid, recent);
  return false;
}

async function loadRow(uid) {
  try { return { row: await getPhotoRow(uid) }; } catch (e) {
    return { error: missingColumn(e) ? 'not_set_up' : 'load_failed', status: missingColumn(e) ? 503 : 500 };
  }
}

export async function GET(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { row, error, status } = await loadRow(s.uid);
  if (error) return NextResponse.json({ error }, { status });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  // A check that seems stuck (AI error, server restarted mid-check) is nudged by the page's polling.
  if (isStale(row)) startProfilePhotoScan(s.uid);
  return NextResponse.json(ownerView(row, langOf(req)));
}

export async function POST(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'invalid_form' }, { status: 400 }); }
  const file = form.get('photo');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) return NextResponse.json({ error: 'missing_photo' }, { status: 400 });
  if (file.size > MAX_PROFILE_PHOTO_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  if (file.type && !/^image\//.test(file.type)) return NextResponse.json({ error: 'not_an_image' }, { status: 415 });

  const { row, error, status } = await loadRow(s.uid);
  if (error) return NextResponse.json({ error }, { status });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (tooMany(s.uid)) return NextResponse.json({ error: 'too_many' }, { status: 429 });

  const lang = langOf(req);
  const reuseKey = form.get('reuse') === '1' ? row.profile_photo_key || null : null;
  // Re-cropping a photo already known to be a face / logo needs no new look.
  let kind = reuseKey ? knownGoodKind(row) : null;
  if (!kind) {
    let bytes = null;
    try { bytes = Buffer.from(await file.arrayBuffer()); } catch { bytes = null; }
    const d = bytes ? uploadDecision(await checkUploadKind(s.uid, bytes)) : { action: 'accept', kind: null };
    if (d.action === 'reject') {
      await recordRejectedUpload(row, d.what);
      return NextResponse.json({
        ...ownerView(row, lang),
        error: 'wrong_photo', what: d.what, label: whatLabel(d.what, lang), message: wrongPhotoMessage(d.what, lang), kept: !!row.profile_photo_url,
      }, { status: 422 });
    }
    kind = d.kind;
  }

  let stored;
  const original = form.get('original');
  try {
    stored = await storeProfilePhoto(s.uid, file, {
      original: original && typeof original.arrayBuffer === 'function' && original.size <= MAX_PROFILE_PHOTO_BYTES ? original : null,
      reuseKey,
    });
  } catch (e) {
    if (e?.message === 'unreadable_image') return NextResponse.json({ error: 'unreadable_image' }, { status: 415 });
    console.error('[profile-photo] store', s.uid, e?.message || e);
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }
  const { patch, deleteKeys } = onUpload(row, stored);
  try {
    await update('users', `id=eq.${encodeURIComponent(s.uid)}`, patch, { returning: 'minimal' });
  } catch (e) {
    await deletePhotoFiles([stored.key]);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  await deletePhotoFiles(deleteKeys);
  startProfilePhotoScan(s.uid, stored.bytes, { kind });   // the seller doesn't wait; the page polls GET
  return NextResponse.json(ownerView({ ...row, ...patch }, lang));
}

export async function DELETE(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { row, error, status } = await loadRow(s.uid);
  if (error) return NextResponse.json({ error }, { status });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { patch, deleteKeys } = onRemove(row);
  try {
    await update('users', `id=eq.${encodeURIComponent(s.uid)}`, patch, { returning: 'minimal' });
  } catch {
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  await deletePhotoFiles(deleteKeys);
  if (row.profile_photo_url) photoChanged();
  return NextResponse.json(ownerView({ ...row, ...patch }, langOf(req)));
}
