// Places for the search suggestions (lib/placeIndex.js): every barrio / city / departamento
// with its listing count, what it is and where ("Las Mercedes — Barrio, Asunción"), plus the
// barrio-name labels for the map. ?id=<place id> → that place's outline, label spot and box.
// Read-only; built from the listings in server memory, cached by the browser 10 min (gated like /search: middleware.js).
import { NextResponse } from 'next/server';
import { getPlacePayload, placeAreaById } from '@/lib/placeIndex';

export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'private, max-age=600' };

export async function GET(req) {
  const id = req.nextUrl.searchParams.get('id');
  try {
    if (id) {
      const area = await placeAreaById(id);
      return NextResponse.json({ area }, { status: area ? 200 : 404, headers: area ? CACHE : {} });
    }
    return NextResponse.json(await getPlacePayload(), { headers: CACHE });
  } catch {
    return NextResponse.json({ places: [], labels: [] }, { status: 503 });
  }
}
