// /api/account/listings/photos — "Fix photos" for a listing whose photos the AI check
// rejected (My listings → Rejected).
//   GET  ?id=<listing>  → its photos, in order, with the check's verdict on each
//   POST multipart { id, order, photos[] } → the new set of photos, in the seller's order:
//        order = [{ key: <storage_key of a photo it already has> } | { file: <index into photos[]> }]
//        Photos left out are deleted; new files are stored like at publish (mascot stamp).
//        The listing goes back to 'scanning' and is checked again in the background
//        (lib/listingScan.js) — the seller doesn't wait.
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSession } from '@/lib/auth';
import { select, insert, update, remove } from '@/lib/db';
import { put, remove as removeObject } from '@/lib/b2';
import { stampLogo } from '@/lib/stampLogo';
import { startListingScan, publishListing, releaseFromQuarantine } from '@/lib/listingScan';
import { SCAN_STATUS } from '@/lib/scanVerdict';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 20;

async function ownListing(session, id) {
  if (!id) return { error: 'missing_id', status: 400 };
  const [p] = await select('properties', `select=id,slug,status,created_by,raw_data,created_at,contact_name,property_type,neighborhood,city,listing_type&id=eq.${encodeURIComponent(id)}&limit=1`).catch(() => []);
  if (!p) return { error: 'not_found', status: 404 };
  if (String(p.created_by) !== String(session.uid)) return { error: 'forbidden', status: 403 };
  return { p };
}

export async function GET(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { p, error, status } = await ownListing(session, new URL(req.url).searchParams.get('id'));
  if (error) return NextResponse.json({ error }, { status });
  const imgs = await select('property_images', `select=storage_key,storage_url,position&property_id=eq.${encodeURIComponent(p.id)}&order=position.asc`).catch(() => []);
  const checked = new Map((p.raw_data?.moderation?.photos || []).map((x) => [x.url, x]));
  return NextResponse.json({
    status: p.status,
    photos: imgs.map((i) => ({ key: i.storage_key, url: i.storage_url, verdict: checked.get(i.storage_url)?.verdict || null, category: checked.get(i.storage_url)?.category || null })),
  });
}

export async function POST(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'invalid_form' }, { status: 400 }); }
  const { p, error, status } = await ownListing(session, String(form.get('id') || ''));
  if (error) return NextResponse.json({ error }, { status });
  if (p.status !== SCAN_STATUS.rejected) return NextResponse.json({ error: 'not_rejected' }, { status: 409 });

  const files = form.getAll('photos').filter((f) => f && typeof f.arrayBuffer === 'function' && f.size > 0);
  let order = [];
  try { order = JSON.parse(String(form.get('order') || '[]')); } catch { order = []; }
  if (!Array.isArray(order)) order = [];
  const current = await select('property_images', `select=storage_key,storage_url,content_type,bytes&property_id=eq.${encodeURIComponent(p.id)}`).catch(() => []);
  const byKey = new Map(current.map((i) => [i.storage_key, i]));

  // The new list: photos it already has (by storage key — only its own) and new files.
  const items = order.slice(0, MAX_PHOTOS).filter((o) => (o?.key && byKey.has(o.key)) || (Number.isInteger(o?.file) && files[o.file]));
  const originals = new Map();   // new photos as uploaded (no stamp) → the photo check reads these
  const stored = await Promise.all(items.map(async (o) => {
    if (o.key) return byKey.get(o.key);
    try {
      const f = files[o.file];
      const raw = Buffer.from(await f.arrayBuffer());
      let buf = raw, ct = f.type || 'image/jpeg', ext = (String(f.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      try { buf = await stampLogo(raw); ct = 'image/webp'; ext = 'webp'; } catch {}
      const s = await put(`user-uploads/${p.slug || p.id}/${crypto.randomUUID()}.${ext}`, buf, ct);
      originals.set(s.key, raw);
      return { storage_key: s.key, storage_url: s.url, content_type: s.contentType, bytes: s.bytes };
    } catch { return null; }
  }));
  const next = stored.filter(Boolean);
  if (items.some((o) => o.file != null) && next.length < items.length) return NextResponse.json({ error: 'upload_failed' }, { status: 502 });

  // Swap the photo rows, then delete the files that were left out.
  await remove('property_images', `property_id=eq.${encodeURIComponent(p.id)}`);
  if (next.length) {
    await insert('property_images', next.map((s, i) => ({
      property_id: p.id, source_url: s.storage_url, storage_key: s.storage_key, storage_url: s.storage_url,
      content_type: s.content_type, bytes: s.bytes, is_feature: i === 0, position: i,
    })), { returning: 'minimal' });
  }
  const keep = new Set(next.map((s) => s.storage_key));
  for (const old of current) if (old.storage_key && !keep.has(old.storage_key) && old.storage_key.startsWith('user-uploads/')) await removeObject(old.storage_key);

  // Back to the photo check. Its Quarantine record goes: the listing isn't rejected any more
  // (a new rejection files a fresh one).
  // previous: the last check's verdicts, so photos that passed then aren't checked again.
  const raw = { ...(p.raw_data || {}), moderation: { state: 'scanning', started_at: new Date().toISOString(), resubmitted: true, previous: p.raw_data?.moderation?.photos || [] } };
  await update('properties', `id=eq.${encodeURIComponent(p.id)}`, {
    status: SCAN_STATUS.scanning, admin_status: 'inactive', rejection_reason: null,
    feature_image_url: next[0]?.storage_url || null, raw_data: raw,
  }, { returning: 'minimal' });
  await releaseFromQuarantine(p.id).catch(() => {});
  if (next.length) startListingScan(p.id, originals);
  else await publishListing({ ...p, raw_data: raw }, { state: 'passed', checked_at: new Date().toISOString(), photos: 0 }).catch(() => {});
  return NextResponse.json({ ok: true, photos: next.length, scanning: next.length > 0 });
}
