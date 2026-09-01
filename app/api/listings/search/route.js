// Server-side marketplace search: one page of matches + exact count. Thin
// wrapper over lib/marketplace.searchListings (shared with the SSR page).
import { NextResponse } from 'next/server';
import { searchListings } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch { b = {}; }
  const r = await searchListings(b);
  return NextResponse.json(r);
}
