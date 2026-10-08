// The AI photo check of a user listing, after the sell wizard publishes it. The wizard
// never waits: /api/publish saves the listing as status 'scanning' (admin_status
// 'inactive' — not on the site), answers, and starts this in the background.
//   • every photo passes        → published: live on the site, "your listing is live" email
//   • any photo fails           → rejected: stays off the site, shows in My listings →
//                                 Rejected, and is held in the admin Quarantine (Blocked,
//                                 "Images rejected") where an admin can approve it anyway
//   • a photo couldn't be checked (AI down, no key…) → stays 'scanning'; the hourly cron
//                                 (/api/cron/image-scan) asks again — never let through
// Details live in raw_data.moderation { state, attempts, last_error, photos[] }.
import 'server-only';
import { revalidateTag } from 'next/cache';
import { select, update, insert, remove } from './db';
import { getBytes } from './b2';
import { scanImage } from './imageScan';
import { SCAN_STATUS, IMAGES_REJECTED, scanOutcome } from './scanVerdict';
import { getUserSubmissionsSourceId } from './quarantine';
import { sendListingPublishedEmail } from './email';
import { submitToIndexNow } from './indexnow';
import { COUNTRY } from './country';

const SITE = () => (process.env.APP_PUBLIC_URL || COUNTRY.defaultUrl).replace(/\/$/, '');
const COLS = 'id,slug,status,admin_status,raw_data,created_by,created_at,listing_type,property_type,address,neighborhood,city,country,contact_name,contact_phone,feature_image_url';
const running = new Set();   // listing ids being checked in this process (publish + cron can overlap)

// The public reference shown to the seller (same formula /api/publish uses).
export const listingRef = (id, createdAt) =>
  `CL-${new Date(createdAt || Date.now()).getFullYear()}-${String(id || '').replace(/\D/g, '').slice(-5).padStart(5, '0') || '00000'}`;

const quarantineKey = (id) => `listing:${id}`;

// Fire-and-forget from a request: the caller has already answered. originals = the photos
// as uploaded, before the mascot stamp (Map storage_key → Buffer), while we still have them.
export function startListingScan(id, originals = null) {
  scanListing(id, originals).catch((e) => console.error('[image-scan]', id, e?.message || e));
}

