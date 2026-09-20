// Session handoff: mobile app → website browser. The app is logged in (its own
// cookie jar), but when it opens the site in the system browser that browser is
// NOT logged in. So the app POSTs here (its cookie authenticates the request), gets
// a one-shot URL, and opens THAT in the browser — the GET sets the cl_session cookie
// in the browser and redirects to `next` (default: My listings, to promote & pay).
//
// Used by the "publish free in-app, then pay for visibility on the web" flow.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl(req) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return process.env.APP_PUBLIC_URL || 'http://localhost:3002';
}

// Only safe in-app relative paths (may carry a simple query string).
const safeNext = (n) => (typeof n === 'string' && /^\/[A-Za-z0-9/_.-]*(\?[A-Za-z0-9/_=&.-]*)?$/.test(n) ? n : '/cuenta/publicaciones');

// POST — authenticated (app cookie) → returns the one-shot browser login URL.
export async function POST(req) {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw || !verifyToken(raw)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let next = '/cuenta/publicaciones';
  try { const b = await req.json(); if (b?.next) next = b.next; } catch { /* default */ }
  const base = baseUrl(req);
  const url = `${base}/api/auth/handoff?t=${encodeURIComponent(raw)}&next=${encodeURIComponent(safeNext(next))}`;
  return NextResponse.json({ url });
}

// GET — consume: set the session cookie in the browser and redirect to `next`.
export async function GET(req) {
  const base = baseUrl(req);
  const { searchParams } = new URL(req.url);
  const t = searchParams.get('t');
  const next = safeNext(searchParams.get('next'));
  if (!t || !verifyToken(t)) return NextResponse.redirect(`${base}/?auth_error=1`);
  const res = NextResponse.redirect(`${base}${next}`);
  res.cookies.set(COOKIE_NAME, t, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
