// Drafts for a seller who isn't signed in (lib/guestDrafts.js):
// POST /api/drafts/guest {email, key, id?, data} → save this browser's draft → { draft: { id } }
// GET  /api/drafts/guest?email&key&id           → that draft, to resume the wizard
// `key` is the browser's own random id (localStorage); only it can read or change the
// draft. Signing in with the email moves the draft to the account. Light per-IP limit.
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { saveGuestDraft, getGuestDraft } from '@/lib/guestDrafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 10 * 60 * 1000;
const MAX = 120;   // autosave is debounced; this only stops abuse
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) { hits.set(ip, { start: now, n: 1 }); return false; }
  h.n += 1;
  return h.n > MAX;
}
const ipOf = (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;

export async function POST(req) {
  const ip = ipOf(req);
  if (limited(ip || 'unknown')) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  try {
    const r = await saveGuestDraft(db, { email: b.email, key: b.key, id: b.id || null, data: b.data, ip });
    return r.error ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json({ draft: r.draft });
  } catch {
    return NextResponse.json({ error: 'drafts_unavailable' }, { status: 503 });
  }
}

export async function GET(req) {
  if (limited(ipOf(req) || 'unknown')) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const q = new URL(req.url).searchParams;
  try {
    const d = await getGuestDraft(db, { email: q.get('email'), key: q.get('key'), id: q.get('id') });
    return d ? NextResponse.json({ draft: d }) : NextResponse.json({ error: 'not_found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
