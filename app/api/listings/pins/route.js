// Compact map pins for the current filter (capped, Paraguay-bounded), cached per
// filter combo. Thin wrapper over lib/marketplace.getPins.
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getPins } from '@/lib/marketplace';
import { attachPinPhotos } from '@/lib/sellerPhotos';

export const dynamic = 'force-dynamic';

const cachedPins = unstable_cache(
  async (key, p) => getPins(p),
  ['cl-listing-pins-v4'],
  { revalidate: 120, tags: ['listings'] },
);

export async function GET(req) {
  const sp = req.nextUrl.searchParams;
  const p = Object.fromEntries(['op', 'type', 'beds', 'priceMin', 'priceMax', 'barrio', 'seller', 'q', 'place', 'height'].map((k) => [k, sp.get(k) || '']));
  // sp = the seller's approved profile photo (map popup), attached after the cache.
  const pins = await attachPinPhotos(await cachedPins(JSON.stringify(p), p));
  return NextResponse.json({ pins, count: pins.length });
}
