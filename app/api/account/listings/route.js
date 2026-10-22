import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getUserListings } from '@/lib/listings';
import { select, remove } from '@/lib/db';
import { releaseFromQuarantine } from '@/lib/listingScan';
import { saveCounts } from '@/lib/favorites';
import { fetchListingViews } from '@/lib/posthogViews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { listings } = await getUserListings(s.uid);
  // What buyers did with each listing: how many saved it (accounts + visitors without an
  // account, lib/favorites.js) and views (PostHog, the same count as the views email).
  // Each fails on its own — the page still loads without them.
  const ids = listings.map((l) => l.id);
  const [saves, views] = await Promise.all([
    saveCounts(ids).catch(() => null),
    Promise.race([fetchListingViews(ids), new Promise((r) => setTimeout(() => r(null), 4000))]).catch(() => null),
  ]);
  return NextResponse.json({
    listings: listings.map((l) => ({
      ...l,
      saves: saves ? saves.get(String(l.id)) || 0 : null,
      views: views ? Number(views.get(String(l.id)) || 0) : null,
    })),
  });
}

// Delete one of the user's own listings.
export async function DELETE(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  // Verify ownership before deleting.
  const rows = await select('properties', `select=id,created_by&id=eq.${encodeURIComponent(id)}&limit=1`).catch(() => []);
  const prop = Array.isArray(rows) && rows[0];
  if (!prop) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (String(prop.created_by) !== String(s.uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    await remove('property_images', `property_id=eq.${encodeURIComponent(id)}`);
    await remove('properties', `id=eq.${encodeURIComponent(id)}`);
  } catch (e) {
    return NextResponse.json({ error: 'delete_failed', detail: e?.message }, { status: 500 });
  }
  await releaseFromQuarantine(id).catch(() => {});   // a held copy (rejected photos / possible duplicate) leaves the admin Quarantine too
  try { revalidateTag('listings'); } catch {}   // deleted listing drops off home/marketplace now
  return NextResponse.json({ ok: true });
}
