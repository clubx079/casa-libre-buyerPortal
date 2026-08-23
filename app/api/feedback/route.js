// POST /api/feedback — user feedback (1–5 stars + message) from /feedback.
// Attributes the logged-in buyer from the session when present; otherwise takes
// the name/email typed in the form. Persists to public.feedback for the admin
// Feedbacks page. Anonymous allowed.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { insert } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v, n) => (v == null ? null : String(v).slice(0, n).trim() || null);

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const rating = Math.round(Number(b.rating));
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: 'invalid_rating' }, { status: 400 });

  const s = getSession();
  const row = {
    user_id: s?.uid || null,
    name: clean(b.name || s?.name, 120),
    email: clean(b.email || s?.email, 160),
    rating,
    message: clean(b.message, 2000),
    source: clean(b.source, 40) || 'site',
  };
  try {
    await insert('feedback', [row], { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'failed', detail: e?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
