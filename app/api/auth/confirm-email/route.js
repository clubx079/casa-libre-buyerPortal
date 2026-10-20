// GET /api/auth/confirm-email?token=… — the "Confirmar mi email" button in the welcome
// email of a WhatsApp sign-up (lib/emailConfirm.js). Marks the email as confirmed when
// the account still has that email, then lands on Settings.
import { NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/publicOrigin';
import { verifyEmailConfirm, UNCONFIRMED, CONFIRMED } from '@/lib/emailConfirm';
import { select, update } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const back = (state) => NextResponse.redirect(new URL(`/cuenta/ajustes?email=${state}`, publicOrigin(req)));
  const claim = verifyEmailConfirm(url.searchParams.get('token'));
  if (!claim) return back('invalid');
  let user;
  try { [user] = await select('users', `select=id,email,auth_provider&id=eq.${encodeURIComponent(claim.uid)}&limit=1`); }
  catch { return back('error'); }
  // the account changed its email since → this link no longer proves anything
  if (!user || String(user.email).toLowerCase() !== claim.email) return back('invalid');
  if (user.auth_provider === UNCONFIRMED) {
    try { await update('users', `id=eq.${encodeURIComponent(user.id)}`, { auth_provider: CONFIRMED, updated_at: new Date().toISOString() }, { returning: 'minimal' }); }
    catch { return back('error'); }
  }
  return back('confirmed');
}
