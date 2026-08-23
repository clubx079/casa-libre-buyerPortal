// Contact-link tracking. A buyer tapping "Chat on WhatsApp" creates a record
// (who / which seller / which property) keyed by a client-generated token, and
// the WhatsApp message carries a UTM + ?t=<token> link back to the listing.
// When the SELLER opens that link, the listing page pings this route with
// { open:true, token } and the record is flagged opened. Feeds the admin
// Contacts analytics page. Buyer identity comes from the session (optional).
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { insert, update } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v, n) => (v == null ? null : String(v).slice(0, n).trim() || null);

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const token = clean(b.token, 64);
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  // Seller opened the shared link → flag the record opened.
  if (b.open) {
    try {
      await update('contact_link_clicks', `token=eq.${encodeURIComponent(token)}`,
        { status: 'opened', opened_at: new Date().toISOString() }, { returning: 'minimal' });
    } catch { /* token may not exist yet on a race — ignore */ }
    return NextResponse.json({ ok: true });
  }

  // Buyer initiated contact → create (idempotent by token).
  const s = getSession();
  const row = {
    token,
    buyer_user_id: s?.uid || null,
    buyer_name: clean(s?.name, 120),
    buyer_email: clean(s?.email, 160),
    property_id: clean(b.property_id, 64),
    listing_ref: clean(b.listing_ref, 40),
    seller_name: clean(b.seller_name, 160),
    seller_phone: clean(b.seller_phone, 60),
    channel: ['whatsapp', 'call', 'copy'].includes(b.channel) ? b.channel : 'whatsapp',
    status: 'sent',
  };
  try {
    await insert('contact_link_clicks', [row], { upsert: true, onConflict: 'token', returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: e?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
