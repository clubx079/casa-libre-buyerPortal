// GET /api/auth/whatsapp/delivery?phone=+598…&since=<ms> → { state } — did the WhatsApp code we
// just sent reach that number? ('no_whatsapp' | 'failed' | 'delivered' | 'pending', lib/waDelivery.js)
// The code screens ask a few times after "Send code" and say so when the number has no WhatsApp.
// Only answers for a number this site sent a code to in the last 15 minutes (otp_codes), so it can't
// be used to look up whether any number has WhatsApp.
import { NextResponse } from 'next/server';
import { relayConfigured } from '@/lib/relay';
import { select } from '@/lib/db';
import { toE164 } from '@/lib/whatsappPhone';
import { COUNTRY } from '@/lib/country';
import { deliveryState } from '@/lib/waDelivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const base = () => String(process.env.RELAY_BASE_URL || 'https://relay.airosofts.com/v1').replace(/\/+$/, '');

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const phone = toE164(sp.get('phone'), COUNTRY.phonePrefix);
  const since = Number(sp.get('since')) || Date.now() - 10 * 60000;
  if (!phone || !relayConfigured()) return NextResponse.json({ state: 'pending' });
  const recent = new Date(Date.now() - 15 * 60000).toISOString();
  const rows = await select('otp_codes', `select=id&identifier=like.%25${encodeURIComponent(phone)}&last_sent_at=gte.${recent}&limit=1`).catch(() => []);
  if (!rows.length) return NextResponse.json({ state: 'pending' });
  try {
    const r = await fetch(`${base()}/conversations/${phone.replace(/\D/g, '')}/messages?limit=10`, {
      headers: { Authorization: `Bearer ${process.env.RELAY_API_KEY}` }, cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json({ state: deliveryState(j?.data, since) });
  } catch {
    return NextResponse.json({ state: 'pending' });
  }
}
