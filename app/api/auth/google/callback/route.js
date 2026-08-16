// GET /api/auth/google/callback?code=... — exchanges the code, upserts the user
// by email, sets the cl_session cookie, and redirects to the account dashboard.
import { NextResponse } from 'next/server';
import { findOrCreateGoogleUser } from '@/lib/users';
import { makeToken, COOKIE_NAME } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl(req) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return process.env.APP_PUBLIC_URL || 'http://localhost:3002';
}

export async function GET(req) {
  const base = baseUrl(req);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (searchParams.get('error') || !code) return NextResponse.redirect(`${base}/?auth_error=1`);

  try {
    const redirectUri = `${base}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error('token_exchange_failed');
    const tokens = await tokenRes.json();

    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!infoRes.ok) throw new Error('userinfo_failed');
    const g = await infoRes.json();
    if (!g.email) throw new Error('no_email');

    const fullName = g.name || [g.given_name, g.family_name].filter(Boolean).join(' ') || null;
    const user = await findOrCreateGoogleUser({ email: g.email, googleId: g.id, fullName });

    const res = NextResponse.redirect(`${base}/cuenta`);
    res.cookies.set(COOKIE_NAME, makeToken(user), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    return NextResponse.redirect(`${base}/?auth_error=1`);
  }
}