// Check one listing's photos and publish / reject / leave it for a retry. Returns the
// outcome ('published' | 'rejected' | 'retry' | 'skipped'). Each photo is checked as
// uploaded when the caller still has it (originals), else the stored, stamped copy. Photos
// that passed before (kept on "Fix photos": moderation.previous) aren't checked again.
export async function scanListing(id, originals = null) {
  if (!id || running.has(id)) return 'skipped';
  running.add(id);
  try {
    const [p] = await select('properties', `select=${COLS}&id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!p || p.status !== SCAN_STATUS.scanning) return 'skipped';
    const images = await select('property_images', `select=storage_key,storage_url,position&property_id=eq.${encodeURIComponent(id)}&order=position.asc`);

    const passedBefore = new Set((p.raw_data?.moderation?.previous || []).filter((x) => x.verdict === 'pass').map((x) => x.url));

    // A few photos at a time: quick for the seller, gentle on the AI's rate limits.
    const results = new Array(images.length);
    for (let i = 0; i < images.length; i += 3) {
      await Promise.all(images.slice(i, i + 3).map(async (img, k) => {
        const at = { position: img.position, url: img.storage_url || null };
        if (img.storage_url && passedBefore.has(img.storage_url)) { results[i + k] = { ...at, verdict: 'pass' }; return; }
        const original = originals?.get(img.storage_key) || null;
        let bytes = original;
        if (!bytes) { try { bytes = img.storage_key ? await getBytes(img.storage_key) : null; } catch {} }
        if (!bytes && img.storage_url) {
          try { const r = await fetch(img.storage_url, { cache: 'no-store' }); if (r.ok) bytes = Buffer.from(await r.arrayBuffer()); } catch {}
        }
        const v = bytes ? await scanImage(bytes, { stamped: !original }) : { verdict: 'error', error: 'photo_unavailable' };
        results[i + k] = { ...at, ...v };
      }));
    }

    const outcome = scanOutcome(results);
    const prev = p.raw_data?.moderation || {};
    const now = new Date().toISOString();
    const photos = results.map(({ position, url, verdict, category }) => ({ position, url, verdict, ...(category ? { category } : {}) }));

    if (outcome === 'retry') {
      const errs = [...new Set(results.filter((r) => r.verdict === 'error').map((r) => r.error))].join('; ').slice(0, 300);
      await update('properties', `id=eq.${encodeURIComponent(id)}&status=eq.${SCAN_STATUS.scanning}`, {
        raw_data: { ...(p.raw_data || {}), moderation: { ...prev, state: 'scanning', attempts: (prev.attempts || 0) + 1, last_error: errs, last_try_at: now, photos } },
      }, { returning: 'minimal' });
      return 'retry';
    }
    if (outcome === 'rejected') {
      await update('properties', `id=eq.${encodeURIComponent(id)}&status=eq.${SCAN_STATUS.scanning}`, {
        status: SCAN_STATUS.rejected,
        admin_status: 'inactive',
        rejection_reason: IMAGES_REJECTED,
        raw_data: { ...(p.raw_data || {}), moderation: { state: 'rejected', checked_at: now, attempts: (prev.attempts || 0) + 1, photos } },
      }, { returning: 'minimal' });
      await holdInQuarantine(p, photos.filter((x) => x.verdict === 'fail')).catch((e) => console.error('[image-scan] quarantine', id, e?.message || e));
      return 'rejected';
    }
    await publishListing(p, { state: 'passed', checked_at: now, attempts: (prev.attempts || 0) + 1 });
    return 'published';
  } finally {
    running.delete(id);
  }
}

// Make a checked listing live: on the site, out of the Quarantine, "your listing is live"
// email, search engines pinged. Also used for a listing with no photos (nothing to check).
export async function publishListing(p, moderation) {
  const id = p.id;
  await update('properties', `id=eq.${encodeURIComponent(id)}&status=eq.${SCAN_STATUS.scanning}`, {
    status: SCAN_STATUS.published,
    admin_status: 'active',
    rejection_reason: null,
    raw_data: { ...(p.raw_data || {}), moderation },
  }, { returning: 'minimal' });
  await releaseFromQuarantine(id).catch(() => {});
  try { revalidateTag('listings'); } catch {}   // outside a request it can't run; the 60 s cache catches up

  const site = SITE();
  const email = p.raw_data?.user_email;
  if (email) {
    await sendListingPublishedEmail(email, {
      name: p.contact_name,
      title: `${p.property_type || ''} · ${p.neighborhood || p.city || ''}`,
      ref: listingRef(id, p.created_at),
      url: `${site}/propiedad/${id}`,
    }).catch(() => {});
  }
  await submitToIndexNow([
    `${site}/propiedad/${id}`,
    `${site}/`,
    `${site}/${p.listing_type === 'rent' ? 'alquilar' : 'comprar'}`,
    `${site}/propiedades`,
  ]).catch(() => {});
}

// Rejected listings wait in the admin Quarantine (Blocked → "Images rejected"), under the
// "User submissions" source, one record per listing; the payload names the listing
// (property_id) and the photos that failed, so an admin can look and approve it anyway.
async function holdInQuarantine(p, failed) {
  const sourceId = await getUserSubmissionsSourceId();
  if (!sourceId) return;
  await insert('ingest_quarantine', [{
    source_id: sourceId,
    external_id: quarantineKey(p.id),
    reasons: [IMAGES_REJECTED],
    payload: {
      property_id: p.id,
      slug: p.slug,
      listing_type: p.listing_type,
      property_type: p.property_type,
      address: p.address || p.neighborhood || null,
      neighborhood: p.neighborhood,
      city: p.city,
      country: p.country,
      contact_name: p.contact_name,
      contact_phone: p.contact_phone,
      feature_image_url: p.feature_image_url,
      origin: 'user',
      raw_data: { user_email: p.raw_data?.user_email || null, failed_photos: failed },
    },
    status: 'pending',
    reviewed_at: null,
    reviewed_by: null,
    created_at: new Date().toISOString(),
  }], { upsert: true, onConflict: 'source_id,external_id', returning: 'minimal' });
}

export async function releaseFromQuarantine(id) {
  const sourceId = await getUserSubmissionsSourceId();
  if (sourceId) await remove('ingest_quarantine', `source_id=eq.${sourceId}&external_id=eq.${encodeURIComponent(quarantineKey(id))}`);
}

// The hourly retry: listings still 'scanning' (the AI was down, the server restarted
// mid-check…), oldest first.
export async function scanPending(limit = 25) {
  const rows = await select('properties', `select=id&status=eq.${SCAN_STATUS.scanning}&origin=eq.user&order=created_at.asc&limit=${limit}`);
  const out = { checked: 0, published: 0, rejected: 0, retry: 0 };
  for (const r of rows) {
    const o = await scanListing(r.id);
    if (o === 'skipped') continue;
    out.checked++; out[o]++;
  }
  return out;
}
