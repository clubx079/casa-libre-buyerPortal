// POST /api/account/whatsapp-consent { optIn: true|false } — the signed-in person's
// consent to get updates about their listings on WhatsApp (sign-up and sell-wizard
// checkbox "Acepto recibir avisos por WhatsApp"). Automations only send WhatsApp
// marketing with this consent (lib/whatsappTemplates.js waAllowed). Migration 017;
// without it the answer is { ok: false, pending: true } and nothing breaks.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { update } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const s = getSession();
  if (!s?.uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const patch = body.optIn ? { whatsapp_opt_in_at: now, whatsapp_opted_out_at: null } : { whatsapp_opt_in_at: null, whatsapp_opted_out_at: now };
  try {
    await update('users', `id=eq.${encodeURIComponent(s.uid)}`, patch, { returning: 'minimal' });
    return NextResponse.json({ ok: true, optIn: !!body.optIn });
  } catch {
    return NextResponse.json({ ok: false, pending: true });
  }
}
