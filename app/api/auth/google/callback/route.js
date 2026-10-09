// GET /api/auth/google/callback?code=... — exchanges the code, upserts the user
// by email, sets the cl_session cookie, and redirects to the account dashboard.
import { NextResponse } from 'next/server';
import { safeReturnPath } from '@/lib/returnPath';
import { findOrCreateGoogleUser } from '@/lib/users';
import { makeToken, COOKIE_NAME } from '@/lib/auth';
import { getClientIP } from '@/lib/ip';
import { sendWelcomeEmail } from '@/lib/email';
import { SIGNUP_COOKIE } from '@/lib/signupSignal';

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
  // Return path passed via OAuth `state` (e.g. /publicar to finish a listing). Only
  // safe relative paths are honored; anything else falls back to the dashboard.
  const state = searchParams.get('state');
  const dest = safeReturnPath(state) || '/cuenta';
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
    const user = await findOrCreateGoogleUser({ email: g.email, googleId: g.id, fullName, ip: getClientIP(req) });

    if (user.blocked || user.suspended) return NextResponse.redirect(`${base}/?auth_error=blocked`);

    // Mobile app login: hand the session token back to the app via its deep link.
    // The app's own network jar can't see the in-app browser's cookie, so instead of
    // setting a cookie here we pass the token and the app exchanges it for the cookie
    // (POST /api/auth/mobile-exchange). state = 'm|<encoded casalibre:// return url>'.
    if (typeof state === 'string' && state.startsWith('m|')) {
      const target = decodeURIComponent(state.slice(2));
      if (/^(casalibre:\/\/|exp(\+[a-z0-9-]+)?:\/\/)/i.test(target)) {
        if (user._isNew) await sendWelcomeEmail(g.email, fullName).catch(() => {});
        const sep = target.includes('?') ? '&' : '?';
        return NextResponse.redirect(`${target}${sep}token=${encodeURIComponent(makeToken(user))}`);
      }
    }

    // Welcome email for brand-new Google signups — awaited (serverless kills
    // fire-and-forget work after the redirect). Wrapped so it never blocks login.
    if (user._isNew) await sendWelcomeEmail(g.email, fullName).catch(() => {});

    const res = NextResponse.redirect(`${base}${dest}`);
    res.cookies.set(COOKIE_NAME, makeToken(user), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7,
    });
    // Brand-new account → a short-lived, readable flag so the page we land on fires
    // user_signed_up { method: 'google' } once (components/PostHogProvider.js).
    // Not for sellers signing up from the sell flow — owner-side, not a buyer/renter
    // conversion (casa-libre-tracking-instructions.md) — nor for a guest seller coming
    // back to finish a draft from the reminder email (tab=borradores).
    const sellerSignup = dest.startsWith('/publicar') || dest.includes('sell=resume') || dest.includes('tab=borradores');
    if (user._isNew && !sellerSignup) {
      res.cookies.set(SIGNUP_COOKIE, 'google', {
        httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 10,
      });
    }
    return res;
  } catch (e) {
    return NextResponse.redirect(`${base}/?auth_error=1`);
  }
}
