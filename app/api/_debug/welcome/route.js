// TEMPORARY diagnostic — verifies the welcome-email path in production.
// Gated by ?probe=casa2026. Sends only to Resend's test address by default.
// REMOVE after diagnosis.
import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  if (url.searchParams.get('probe') !== 'casa2026') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const to = url.searchParams.get('to') || 'delivered@resend.dev';
  let welcome;
  try {
    welcome = await sendWelcomeEmail(to, 'Debug User');
  } catch (e) {
    welcome = { threw: true, error: String(e?.message || e) };
  }
  return NextResponse.json({
    resendConfigured: !!process.env.RESEND_API_KEY,
    fromSet: !!process.env.RESEND_FROM,
    appPublicUrlSet: !!process.env.APP_PUBLIC_URL,
    to,
    welcome,
  });
}
