// POST /api/auth/apple { identityToken, nonce, fullName? } — Sign in with Apple from
// the iOS app. The token is checked against Apple's keys (lib/appleSignIn.js), the
// user is found or created by the email in it, and the cl_session cookie is set on
// this response (it lands in the app's own cookie jar, like /api/auth/code/verify).
import { NextResponse } from 'next/server';
import { verifyAppleIdToken, appleFullName } from '@/lib/appleSignIn';
import { findOrCreateAppleUser, publicUser } from '@/lib/users';
import { setSessionCookie } from '@/lib/auth';
import { getClientIP } from '@/lib/ip';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!body.identityToken || typeof body.identityToken !== 'string') return fail('missing_token');

  let apple;
  try {
    apple = await verifyAppleIdToken(body.identityToken, { nonce: body.nonce ?? undefined });
  } catch (e) {
    console.error('[auth/apple] token refused', e?.message || e);
    return fail(e?.message === 'no_email' ? 'no_email' : 'invalid_token', 401);
  }

  const fullName = appleFullName(body.fullName);
  let user;
  try {
    user = await findOrCreateAppleUser({ email: apple.email, fullName, ip: getClientIP(req) });
  } catch (e) {
    console.error('[auth/apple] user', e?.message || e);
    return fail('create_failed', 500);
  }
  if (!user?.id) return fail('create_failed', 500);
  if (user.blocked || user.suspended || user.active === false) return fail('account_unavailable', 403);

  if (user._isNew) await sendWelcomeEmail(user.email, user.full_name || fullName).catch(() => {});
  setSessionCookie(user);
  return NextResponse.json({ ok: true, mode: user._isNew ? 'signup' : 'login', user: publicUser(user) });
}
