// GET /api/listing-quota?device_id=&fp=&phone= — is the seller's next listing free or paid this
// month? The sell wizard asks before the last step so it can show the price up front.
// → { enabled, paymentRequired, freePerMonth, freeUsed, freeLeft, price, listPrice,
//     discountPct, days, extendPrice, extendDays, local: { price, extend } }
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getClientIP } from '@/lib/ip';
import { listingQuota } from '@/lib/listingQuota';
import { makeSignals } from '@/lib/samePerson';
import { usd } from '@/lib/paidListings';
import { localPrice } from '@/lib/localPrice';
import { COUNTRY } from '@/lib/country';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const signals = makeSignals({ deviceId: sp.get('device_id') || req.cookies?.get?.('cl_did')?.value, fp: sp.get('fp'), ip: getClientIP(req) });
  const q = await listingQuota(db, { uid: session.uid, signals, phone: sp.get('phone'), phonePrefix: COUNTRY.phonePrefix, countryCode: COUNTRY.code });
  const [lp, le] = q.enabled ? await Promise.all([localPrice(q.priceCents), localPrice(q.extendCents)]) : [null, null];
  return NextResponse.json({
    enabled: q.enabled, paymentRequired: q.paymentRequired, freePerMonth: q.freePerMonth, freeUsed: q.freeUsed, freeLeft: q.freeLeft,
    price: usd(q.priceCents), priceCents: q.priceCents, listPrice: usd(q.listCents), discountPct: q.discountPct, days: q.days,
    extendPrice: usd(q.extendCents), extendDays: q.extendDays, local: { price: lp, extend: le },
  });
}
