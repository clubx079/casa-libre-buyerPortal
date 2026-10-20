// GET /api/gift/claim?token=… — the "Verificar mi publicación" button in the first-listing
// gift email. Verifies the signed 'gift_claim' token, grants the free home display for
// that listing (lib/automations/firstListing.js claimGift — once, however often it is
// clicked), signs the seller in (the link was sent to their own inbox) and lands on My
// listings, which shows the listing as verified and on the home page.
import { NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/publicOrigin';
import { revalidateTag } from 'next/cache';
import { verifyRenewToken } from '@/lib/promoToken';
import { getSession, setSessionCookie } from '@/lib/auth';
import * as db from '@/lib/db';
import { grantPromotion } from '@/lib/billing';
import { claimGift } from '@/lib/automations/firstListing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const back = (q) => NextResponse.redirect(new URL(`/cuenta/publicaciones?${q}`, publicOrigin(req)));
  const claim = verifyRenewToken(url.searchParams.get('token'));
  if (!claim || claim.purpose !== 'gift_claim') return back('gift=invalid');

  let user;
  try {
    [user] = await db.select('users', `select=id,email,full_name,blocked,suspended,active&id=eq.${encodeURIComponent(claim.uid)}&limit=1`);
  } catch {
    return back('gift=error');
  }
  if (!user || user.blocked || user.suspended || user.active === false) return back('gift=invalid');

  let r;
  try {
    r = await claimGift({ db, userId: user.id, propertyId: claim.pid, grant: (pid, days) => grantPromotion(pid, 'home', { days }) });
  } catch (e) {
    console.error('[gift/claim]', claim.pid, e?.message || e);
    r = { ok: false, reason: 'error' };
  }
  if (r.ok && !r.already) { try { revalidateTag('listings'); } catch { /* best-effort */ } }

  const session = getSession();
  if (!session || String(session.uid) !== String(user.id)) setSessionCookie(user);
  return back(r.ok ? `gift=claimed&p=${encodeURIComponent(claim.pid)}` : `gift=${encodeURIComponent(r.reason)}`);
}
