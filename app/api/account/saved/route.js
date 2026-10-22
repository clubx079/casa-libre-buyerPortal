// GET /api/account/saved → { listings, guest } — the saved listings to show on Guardadas.
// Signed in: the account's saves. This browser's saves from before signing in (guest
// saves, device cookie cl_did) are moved into the account first, so they're on the same
// page right after logging in — never lost, never shown twice.
// Not signed in: this browser's guest saves (the public /guardadas page).
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { favoriteIds, guestFavoriteIds, mergeGuestFavorites, validDeviceId } from '@/lib/favorites';
import { getListingsByIds } from '@/lib/listings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  const device = cookies().get('cl_did')?.value;
  const okDevice = validDeviceId(device) ? device : null;
  let ids;
  if (s) {
    if (okDevice) await mergeGuestFavorites(s.uid, okDevice);
    ids = await favoriteIds(s.uid);
  } else {
    ids = okDevice ? await guestFavoriteIds(okDevice) : [];
  }
  const { listings } = await getListingsByIds(ids);
  // newest saved first (the order the saves came in)
  const pos = new Map(ids.map((id, i) => [String(id), i]));
  listings.sort((a, b) => (pos.get(String(a.id)) ?? 1e9) - (pos.get(String(b.id)) ?? 1e9));
  return NextResponse.json({ listings, guest: !s });
}
