// POST /api/mobile/push/register { token, platform, appVersion?, deviceName? }
// The mobile app calls this after sign-in (and on every launch while signed in) to
// link its Expo push token to the account. Session = the cl_session cookie.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { registerToken } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const r = await registerToken(db, s.uid, b);
    if (r.error) return NextResponse.json(r, { status: 400 });
    return NextResponse.json(r);
  } catch {
    // Before migration 011 the table doesn't exist — the app just carries on.
    return NextResponse.json({ error: 'push_unavailable', pending: true }, { status: 503 });
  }
}
