// GET /api/profile-pro — the signed-in seller's Profile Personalization plan (lib/profilePro.js),
// for Settings → Perfil profesional. Paid switch OFF (the default) → { enabled: false } and the
// page shows nothing new.
// → { enabled, days, price, renewPrice, firstFree, freeLeft, status: { active, until, expired, ever },
//     next: { kind, cents, price } }
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { profileOffer } from '@/lib/profileProServer';
import { usd } from '@/lib/profilePro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { cfg, status, next, freeLeft } = await profileOffer(s.uid);
  if (!cfg.enabled) return NextResponse.json({ enabled: false });
  return NextResponse.json({
    enabled: true, days: cfg.days, price: usd(cfg.priceCents), renewPrice: usd(cfg.renewCents), firstFree: cfg.firstFree, freeLeft,
    status, next: { ...next, price: usd(next.cents) },
  });
}
