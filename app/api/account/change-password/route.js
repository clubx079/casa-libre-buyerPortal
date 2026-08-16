// POST /api/account/change-password { current, next }
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { getUserById, verifyPassword } from '@/lib/users';
import { update } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { current, next } = await req.json().catch(() => ({}));
  if (!next || String(next).length < 6) return NextResponse.json({ error: 'weak_password' }, { status: 400 });

  const user = await getUserById(s.uid);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Users who signed up with a password must confirm the current one. Google-only
  // accounts (no password yet) can set one directly.
  if (user.password_hash) {
    const ok = await verifyPassword(user, current);
    if (!ok) return NextResponse.json({ error: 'wrong_current' }, { status: 400 });
  }
  try {
    const password_hash = await bcrypt.hash(String(next), 10);
    await update('users', `id=eq.${encodeURIComponent(s.uid)}`, { password_hash, updated_at: new Date().toISOString() }, { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'update_failed', detail: e?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
