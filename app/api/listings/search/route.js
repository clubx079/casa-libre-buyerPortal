// Server-side marketplace search: one page of matches + exact count. Thin
// wrapper over lib/marketplace.searchListings (shared with the SSR page).
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { searchListings } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

// Cached per filter combination for 60 s (and dropped on any listings change via the
// 'listings' tag). Ad traffic lands on a handful of identical searches, so this keeps
// a spike off the database — only the first request per combo per minute queries it.
// n/s/e/w = the visible map area (lib/mapArea.js), rounded to ~100 m by the client.
const SEARCH_KEYS = ['op', 'type', 'beds', 'q', 'barrio', 'seller', 'height', 'sort', 'page', 'pageSize', 'priceMin', 'priceMax', 'n', 's', 'e', 'w'];
const cachedSearch = unstable_cache(
  async (key, p) => searchListings(p),
  ['cl-listing-search-v1'],
  { revalidate: 60, tags: ['listings'] },
);

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch { b = {}; }
  // Only the known filter fields, in a fixed order → a stable cache key (and nothing
  // arbitrary from the body reaches the query builder).
  const p = {};
  for (const k of SEARCH_KEYS) if (b?.[k] !== undefined && b[k] !== null && b[k] !== '') p[k] = b[k];
  const r = await cachedSearch(JSON.stringify(p), p);
  return NextResponse.json(r);
}
