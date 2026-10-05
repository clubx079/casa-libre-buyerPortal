// Does this email already have an account? Used by the sell wizard to say "Account
// already exists" before the visitor chooses Google or "Send code". Sends nothing,
// creates nothing. Same rule as /api/auth/send-otp (which already answers 409 for a
// verified account): only a VERIFIED account counts. Light per-IP limit.
import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = globalThis.__clEmailStatusHits || (globalThis.__clEmailStatusHits = new Map());

function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) { hits.set(ip, { start: now, n: 1 }); return false; }
  h.n += 1;
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  return h.n > MAX_PER_WINDOW;
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const { email } = await req.json().catch(() => ({}));
  if (!emailOk(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  const existing = await findUserByEmail(email).catch(() => null);
  return NextResponse.json({ exists: !!(existing && existing.verified) });
}
