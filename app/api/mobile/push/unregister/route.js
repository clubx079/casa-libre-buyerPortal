// POST /api/mobile/push/unregister { token }
// Called by the app just before sign-out so the phone stops getting that account's
// notifications. No session needed: the push token itself identifies the device.
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { unregisterToken } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  try {
    const r = await unregisterToken(db, b.token);
    return NextResponse.json(r, { status: r.error ? 400 : 200 });
  } catch {
    return NextResponse.json({ error: 'push_unavailable', pending: true }, { status: 503 });
  }
}
