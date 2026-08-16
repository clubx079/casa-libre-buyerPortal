// GET  /api/favorites            -> { ids: [...propertyId] } for the logged-in user
// POST /api/favorites {property_id}   -> save
// DELETE /api/favorites {property_id} -> unsave
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { favoriteIds, addFavorite, removeFavorite } from '@/lib/favorites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ ids: [] });
  const ids = await favoriteIds(s.uid);
  return NextResponse.json({ ids });
}

export async function POST(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { property_id } = await req.json().catch(() => ({}));
  if (!property_id) return NextResponse.json({ error: 'missing_property' }, { status: 400 });
  try { await addFavorite(s.uid, property_id); } catch (e) { return NextResponse.json({ error: 'failed', detail: e?.message }, { status: 500 }); }
  return NextResponse.json({ ok: true, saved: true });
}

export async function DELETE(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { property_id } = await req.json().catch(() => ({}));
  if (!property_id) return NextResponse.json({ error: 'missing_property' }, { status: 400 });
  try { await removeFavorite(s.uid, property_id); } catch (e) { return NextResponse.json({ error: 'failed', detail: e?.message }, { status: 500 }); }
  return NextResponse.json({ ok: true, saved: false });
}
