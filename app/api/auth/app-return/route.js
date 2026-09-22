// Session handoff: website browser → mobile app (the reverse of /api/auth/handoff).
//
// Someone taps Publish in the app, lands in the system browser, signs in there with
// the email code and publishes. The app itself never saw that login — the browser's
// cookie jar is not the app's. So the success screen links here: we take the
// browser's session cookie and bounce to the app's deep link carrying it, and the
// app exchanges it via /api/auth/mobile-exchange. Net effect: publish on the web,
// come back to the app already signed in, with the listing in My listings.
//
// The token is the same signed session JWT the cookie holds — it is only ever
// handed to the app's own scheme, and it is verified before we pass it on.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_SCHEME = 'casalibre://auth';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const raw = cookies().get(COOKIE_NAME)?.value;

  // Not signed in in this browser → send the app back empty-handed rather than
  // leaving the user staring at an error page.
  if (!raw || !verifyToken(raw)) return NextResponse.redirect(`${APP_SCHEME}?error=1`);

  const listing = searchParams.get('listing');
  const url = `${APP_SCHEME}?token=${encodeURIComponent(raw)}${listing ? `&listing=${encodeURIComponent(listing)}` : ''}`;
  return NextResponse.redirect(url);
}
