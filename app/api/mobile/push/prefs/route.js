// GET /api/mobile/push/prefs            → { prefs: { listings, saved, news } }
// PUT /api/mobile/push/prefs { news: false, … } → updated prefs
// Per-user notification switches (one per Android channel). Ready for a future
// in-app "Notifications" settings screen; sendPush() already respects them.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { getPrefs, setPrefs } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ prefs: await getPrefs(db, s.uid) });
  } catch {
    return NextResponse.json({ prefs: { listings: true, saved: true, news: true }, pending: true });
  }
}

export async function PUT(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const r = await setPrefs(db, s.uid, b);
    return NextResponse.json(r, { status: r.error ? 400 : 200 });
  } catch {
    return NextResponse.json({ error: 'push_unavailable', pending: true }, { status: 503 });
  }
}
