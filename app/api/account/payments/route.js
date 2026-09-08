// GET /api/account/payments — the logged-in user's saved card (brand + last4 +
// expiry) and their highlight transaction history. Powers the /cuenta/pagos page.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserBilling } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { card, payments } = await getUserBilling(session.uid);
  return NextResponse.json({ card, payments });
}
