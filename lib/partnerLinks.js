// Short tracked links for the service-partner pages: /<slug>/<code> and /<slug>/<code>/pagar.
// The open is recorded on the server (ad blockers can't hide it, link previewers and email
// scanners are skipped), then the visitor goes to the page or to Stripe with the UTM tags.
import 'server-only';
import { NextResponse } from 'next/server';
import { getPartner, linkUtm } from '@/lib/partners';
import { partnerPagesOn, phCapture, isBot } from '@/lib/partnerServer';
import { publicOrigin } from '@/lib/publicOrigin';

export async function openPartnerLink(req, slug, code, { pay = false } = {}) {
  if (!partnerPagesOn()) return new NextResponse('Not found', { status: 404 });
  const p = getPartner(slug);
  const origin = publicOrigin(req);
  const link = p?.links?.[String(code || '').toLowerCase()];
  if (!p || !link) return NextResponse.redirect(`${origin}/${slug}`, 302);
  const c = String(code).toLowerCase();
  const utm = linkUtm(p, c);
  const ua = req.headers.get('user-agent') || '';
  if (!isBot(ua)) {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined;
    await phCapture('partner_link_opened', ip ? `ip:${ip}` : `link:${c}`, {
      partner: slug, link_code: c, link_owner: link.who, is_client: link.client, link_type: pay ? 'pay' : 'page',
      $ip: ip, $useragent: ua.slice(0, 200), ...utm,
    });
  }
  const q = new URLSearchParams(utm);
  if (pay) { q.set('from', 'email'); return NextResponse.redirect(`${origin}/${slug}/pagar?${q}`, 302); }
  return NextResponse.redirect(`${origin}/${slug}?${q}`, 302);
}
