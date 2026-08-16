// PATCH /api/account/profile { full_name, phone } — update the user's profile.
import { NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth';
import { getUserById, publicUser } from '@/lib/users';
import { update } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const u = await getUserById(s.uid);
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ full_name: u.full_name || '', phone: u.phone || '', email: u.email, has_password: !!u.password_hash, auth_provider: u.auth_provider || 'email' });
}

export async function PATCH(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const patch = {};
  if (typeof body.full_name === 'string') patch.full_name = body.full_name.trim() || null;
  if (typeof body.phone === 'string') patch.phone = body.phone.trim() || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  patch.updated_at = new Date().toISOString();
  try {
    await update('users', `id=eq.${encodeURIComponent(s.uid)}`, patch, { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'update_failed', detail: e?.message }, { status: 500 });
  }
  const fresh = await getUserById(s.uid);
  if (fresh) setSessionCookie(fresh); // refresh name in the session token
  return NextResponse.json({ ok: true, user: publicUser(fresh) });
}
