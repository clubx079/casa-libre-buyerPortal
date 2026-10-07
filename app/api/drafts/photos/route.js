// Photos of a sell-wizard draft (lib/draftPhotos.js):
// POST   /api/drafts/photos   multipart { photo, draft_id [, email, key] } → { photo, photos }
// DELETE /api/drafts/photos?draft_id=…&photo=<key> [&email&key]           → { photos }
// The draft must be the signed-in user's, or — not signed in — the guest draft of that
// email made by this browser (key). These endpoints are the only writers of a draft's
// photo list. Light per-IP limit.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { getDraftRow, setDraftPhotos, cleanDraftPhotos, MAX_DRAFT_PHOTOS } from '@/lib/drafts';
import { guestOwnerId, claimGuestDrafts } from '@/lib/guestDrafts';
import { storeDraftPhoto, removeDraftPhotos, MAX_PHOTO_BYTES } from '@/lib/draftPhotos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 10 * 60 * 1000;
const MAX = 120;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) { hits.set(ip, { start: now, n: 1 }); return false; }
  h.n += 1;
  return h.n > MAX;
}
const ipOf = (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

// → { owner, row } for the draft this request may change, or null.
async function ownedDraft(draftId, guest) {
  const s = getSession();
  if (s) {
    await claimGuestDrafts(db, s.email, s.uid).catch(() => {});
    const row = await getDraftRow(db, s.uid, draftId);
    return row ? { owner: s.uid, row } : null;
  }
  const owner = guestOwnerId(guest.email);
  const row = await getDraftRow(db, owner, draftId);
  return row && guest.key && row.data?._guest_key === guest.key ? { owner, row } : null;
}

export async function POST(req) {
  if (limited(ipOf(req))) return bad('rate_limited', 429);
  let form;
  try { form = await req.formData(); } catch { return bad('invalid_form'); }
  const file = form.get('photo');
  if (!file || typeof file.arrayBuffer !== 'function' || !String(file.type || '').startsWith('image/') || !(file.size > 0) || file.size > MAX_PHOTO_BYTES) return bad('bad_photo');
  try {
    const own = await ownedDraft(String(form.get('draft_id') || ''), { email: String(form.get('email') || ''), key: String(form.get('key') || '') });
    if (!own) return bad('not_found', 404);
    const current = cleanDraftPhotos(own.row.data?.photos);
    if (current.length >= MAX_DRAFT_PHOTOS) return bad('too_many');
    const photo = await storeDraftPhoto(own.owner, own.row.id, file);
    const photos = await setDraftPhotos(db, own.owner, own.row, [...current, photo]);
    return NextResponse.json({ photo, photos });
  } catch {
    return bad('upload_failed', 502);
  }
}

export async function DELETE(req) {
  if (limited(ipOf(req))) return bad('rate_limited', 429);
  const q = new URL(req.url).searchParams;
  try {
    const own = await ownedDraft(q.get('draft_id') || '', { email: q.get('email') || '', key: q.get('key') || '' });
    if (!own) return bad('not_found', 404);
    const key = q.get('photo') || '';
    const current = cleanDraftPhotos(own.row.data?.photos);
    if (!current.some((p) => p.key === key)) return NextResponse.json({ photos: current });
    const photos = await setDraftPhotos(db, own.owner, own.row, current.filter((p) => p.key !== key));
    await removeDraftPhotos([key]);
    return NextResponse.json({ photos });
  } catch {
    return bad('delete_failed', 502);
  }
}
