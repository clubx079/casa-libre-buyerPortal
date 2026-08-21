// POST /api/partner-inquiries — business/partner ("Empresas y profesionales")
// lead capture from /empresas. Persists to public.partner_inquiries so the team
// (and the admin portal) can work it as a lead: new -> contacted -> migrating ->
// live. Anonymous — no session required.
import { NextResponse } from 'next/server';
import { insert } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v, n) => (v == null ? null : String(v).slice(0, n).trim() || null);

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (b && b.web) return NextResponse.json({ ok: true }); // honeypot: silently drop bots

  const email = clean(b.email, 160);
  const name = clean(b.name, 120);
  const phone = clean(b.phone, 60);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  if (!name || !phone) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const row = {
    business_type: clean(b.type, 80),
    portfolio_size: clean(b.size, 80),
    name,
    company: clean(b.company, 160),
    phone,
    email,
    city: clean(b.city, 120),
    message: clean(b.message, 2000),
    lang: b.lang === 'en' ? 'en' : 'es',
    source: clean(b.source, 40) || 'empresas',
    status: 'new',
  };

  try {
    await insert('partner_inquiries', [row], { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: e?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
