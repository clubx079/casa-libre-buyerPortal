// POST /api/account/confirm-email — Settings → "Reenviar confirmación": sends the
// WhatsApp sign-up's welcome + "confirm your email" link again (lib/emailConfirm.js).
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/users';
import { rateCheck, saveOtp } from '@/lib/otp';
import { sendWelcomeConfirmEmail } from '@/lib/email';
import { UNCONFIRMED } from '@/lib/emailConfirm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const s = getSession();
  if (!s?.uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const u = await getUserById(s.uid).catch(() => null);
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (u.auth_provider !== UNCONFIRMED) return NextResponse.json({ ok: true, already: true });
  // same cooldown / hourly limit as the sign-in codes (an otp_codes row marks each send)
  const ident = `confirm:${u.id}`;
  const lim = await rateCheck(ident, 'confirm_email').catch(() => ({ ok: true }));
  if (!lim.ok) return NextResponse.json({ error: lim.error, retryInMs: lim.retryInMs }, { status: 429 });
  await saveOtp(ident, 'confirm_email', 60).catch(() => {});
  const r = await sendWelcomeConfirmEmail(u);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'send_failed' }, { status: 502 });
}
