// POST /api/mobile/install { install_id, installed_at, platform, version, first_open }
// The app's "I was opened" ping (casa-libre-mobile-app lib/installPing.js): once per launch, and
// again after a sign-in. Records PostHog 'app_opened' — install_id counts the installs that
// opened the app; when the session cookie is there, user_id + whether the account was created
// after the app was installed (= signed up IN the app). Nothing is written to the database.
// Admin → App installs reads it ("From install to account").
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { COUNTRY_CODE } from '@/lib/country';
import { createdInApp } from '@/lib/appInstall';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const HEADERS = { 'Cache-Control': 'no-store' };
const ID_RE = /^[a-z0-9-]{8,64}$/i;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const installId = String(b.install_id || '');
  if (!ID_RE.test(installId)) return NextResponse.json({ error: 'invalid_install_id' }, { status: 400, headers: HEADERS });
  const platform = ['android', 'ios'].includes(b.platform) ? b.platform : 'other';
  const installedAt = Number.isFinite(Date.parse(b.installed_at || '')) ? new Date(b.installed_at).toISOString() : null;
  const s = getSession();
  let user = null;
  if (s?.uid) [user] = await db.select('users', `select=id,created_at,auth_provider&id=eq.${encodeURIComponent(s.uid)}&limit=1`).catch(() => []);
  if (!PH_KEY) return NextResponse.json({ ok: true, recorded: false }, { headers: HEADERS });
  const recorded = await fetch(`${PH_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: PH_KEY,
      event: 'app_opened',
      // signed in → the account's id (the same person as on the website); otherwise the install
      distinct_id: user ? String(user.id) : `install:${installId}`,
      properties: {
        site_country: COUNTRY_CODE,
        install_id: installId,
        installed_at: installedAt,
        platform,
        app_version: String(b.version || '').slice(0, 20) || null,
        first_open: b.first_open === true,
        signed_in: !!user,
        ...(user ? { user_id: String(user.id), account_created_at: user.created_at, account_created_in_app: createdInApp(user.created_at, installedAt), sign_in_method: user.auth_provider || null } : {}),
      },
    }),
  }).then((r) => r.ok).catch(() => false);
  return NextResponse.json({ ok: true, recorded }, { headers: HEADERS });
}
