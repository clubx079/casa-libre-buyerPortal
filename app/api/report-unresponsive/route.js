// POST /api/report-unresponsive { property_id, listing_ref, reporter_name,
// reporter_contact, message, seller_name, seller_phone } -> { ok:true }
// Persists a "seller didn't respond" report to public.listing_reports.
// Session is OPTIONAL — works for both logged-in and anonymous buyers.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createReport } from '@/lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { property_id, listing_ref, reporter_name, reporter_contact, message, seller_name, seller_phone } = body || {};

  if (!property_id) return NextResponse.json({ error: 'missing_property' }, { status: 400 });

  const s = getSession();

  const row = {
    user_id: s?.uid || null,
    reporter_name: (reporter_name || s?.name || '').toString().slice(0, 120) || null,
    reporter_contact: (reporter_contact || s?.email || '').toString().slice(0, 160) || null,
    property_id,
    listing_ref: (listing_ref || '').toString().slice(0, 40) || null,
    seller_name: (seller_name || '').toString().slice(0, 160) || null,
    seller_phone: (seller_phone || '').toString().slice(0, 60) || null,
    message: (message || '').toString().slice(0, 2000) || null,
    status: 'open',
  };

  try {
    await createReport(row);
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: e?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
