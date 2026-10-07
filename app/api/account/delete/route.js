// POST /api/account/delete { confirm: true } — the signed-in user deletes their
// account (website /eliminar-cuenta and the mobile app's Account screen). What is
// removed / kept: lib/accountDeletion.js. On success the session cookie is cleared.
import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth';
import * as db from '@/lib/db';
import { deleteAccount } from '@/lib/accountDeletion';
import { stripe } from '@/lib/stripe';
import { deletePosthogPerson } from '@/lib/posthogPerson';
import { listDrafts, draftPhotoKeys } from '@/lib/drafts';
import { claimGuestDrafts } from '@/lib/guestDrafts';
import { removeDraftPhotos } from '@/lib/draftPhotos';

// Remove the saved card(s) from Stripe too, so nothing can be charged again.
// Best-effort: a Stripe hiccup never blocks deleting the account (we also clear
// card_pm_id, which every off-session charge needs).
async function removeSavedCards(uid) {
  if (!stripe) return;
  try {
    const [u] = await db.select('users', `select=stripe_customer_id&id=eq.${encodeURIComponent(uid)}&limit=1`);
    if (!u?.stripe_customer_id) return;
    const pms = await stripe.paymentMethods.list({ customer: u.stripe_customer_id, type: 'card', limit: 20 });
    for (const pm of pms.data || []) await stripe.paymentMethods.detach(pm.id).catch(() => {});
  } catch (e) {
    console.error('[account/delete] stripe cards', uid, e?.message || e);
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const s = getSession();
  if (!s?.uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== true) return NextResponse.json({ error: 'confirm_required' }, { status: 400 });

  await removeSavedCards(s.uid);
  // Their drafts' photos (files in storage) — drafts saved before they signed in are
  // claimed first, so deleteAccount removes those rows too.
  try {
    await claimGuestDrafts(db, s.email, s.uid);
    const drafts = await listDrafts(db, s.uid);
    await removeDraftPhotos(drafts.flatMap((d) => draftPhotoKeys(d.data)));
  } catch { /* best-effort */ }
  const r = await deleteAccount(db, { uid: s.uid, email: s.email });
  if (!r.ok) {
    console.error('[account/delete] failed', s.uid, r.failed);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
  // Analytics profile (email, name, phone), events and recordings — best-effort,
  // the account itself is already deleted.
  const ph = await deletePosthogPerson(s.uid);
  if (!ph.ok) console.error('[account/delete] PostHog person not deleted', s.uid, ph.error);
  try { clearSessionCookie(); } catch {}
  return NextResponse.json({ ok: true });
}
