// GET /api/promo/extend?token=… — the "Extend for US$20" button in the automation's
// ending-soon email. Verifies the signed 'extend' token, checks the listing still
// belongs to that user, signs them in (the link was sent to their own inbox), and
// hands off to the existing payment flow on My listings, which charges a saved card in
// one click or opens the card form. Paying adds 30 days after the free period.
// It never charges by itself.
import { NextResponse } from 'next/server';
import { verifyRenewToken } from '@/lib/promoToken';
import { getSession, setSessionCookie } from '@/lib/auth';
import { select } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const back = (path) => NextResponse.redirect(new URL(path, url.origin));
  const claim = verifyRenewToken(url.searchParams.get('token'));
  if (!claim || claim.purpose !== 'extend') return back('/cuenta/publicaciones?extend=invalid');

  let prop, user;
  try {
    [prop] = await select('properties', `select=id,created_by&id=eq.${encodeURIComponent(claim.pid)}&limit=1`);
    [user] = await select('users', `select=id,email,full_name&id=eq.${encodeURIComponent(claim.uid)}&limit=1`);
  } catch {
    return back('/cuenta/publicaciones?extend=error');
  }
  if (!prop || !user || String(prop.created_by) !== String(user.id)) return back('/cuenta/publicaciones?extend=invalid');

  const session = getSession();
  if (!session || String(session.uid) !== String(user.id)) setSessionCookie(user);
  return back(`/cuenta/publicaciones?pay=${encodeURIComponent(prop.id)}&plan=home`);
}
