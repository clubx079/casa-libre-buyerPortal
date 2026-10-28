// /api/account/listings/edit — a seller edits a listing they published (My listings → Editar).
//   GET  ?id=<listing>   → the listing as form values + its photos, and whether it can be edited
//   POST multipart       → the same fields as /api/publish + id + photo_order
//                          (order = [{ k: <storage_key it already has> } | { f: <index into photos[]> }])
// Every check of a new listing runs again (lib/listingFields.js): type, street address,
// price + floors, area range, rooms; a CHANGED WhatsApp must be proven with a code. Then:
//   • new photos → stamped like at publish, and the listing goes back through the AI photo
//     check (lib/listingScan.js; photos that passed before aren't checked again) — it is off
//     the site meanwhile and goes live again when they pass, or to Rejected if one fails;
//   • the same property twice (the seller's OTHER listings, lib/duplicateCheck.js) → held;
//   • a changed address → a new map pin, zone and dedupe key, and the zoning is looked up again;
//   • a changed price → previous_price / price_changed_at (the "price dropped" history).
// Not editable: a listing an admin took down, held as a duplicate, waiting for payment,
// or still being checked. An edit never counts as a new listing for the monthly quota.
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import * as dbApi from '@/lib/db';
import { put, getBytes, remove as removeObject } from '@/lib/b2';
import { stampLogo } from '@/lib/stampLogo';
import { readListingFields } from '@/lib/listingFields';
import { listingE164 } from '@/lib/listingPhone';
import { geocode } from '@/lib/geocodeListing';
import { zoneCanonical, dedupeKey } from '@/lib/dedupe';
import { PROPERTY_TYPES } from '@/lib/propertyTypeOptions';
import { startListingScan, holdInQuarantine, releaseFromQuarantine } from '@/lib/listingScan';
import { SCAN_STATUS } from '@/lib/scanVerdict';
import { findDuplicateOf, DUPLICATE_STATUS } from '@/lib/duplicateCheck';
import { dHash } from '@/lib/photoHash';
import { COUNTRY } from '@/lib/country';
import { lockReason } from '@/lib/listingEdit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 20;
const enc = encodeURIComponent;
const fail = (error, status = 400) => NextResponse.json({ error }, { status });

async function ownListing(session, id) {
  if (!id) return { error: 'missing_id', status: 400 };
  const [p] = await dbApi.select('properties', `select=*&id=eq.${enc(id)}&limit=1`).catch(() => []);
  if (!p) return { error: 'not_found', status: 404 };
  if (String(p.created_by) !== String(session.uid) || p.origin !== 'user') return { error: 'forbidden', status: 403 };
  return { p };
}

const typeKey = (db) => (PROPERTY_TYPES.find((t) => t.db.toLowerCase() === String(db || '').toLowerCase()) || {}).key || '';

export async function GET(req) {
  const session = getSession();
  if (!session) return fail('unauthorized', 401);
  const { p, error, status } = await ownListing(session, new URL(req.url).searchParams.get('id'));
  if (error) return fail(error, status);
  const imgs = await dbApi.select('property_images', `select=storage_key,storage_url,position&property_id=eq.${enc(p.id)}&order=position.asc`).catch(() => []);
  const entered = p.raw_data?.entered_price;   // Venezuela: what the seller typed in bolívares
  return NextResponse.json({
    ok: true, id: p.id, lock: lockReason(p),
    fields: {
      mode: p.listing_type === 'rent' ? 'alquiler' : 'venta',
      seller_type: p.seller_type === 'agent' ? 'agent' : 'owner',
      ptype: typeKey(p.property_type),
      street: p.address && p.address !== p.neighborhood ? p.address : '',
      addressText: [p.address && p.address !== p.neighborhood ? p.address : '', p.city].filter(Boolean).join(', '),
      neighborhood: p.neighborhood || '', city: p.city || '',
      lat: p.latitude ?? '', lng: p.longitude ?? '',
      price: String(entered?.price ?? p.price ?? ''), currency: entered?.currency || p.currency || '',
      area: String(p.covered_area ?? p.land_area ?? ''),
      bedrooms: p.bedrooms ?? '', bathrooms: p.bathrooms ?? '',
      description: p.description || '', contact_name: p.contact_name || '', contact_phone: p.contact_phone || '',
    },
    photos: imgs.map((i) => ({ key: i.storage_key, url: i.storage_url })),
    // its paid plan while active — the form offers only what it doesn't have yet
    promo: p.promotion_plan && p.promotion_expires_at && Date.parse(p.promotion_expires_at) > Date.now() ? { plan: p.promotion_plan, until: p.promotion_expires_at } : null,
  });
}

