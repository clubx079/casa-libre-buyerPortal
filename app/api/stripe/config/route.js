// The Stripe PUBLISHABLE key, served at runtime. NEXT_PUBLIC_* vars are inlined at
// BUILD time, but our deploy platform doesn't expose env to the build step — so the
// client fetches the (public, safe-to-expose) publishable key from here instead.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '';
  return NextResponse.json({ publishableKey }, { headers: { 'Cache-Control': 'no-store' } });
}
