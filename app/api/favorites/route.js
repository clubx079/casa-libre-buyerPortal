// GET  /api/favorites                 -> { ids: [...propertyId] } — the account's saves, or
//                                        (not logged in) this browser's guest saves
// POST /api/favorites {property_id}   -> save
// DELETE /api/favorites {property_id} -> unsave
// Not logged in: saves go to guest_favorites under the browser's device id (cookie cl_did).
// Logged in: any guest saves of this browser are moved into the account first.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import {
  favoriteIds, addFavorite, removeFavorite,
  guestFavoriteIds, addGuestFavorite, removeGuestFavorite, mergeGuestFavorites, validDeviceId,
} from '@/lib/favorites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const deviceOf = () => {
  const id = cookies().get('cl_did')?.value;
  return validDeviceId(id) ? id : null;
};

export async function GET() {
  const s = getSession();
  const device = deviceOf();
  if (!s) return NextResponse.json({ ids: device ? await guestFavoriteIds(device) : [], guest: true });
  if (device) await mergeGuestFavorites(s.uid, device);
  return NextResponse.json({ ids: await favoriteIds(s.uid) });
}

async function change(req, save) {
  const s = getSession();
  const device = deviceOf();
  if (!s && !device) return NextResponse.json({ error: 'no_device' }, { status: 400 });
  const { property_id } = await req.json().catch(() => ({}));
  if (!property_id) return NextResponse.json({ error: 'missing_property' }, { status: 400 });
  try {
    if (s) await (save ? addFavorite(s.uid, property_id) : removeFavorite(s.uid, property_id));
    else await (save ? addGuestFavorite(device, property_id) : removeGuestFavorite(device, property_id));
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: e?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: save, guest: !s });
}

export const POST = (req) => change(req, true);
export const DELETE = (req) => change(req, false);