export async function POST(req) {
  const session = getSession();
  if (!session) return fail('unauthorized', 401);
  let form;
  try { form = await req.formData(); } catch { return fail('invalid_form'); }
  const get = (k) => { const v = form.get(k); return v == null ? '' : String(v).trim(); };
  const { p, error, status } = await ownListing(session, get('id'));
  if (error) return fail(error, status);
  const lock = lockReason(p);
  if (lock) return fail(lock, 409);

  // Same fields and checks as publishing. The WhatsApp needs a code only when it changed.
  const oldPhone = listingE164(p.contact_phone, COUNTRY.phonePrefix);
  const fields = await readListingFields(get, session, { requireProof: (phone) => listingE164(phone, COUNTRY.phonePrefix) !== oldPhone });
  if (fields.error) return fail(fields.error, fields.status);
  const v = fields.v;

  // ── photos: the ones it keeps (its own keys) + new files, in the seller's order ──
  const files = form.getAll('photos').filter((f) => f && typeof f.arrayBuffer === 'function' && f.size > 0);
  let order = [];
  try { order = JSON.parse(get('photo_order') || '[]'); } catch { order = []; }
  if (!Array.isArray(order)) order = [];
  const current = await dbApi.select('property_images', `select=storage_key,storage_url,content_type,bytes,position&property_id=eq.${enc(p.id)}&order=position.asc`).catch(() => []);
  const byKey = new Map(current.map((i) => [i.storage_key, i]));
  const items = order.slice(0, MAX_PHOTOS).filter((o) => (o?.k && byKey.has(o.k)) || (Number.isInteger(o?.f) && files[o.f]));
  if (!items.length) return fail('missing_photos');
  const originals = new Map();   // new photos as uploaded (no stamp) → the photo check reads these
  const stored = await Promise.all(items.map(async (o) => {
    if (o.k) return { ...byKey.get(o.k), isNew: false };
    try {
      const f = files[o.f];
      const raw = Buffer.from(await f.arrayBuffer());
      let buf = raw, ct = f.type || 'image/jpeg', ext = (String(f.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      try { buf = await stampLogo(raw); ct = 'image/webp'; ext = 'webp'; } catch {}
      const s = await put(`user-uploads/${p.slug || p.id}/${crypto.randomUUID()}.${ext}`, buf, ct);
      originals.set(s.key, raw);
      return { storage_key: s.key, storage_url: s.url, content_type: s.contentType, bytes: s.bytes, isNew: true, raw };
    } catch { return null; }
  }));
  const next = stored.filter(Boolean);
  if (next.length < items.length) return fail('upload_failed', 502);
  const newPhotos = next.filter((s) => s.isNew).length;

  // ── the listing's new values ──
  const listing_type = v.mode === 'alquiler' ? 'rent' : 'sale';
  const area = v.isLand ? { land_area: v.area, covered_area: null } : { covered_area: v.area, land_area: null };
  const address = v.street || v.neighborhood;
  const moved = address !== p.address || v.neighborhood !== p.neighborhood || v.city !== p.city
    || (v.coords && (Number(v.coords.lat) !== Number(p.latitude) || Number(v.coords.lng) !== Number(p.longitude)));
  const coords = !moved ? null : v.coords || await geocode(v.neighborhood, v.city, v.street).catch(() => null);
  const priceChanged = Number(v.price) !== Number(p.price) || v.currency !== p.currency;
  const changes = {
    property_type: v.property_type, listing_type, price: v.price, currency: v.currency, price_usd: v.price_usd,
    price_period: listing_type === 'rent' ? 'monthly' : null,
    address, neighborhood: v.neighborhood, city: v.city, ...area, bedrooms: v.bedrooms, bathrooms: v.bathrooms,
    description: v.description || null, contact_name: v.contactName, contact_phone: v.contactPhone, seller_type: v.sellerType,
    ...(moved ? { latitude: coords ? coords.lat : null, longitude: coords ? coords.lng : null,
      zoning_code: null, zoning_category: null, zoning_max_floors: null, zoning_checked_at: null } : {}),   // zoning looked up again (hourly cron)
    ...(priceChanged ? { previous_price: p.price, price_changed_at: new Date().toISOString() } : {}),
    feature_image_url: next[0]?.storage_url || null,
    updated_at: new Date().toISOString(),
  };
  const merged = { ...p, ...changes };
  const zc = zoneCanonical(merged);
  changes.zone_canonical = zc;
  changes.dedupe_key = dedupeKey(merged, zc);

  // ── the same property twice? (against the seller's OTHER listings) ──
  const hashes = await Promise.all(next.map(async (s) => { try { return await dHash(s.raw || await getBytes(s.storage_key)); } catch { return null; } }));
  const [dupAuto] = await dbApi.select('automations', 'select=id,enabled&id=eq.duplicate_listings&limit=1').catch(() => []);
  const others = (t, q) => dbApi.select(t, q).then((rows) => (t === 'properties' ? rows.filter((r) => r.id !== p.id) : rows));
  const dup = dupAuto?.enabled ? await findDuplicateOf({
    select: others, uid: session.uid, newHashes: hashes, newRow: { ...merged },
    photoHashesOf: async (o) => {
      if (Array.isArray(o.raw_data?.photo_hashes) && o.raw_data.photo_hashes.length) return o.raw_data.photo_hashes;
      const imgs = await dbApi.select('property_images', `select=storage_key&property_id=eq.${enc(o.id)}&order=position.asc&limit=20`);
      return Promise.all(imgs.map(async (im) => { try { return await dHash(await getBytes(im.storage_key)); } catch { return null; } }));
    },
  }).catch(() => null) : null;

  // ── what happens to it: held / photo check / stays as it is ──
  const now = new Date().toISOString();
  const editLog = [...(p.raw_data?.edits || []), { at: now, fields: Object.keys(changes).filter((k) => JSON.stringify(changes[k]) !== JSON.stringify(p[k]) && !['updated_at', 'zone_canonical', 'dedupe_key', 'feature_image_url'].includes(k)), new_photos: newPhotos, removed_photos: current.length - (next.length - newPhotos) }].slice(-20);
  const raw = { ...(p.raw_data || {}), edits: editLog, photo_hashes: hashes.filter(Boolean) };
  let outcome = 'saved';
  if (dup) {
    outcome = 'duplicate';
    Object.assign(changes, { status: DUPLICATE_STATUS, admin_status: 'inactive' });
    raw.duplicate_of = dup.id;
    raw.moderation = { ...(p.raw_data?.moderation || {}), state: 'duplicate', duplicate_of: dup.id, same_photos: `${dup.matched}/${dup.total}` };
  } else if (newPhotos > 0 || p.status === SCAN_STATUS.rejected) {
    // back through the AI photo check; photos that passed before aren't checked again
    outcome = 'checking';
    Object.assign(changes, { status: SCAN_STATUS.scanning, admin_status: 'inactive', rejection_reason: null });
    raw.moderation = { state: 'scanning', started_at: now, resubmitted: true, previous: p.raw_data?.moderation?.photos || [] };
  }
  changes.raw_data = raw;

  // swap the photo rows, then delete the files that were left out
  await dbApi.remove('property_images', `property_id=eq.${enc(p.id)}`);
  await dbApi.insert('property_images', next.map((s, i) => ({
    property_id: p.id, source_url: s.storage_url, storage_key: s.storage_key, storage_url: s.storage_url,
    content_type: s.content_type, bytes: s.bytes, is_feature: i === 0, position: i,
  })), { returning: 'minimal' });
  const keep = new Set(next.map((s) => s.storage_key));
  for (const old of current) if (old.storage_key && !keep.has(old.storage_key) && old.storage_key.startsWith('user-uploads/')) await removeObject(old.storage_key).catch(() => {});

  await dbApi.update('properties', `id=eq.${enc(p.id)}`, changes, { returning: 'minimal' });
  if (outcome === 'duplicate') await holdInQuarantine({ ...p, ...changes }, [], 'duplicate', { duplicate_of: dup.id }).catch(() => {});
  if (outcome === 'checking') { await releaseFromQuarantine(p.id).catch(() => {}); startListingScan(p.id, originals); }
  try { revalidateTag('listings'); } catch {}
  return NextResponse.json({ ok: true, id: p.id, outcome, newPhotos });
}
