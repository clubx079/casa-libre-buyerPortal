// casa-libre.com.py/casa-limpia/pagar → straight to Stripe Checkout for the founding-partner plan.
// Used by the "Pagar ahora" button on the page and by the pay link in the email.
// ?ph=<PostHog distinct id> ties the payment to the visitor's page activity; utm_* are kept.
import { NextResponse } from 'next/server';
import { getPartner } from '@/lib/partners';
import { partnerPagesOn, createPartnerCheckout, phCapture, cleanId, isBot, UTM_KEYS } from '@/lib/partnerServer';
import { publicOrigin } from '@/lib/publicOrigin';

export const dynamic = 'force-dynamic';
const SLUG = 'casa-limpia';

export async function GET(req) {
  if (!partnerPagesOn()) return new NextResponse('Not found', { status: 404 });
  const partner = getPartner(SLUG);
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const ua = req.headers.get('user-agent') || '';
  // Email link scanners open links too; send them to the page instead of creating sessions.
  if (isBot(ua)) return NextResponse.redirect(`${origin}/${SLUG}#precio`, 303);
  const distinctId = cleanId(url.searchParams.get('ph'));
  const utm = Object.fromEntries(UTM_KEYS.map((k) => [k, (url.searchParams.get(k) || '').slice(0, 100)]).filter(([, v]) => v));
  try {
    const session = await createPartnerCheckout(partner, { origin, distinctId, utm });
    await phCapture('partner_checkout_started', distinctId, { partner: SLUG, session_id: session.id, from: url.searchParams.get('from') || 'link', livemode: session.livemode, ...utm });
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    await phCapture('partner_checkout_failed', distinctId, { partner: SLUG, error: String(e?.message || e).slice(0, 200), ...utm });
    return NextResponse.redirect(`${origin}/${SLUG}?pago=error#precio`, 303);
  }
}
