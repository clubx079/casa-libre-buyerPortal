// POST /api/push/test — send a push to one account's devices (manual testing, and
// the model for future automated sends).
//   Authorization: Bearer <CRON_SECRET>   (required — refuses to run without it)
//   { email | userId, title?, body?, url?, channel?: 'listings'|'saved'|'news' }
// → the sendPush summary { sent, failed, skipped, disabledTokens, noDevices? }
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { findUserByEmail } from '@/lib/users';
import { sendPush } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'disabled: CRON_SECRET not set' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  let userId = b.userId || null;
  if (!userId && b.email) userId = (await findUserByEmail(b.email))?.id || null;
  if (!userId) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  try {
    const r = await sendPush(db, {
      userIds: [userId],
      title: b.title || 'Casa Libre',
      body: b.body || 'Notificación de prueba. Si la ves, las notificaciones funcionan.',
      channel: b.channel || 'news',
      kind: 'test',
      data: { url: b.url || '/(tabs)' },
    });
    return NextResponse.json(r, { status: r.error ? 400 : 200 });
  } catch (e) {
    return NextResponse.json({ error: 'push_unavailable', detail: String(e.message || e).slice(0, 200) }, { status: 503 });
  }
}
