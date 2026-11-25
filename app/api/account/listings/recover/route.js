// "Recently deleted" → Recover. Puts the owner's listing back exactly as it was before the
// delete (same status, so the same paid features), while it is still inside the window.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { select, update } from '@/lib/db';
import { restorePatch, DELETED_STATUS } from '@/lib/listingTrash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  const enc = encodeURIComponent(id);
  const [prop] = await select('properties', `select=id,created_by,status,admin_status,raw_data&id=eq.${enc}&limit=1`).catch(() => []);
  if (!prop) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (String(prop.created_by) !== String(s.uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (prop.status !== DELETED_STATUS) return NextResponse.json({ ok: true, already: true });
  const patch = restorePatch(prop);
  if (!patch) return NextResponse.json({ error: 'expired' }, { status: 410 });
  try {
    await update('properties', `id=eq.${enc}&status=eq.${DELETED_STATUS}`, patch, { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'recover_failed', detail: e?.message }, { status: 500 });
  }
  try { revalidateTag('listings'); } catch {}   // back on home / marketplace now
  return NextResponse.json({ ok: true, status: patch.status });
}
