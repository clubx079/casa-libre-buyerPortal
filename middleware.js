import { NextResponse } from 'next/server';

// Tier-2 API protection. The marketplace DATA endpoints only answer a request
// that carries a short-lived signed token, which we mint into a cookie on every
// real page load. A real browser sends that cookie automatically on its
// same-origin fetches (no client changes, no UX change); a scraper hitting the
// API directly has no token → 403. To get in it must first load a real HTML page
// per session and replay the token before it expires — which kills cheap bulk
// scraping and is easy to rate-limit. Signed with SESSION_SECRET via HMAC-SHA256
// on Web Crypto (edge-runtime safe).
const GATED = ['/api/listings/search', '/api/listings/pins', '/api/listings/images'];
const COOKIE = 'cl_api';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h — comfortably longer than any real session
const SECRET = process.env.SESSION_SECRET || 'insecure-dev-secret';
const enc = new TextEncoder();

function toB64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  str += '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
let _key;
function key() { return (_key ||= crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])); }
async function sign(payload) { return toB64url(new Uint8Array(await crypto.subtle.sign('HMAC', await key(), enc.encode(payload)))); }
async function mint() { const p = toB64url(enc.encode(JSON.stringify({ exp: Date.now() + TTL_MS }))); return `${p}.${await sign(p)}`; }
async function valid(tok) {
  if (!tok || !tok.includes('.')) return false;
  const [p, s] = tok.split('.');
  if (s !== (await sign(p))) return false;
  try { const { exp } = JSON.parse(new TextDecoder().decode(fromB64url(p))); return typeof exp === 'number' && exp > Date.now(); }
  catch { return false; }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (GATED.some((g) => pathname.startsWith(g))) {
    if (!(await valid(req.cookies.get(COOKIE)?.value))) {
      return new NextResponse(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/')) return NextResponse.next(); // other APIs untouched
  const res = NextResponse.next();                             // pages: ensure a token cookie exists
  if (!(await valid(req.cookies.get(COOKIE)?.value))) {
    res.cookies.set(COOKIE, await mint(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: Math.floor(TTL_MS / 1000) });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|xml|woff2?)$).*)'],
};
