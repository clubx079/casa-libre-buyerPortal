// GET    /api/drafts/:id → one of the user's drafts (to resume it in the wizard)
// PATCH  /api/drafts/:id → autosave the wizard fields
// DELETE /api/drafts/:id → discard it
// Always scoped to the signed-in user (lib/drafts filters by user_id). A draft the
// person saved before signing in (same email) is moved to their account first, so the
// wizard keeps autosaving it after they confirm their email mid-way.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { getDraft, updateDraft, deleteDraft } from '@/lib/drafts';
import { claimGuestDrafts } from '@/lib/guestDrafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });
const notFound = () => NextResponse.json({ error: 'not_found' }, { status: 404 });
const claim = (s) => claimGuestDrafts(db, s.email, s.uid).catch(() => {});

export async function GET(_req, { params }) {
  const s = getSession();
  if (!s) return unauthorized();
  try {
    await claim(s);
    const d = await getDraft(db, s.uid, params.id);
    return d ? NextResponse.json({ draft: d }) : notFound();
  } catch { return notFound(); }
}

export async function PATCH(req, { params }) {
  const s = getSession();
  if (!s) return unauthorized();
  const body = await req.json().catch(() => ({}));
  try {
    await claim(s);
    const r = await updateDraft(db, s.uid, params.id, body.data);
    return r.error ? notFound() : NextResponse.json({ draft: r.draft });
  } catch { return NextResponse.json({ error: 'drafts_unavailable' }, { status: 503 }); }
}

export async function DELETE(_req, { params }) {
  const s = getSession();
  if (!s) return unauthorized();
  try {
    await claim(s);
    return (await deleteDraft(db, s.uid, params.id)) ? NextResponse.json({ ok: true }) : notFound();
  } catch { return notFound(); }
}
