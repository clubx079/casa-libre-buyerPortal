import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { favoriteIds } from '@/lib/favorites';
import { getListingsByIds } from '@/lib/listings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ids = await favoriteIds(s.uid);
  const { listings } = await getListingsByIds(ids);
  return NextResponse.json({ listings });
}
