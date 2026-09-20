// POST /api/auth/google -> returns the Google OAuth consent URL to redirect to.
// Mirrors the DeelMap buyer portal flow. Requires GOOGLE_CLIENT_ID.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl(req) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return process.env.APP_PUBLIC_URL || 'http://localhost:3002';
}

export async function POST(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'google_not_configured' }, { status: 500 });
  const { next, mobileRedirect } = await req.json().catch(() => ({}));
  const redirectUri = `${baseUrl(req)}/api/auth/google/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'email profile');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  // Mobile app login: carry the app's deep-link return URL (casalibre:// or exp://)
  // through OAuth `state`, so the callback hands the session back to the app instead
  // of redirecting to a web page. Otherwise carry a safe relative return path (e.g.
  // /publicar to finish a listing), not /cuenta.
  if (typeof mobileRedirect === 'string' && /^(casalibre:\/\/|exp(\+[a-z0-9-]+)?:\/\/)/i.test(mobileRedirect)) {
    url.searchParams.set('state', 'm|' + encodeURIComponent(mobileRedirect));
  } else if (typeof next === 'string' && /^\/[A-Za-z0-9/_-]*$/.test(next)) {
    url.searchParams.set('state', next);
  }
  return NextResponse.json({ url: url.toString() });
}
