// GET    /api/drafts/:id → one of the user's drafts (to resume it in the wizard)
// PATCH  /api/drafts/:id → autosave the wizard fields
// DELETE /api/drafts/:id → discard it
// Always scoped to the signed-in user (lib/drafts filters by user_id).
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { getDraft, updateDraft, deleteDraft } from '@/lib/drafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });
const notFound = () => NextResponse.json({ error: 'not_found' }, { status: 404 });

export async function GET(_req, { params }) {
  const s = getSession();
  if (!s) return unauthorized();
  try {
    const d = await getDraft(db, s.uid, params.id);
    return d ? NextResponse.json({ draft: d }) : notFound();
  } catch { return notFound(); }
}

export async function PATCH(req, { params }) {
  const s = getSession();
  if (!s) return unauthorized();
  const body = await req.json().catch(() => ({}));
  try {
    const r = await updateDraft(db, s.uid, params.id, body.data);
    return r.error ? notFound() : NextResponse.json({ draft: r.draft });
  } catch { return NextResponse.json({ error: 'drafts_unavailable' }, { status: 503 }); }
}

export async function DELETE(_req, { params }) {
  const s = getSession();
  if (!s) return unauthorized();
  try {
    return (await deleteDraft(db, s.uid, params.id)) ? NextResponse.json({ ok: true }) : notFound();
  } catch { return notFound(); }
}
