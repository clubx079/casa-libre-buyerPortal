// GET /api/auth/whatsapp/status → { enabled } — is "sign in with WhatsApp" on for this
// country's site? The mobile app asks before showing its WhatsApp option, so an app
// update never shows a button the site can't serve. On = the flag
// (NEXT_PUBLIC_WHATSAPP_LOGIN=1) + a Relay key + migration 016 on this country's DB.
import { NextResponse } from 'next/server';
import { relayConfigured } from '@/lib/relay';
import { select } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cached = null; // { at, enabled } — the DB check runs at most every 5 minutes

export async function GET() {
  if (process.env.NEXT_PUBLIC_WHATSAPP_LOGIN !== '1' || !relayConfigured()) return NextResponse.json({ enabled: false });
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return NextResponse.json({ enabled: cached.enabled });
  let enabled = true;
  try { await select('users', 'select=phone_verified_at&limit=1'); } catch { enabled = false; }
  cached = { at: Date.now(), enabled };
  return NextResponse.json({ enabled });
}
