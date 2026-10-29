// The "this listing is on us" gift (lib/automations/paymentFollowup.js) — publish a listing
// that is waiting for payment, for free:
//   GET  ?token=…            the email's button: signed 'listing_gift' token (that listing,
//                            that seller), signs the seller in, lands on My listings
//   POST { propertyId }      the "Publicar gratis" button in My listings (signed in)
// Either way: only an open offer on the seller's own listing; clicking twice is harmless.
import { NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/publicOrigin';
import { verifyRenewToken } from '@/lib/promoToken';
import { getSession, setSessionCookie } from '@/lib/auth';
import * as db from '@/lib/db';
import { startListingScan } from '@/lib/listingScan';
import { claimListingGift } from '@/lib/automations/paymentFollowup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function claim(userId, propertyId) {
  try {
    return await claimListingGift({ db, userId, propertyId, startScan: (id) => startListingScan(id) });
  } catch (e) {
    console.error('[listing-gift/claim]', propertyId, e?.message || e);
    return { ok: false, reason: 'error' };
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const back = (q) => NextResponse.redirect(new URL(`/cuenta/publicaciones?${q}`, publicOrigin(req)));
  const t = verifyRenewToken(url.searchParams.get('token'));
  if (!t || t.purpose !== 'listing_gift') return back('listing_gift=invalid');
  let user;
  try {
    [user] = await db.select('users', `select=id,email,full_name,blocked,suspended,active&id=eq.${encodeURIComponent(t.uid)}&limit=1`);
  } catch { return back('listing_gift=error'); }
  if (!user || user.blocked || user.suspended || user.active === false) return back('listing_gift=invalid');
  const r = await claim(user.id, t.pid);
  const session = getSession();
  if (!session || String(session.uid) !== String(user.id)) setSessionCookie(user);
  return back(r.ok ? `listing_gift=claimed&p=${encodeURIComponent(t.pid)}` : `listing_gift=${encodeURIComponent(r.reason)}&p=${encodeURIComponent(t.pid)}`);
}

export async function POST(req) {
  const session = getSession();
  if (!session?.uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(b.propertyId || ''))) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const r = await claim(session.uid, b.propertyId);
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === 'error' ? 500 : 400 });
}
