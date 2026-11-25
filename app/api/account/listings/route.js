import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getUserListings } from '@/lib/listings';
import { select, update } from '@/lib/db';
import { releaseFromQuarantine } from '@/lib/listingScan';
import { saveCounts } from '@/lib/favorites';
import { fetchListingViews } from '@/lib/posthogViews';
import { manyShareStats, statsConfigured } from '@/lib/shareStats';
import { recordDeletion, askWhy } from '@/lib/listingDeleted';
import { trashPatch, DELETED_STATUS } from '@/lib/listingTrash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { listings: all } = await getUserListings(s.uid);
  // Deleted ones go in their own list ("Recently deleted"): the app's My listings keeps
  // reading `listings` and simply stops showing them.
  const listings = all.filter((l) => !l.trash);
  const deleted = all.filter((l) => l.trash);
  // What buyers did with each listing: how many saved it (accounts + visitors without an
  // account, lib/favorites.js) and views (PostHog, the same count as the views email).
  // Each fails on its own — the page still loads without them.
  const ids = listings.map((l) => l.id);
  const [saves, views, shares] = await Promise.all([
    saveCounts(ids).catch(() => null),
    Promise.race([fetchListingViews(ids), new Promise((r) => setTimeout(() => r(null), 4000))]).catch(() => null),
    // what the owner's share links brought (lib/shareStats.js) — null when PostHog can't be read
    statsConfigured() ? Promise.race([manyShareStats(ids), new Promise((r) => setTimeout(() => r(null), 4000))]).catch(() => null) : null,
  ]);
  const noShare = { visits: 0, contacts: 0, last7: { visits: 0, contacts: 0 } };
  return NextResponse.json({
    listings: listings.map((l) => ({
      ...l,
      saves: saves ? saves.get(String(l.id)) || 0 : null,
      views: views ? Number(views.get(String(l.id)) || 0) : null,
      share: shares ? shares.get(String(l.id).toLowerCase()) || noShare : null,
    })),
    deleted,
  });
}

// Delete one of the user's own listings. It is NOT removed from the database: it leaves the
// site and the app now and stays in the owner's "Eliminadas" tab, where one click brings it back
// (POST ./recover, lib/listingTrash.js). The deletion record + "ask why" email still go out now.
export async function DELETE(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  // Verify ownership before deleting.
  const rows = await select('properties', `select=id,created_by,created_at,status,admin_status,raw_data,property_type,listing_type,neighborhood,city&id=eq.${encodeURIComponent(id)}&limit=1`).catch(() => []);
  const prop = Array.isArray(rows) && rows[0];
  if (!prop) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (String(prop.created_by) !== String(s.uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (prop.status === DELETED_STATUS) return NextResponse.json({ ok: true, already: true });
  try {
    await update('properties', `id=eq.${encodeURIComponent(id)}`, trashPatch(prop), { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'delete_failed', detail: e?.message }, { status: 500 });
  }
  await releaseFromQuarantine(id).catch(() => {});   // a held copy (rejected photos / possible duplicate) leaves the admin Quarantine too
  try { revalidateTag('listings'); } catch {}   // deleted listing drops off home/marketplace now
  const views = await Promise.race([fetchListingViews([id]), new Promise((r) => setTimeout(() => r(null), 3000))]).catch(() => null);
  await recordDeletion(prop, { email: s.email, views: views ? views.get(String(id)) || 0 : null }).catch((e) => console.error('[listings] deletion record', e?.message || e));
  await askWhy(prop, { email: s.email, name: s.name }).catch(() => {});
  return NextResponse.json({ ok: true });
}
