// Lazy feature-image loader for the marketplace. The marketplace ships all
// listings WITHOUT image urls (to keep the page light) and calls this for just
// the cards/popups on screen. POST { ids: [...] } -> { [id]: featureImageUrl }.
import { NextResponse } from 'next/server';
import { getListingImages } from '@/lib/listings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let ids = [];
  try {
    const b = await req.json();
    if (Array.isArray(b?.ids)) ids = b.ids.filter((x) => typeof x === 'string').slice(0, 200);
  } catch { /* bad body -> empty */ }
  if (!ids.length) return NextResponse.json({ images: {} });
  try {
    const images = await getListingImages(ids);
    return NextResponse.json({ images });
  } catch (e) {
    return NextResponse.json({ images: {}, error: String(e.message || e) }, { status: 200 });
  }
}
