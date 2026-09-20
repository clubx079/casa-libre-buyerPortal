// POST { token } — the mobile app posts the one-time session token it received on
// the casalibre://auth deep link (from the Google callback). We verify it and set
// the cl_session cookie on THIS response, which lands in the app's own cookie jar
// (the in-app browser's cookie never reaches the app's network layer). After this
// the app just calls /api/auth/me to load the signed-in user.
import { NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let token;
  try { ({ token } = await req.json()); } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }); }
  if (!token || typeof token !== 'string') return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  // The token is a full session JWT minted by the Google callback — verify it before
  // trusting it, then re-issue it as the httpOnly session cookie on this response.
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
