// GET|POST /api/cron/renewal-reminders — the day-29 reminder. Finds promotions that
// expire within the next 24h and haven't been reminded this cycle, emails the owner a
// brand-styled reminder with a one-click renew link, and marks them reminded so we
// don't send twice. Schedule alongside the other crons with the CRON_SECRET; also
// callable manually with ?secret=<CRON_SECRET>. Runs a few times/day is plenty.
import { NextResponse } from 'next/server';
import { select, update } from '@/lib/db';
import { sendPromotionRenewalEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function handle(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const qs = new URL(req.url).searchParams.get('secret');
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();

  // Promotions in their last day that we haven't reminded yet.
  const q = [
    'select=id,created_by,property_type,neighborhood,city,slug,promotion_plan,promotion_expires_at',
    'promotion_plan=not.is.null',
    `promotion_expires_at=gt.${encodeURIComponent(nowIso)}`,
    `promotion_expires_at=lte.${encodeURIComponent(in24h.toISOString())}`,
    'renewal_reminded_at=is.null',
    'limit=500',
  ].join('&');
  let rows = [];
  try { rows = await select('properties', q); } catch (e) { return NextResponse.json({ error: 'query_failed', detail: e?.message }, { status: 500 }); }
  if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ ok: true, due: 0, sent: 0, at: nowIso });

  // Resolve owner emails in one shot.
  const ownerIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
  let users = [];
  if (ownerIds.length) {
    const inList = ownerIds.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
    try { users = await select('users', `select=id,email,full_name&id=in.(${inList})`); } catch { users = []; }
  }
  const userById = new Map((users || []).map((u) => [String(u.id), u]));

  let sent = 0, failed = 0, skipped = 0;
  for (const r of rows) {
    const owner = userById.get(String(r.created_by));
    if (!owner?.email) { skipped++; continue; }
    const title = [r.property_type, r.neighborhood || r.city].filter(Boolean).join(' · ') || 'Tu propiedad';
    const ref = (r.slug || r.id || '').toString().slice(0, 8).toUpperCase();
    let expiresText = '';
    try { expiresText = new Date(r.promotion_expires_at).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' }); } catch {}
    const res = await sendPromotionRenewalEmail(owner.email, {
      userId: r.created_by, propertyId: r.id, plan: r.promotion_plan, name: owner.full_name, title, ref, expiresText,
    });
    if (res?.ok) {
      // Mark reminded so the next run skips it (reset on renew/expire).
      try { await update('properties', `id=eq.${encodeURIComponent(r.id)}`, { renewal_reminded_at: nowIso }, { returning: 'minimal' }); } catch {}
      sent++;
    } else {
      failed++;
    }
  }
  return NextResponse.json({ ok: true, due: rows.length, sent, failed, skipped, at: nowIso });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
