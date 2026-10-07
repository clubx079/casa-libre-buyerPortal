// GET  /api/drafts → the signed-in user's unfinished listings (sell-wizard drafts)
// POST /api/drafts → start a draft (needs the address already picked)
// Before migration 008 the table doesn't exist: GET answers an empty list so the
// My listings page still works, POST reports pending so the wizard carries on.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { listDrafts, createDraft } from '@/lib/drafts';
import { claimGuestDrafts } from '@/lib/guestDrafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    // Drafts saved while they weren't signed in (same email) become theirs here.
    await claimGuestDrafts(db, s.email, s.uid).catch(() => {});
    return NextResponse.json({ drafts: await listDrafts(db, s.uid) });
  } catch {
    return NextResponse.json({ drafts: [], pending: true });
  }
}

export async function POST(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const r = await createDraft(db, s.uid, body.data);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ draft: r.draft });
  } catch {
    return NextResponse.json({ error: 'drafts_unavailable', pending: true }, { status: 503 });
  }
}
