import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserListings } from '@/lib/listings';
import { select, remove } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { listings } = await getUserListings(s.uid);
  return NextResponse.json({ listings });
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
  return NextResponse.json({ ok: true });
}
