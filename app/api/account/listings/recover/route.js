// My listings → Eliminadas → Recover. Puts the owner's listing back the way it was before the
// delete, with its paid features — but every end date is the original one, so if its paid / free
// time ran out meanwhile it comes back ended (lib/listingTrash.js restorePatch).
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { select, update } from '@/lib/db';
import { restorePatch, DELETED_STATUS } from '@/lib/listingTrash';
import { loadPaidConfig } from '@/lib/listingQuota';
import { listingUntil, paidInfo } from '@/lib/paidListings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  const enc = encodeURIComponent(id);
  const [prop] = await select('properties', `select=id,created_by,created_at,source_id,status,admin_status,raw_data&id=eq.${enc}&limit=1`).catch(() => []);
  if (!prop) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (String(prop.created_by) !== String(s.uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (prop.status !== DELETED_STATUS) return NextResponse.json({ ok: true, already: true });
  // When the listing's own time ends: its paid period, or its free period while the paywall is on.
  const cfg = await loadPaidConfig(select).catch(() => null);
  const until = cfg?.enabled ? listingUntil(prop, cfg) : (paidInfo(prop)?.until || null);
  const patch = restorePatch(prop, { until });
  if (!patch) return NextResponse.json({ error: 'not_deleted' }, { status: 409 });
  try {
    await update('properties', `id=eq.${enc}&status=eq.${DELETED_STATUS}`, patch, { returning: 'minimal' });
  } catch (e) {
    return NextResponse.json({ error: 'recover_failed', detail: e?.message }, { status: 500 });
  }
  try { revalidateTag('listings'); } catch {}   // back on home / marketplace now
  return NextResponse.json({ ok: true, status: patch.status, ended: patch.status === 'expired' });
}
