// POST /api/business-contact — the "Send email" quick form on /empresas.
// Sends the visitor's question to the internal investor-inquiry inbox via Resend
// (same branded system as every Casa Libre email). Recipient is env-only
// (PARTNER_INQUIRY_EMAIL, else CONTACT_EMAIL). Anonymous — no session.
import { NextResponse } from 'next/server';
import { sendBusinessInquiryEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v, n) => (v == null ? null : String(v).slice(0, n).trim() || null);

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (b && b.web) return NextResponse.json({ ok: true }); // honeypot: silently drop bots

  const fromEmail = clean(b.email, 160);
  const query = clean(b.query || b.message, 4000);
  if (!fromEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!query) return NextResponse.json({ error: 'missing_message' }, { status: 400 });

  const r = await sendBusinessInquiryEmail({
    fromEmail,
    query,
    lang: b.lang === 'en' ? 'en' : 'es',
    source: clean(b.source, 40) || 'empresas-email',
  });
  if (!r.ok) return NextResponse.json({ error: r.error || 'failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
