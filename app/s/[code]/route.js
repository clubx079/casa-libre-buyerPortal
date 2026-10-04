// Short WhatsApp contact link. A buyer contacting a seller over WhatsApp sends a
// short `<domain>/s/<code>` URL (see lib/contactTrack.js → shortUrl); the code is
// <listing short_code>-<contact token> (or <base62 uuid>-<token> where a listing has
// no short_code). We redirect to the full listing URL WITH the UTM params +
// ?t=<token>, so the message stays short while analytics and the "seller opened"
// tracking both work.
//
// The row is created (keepalive) when the buyer taps WhatsApp, before the seller
// ever opens the link, so by redirect time it exists. If it somehow doesn't
// (tracking POST lost), we fall back to the marketplace rather than 404.
import { NextResponse } from 'next/server';
import { select } from '@/lib/db';
import { SITE } from '@/lib/site';
import { parseCode } from '@/lib/shortcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UTM = 'utm_source=whatsapp&utm_medium=seller_contact&utm_campaign=property_share';

// token is optional: the short_code form carries no per-share token.
const dest = (base, pid, token) =>
  `${base}/propiedad/${encodeURIComponent(pid)}?${UTM}${token ? `&t=${encodeURIComponent(token)}` : ''}`;

export async function GET(req, { params }) {
  const base = SITE.replace(/\/$/, '');
  const raw = String(params?.code || '').slice(0, 96).trim();
  if (!raw) return NextResponse.redirect(`${base}/propiedades`, 302);

  const { propertyId, shortCode, token } = parseCode(raw);

  // 1. Self-encoding format (base62(uuid)-token): the property UUID is in the
  // code — resolve with NO DB dependency, so it works even if tracking dropped.
  if (propertyId && token) {
    return NextResponse.redirect(dest(base, propertyId, token), 302);
  }

  // 2. Per-property short_code, with the contact's token (<short_code>-<token>, the
  // WhatsApp contact link since 2026-10) or bare (older links): look up the property
  // and redirect WITH the UTM params — and the token, so the listing page can mark
  // that contact "opened by seller".
  if (shortCode) {
    try {
      const rows = await select('properties', `short_code=eq.${encodeURIComponent(shortCode)}&select=id&limit=1`);
      const pid = rows?.[0]?.id;
      if (pid) return NextResponse.redirect(dest(base, pid, token), 302);
    } catch {
      /* column may not exist on this country's DB — fall through */
    }
  }

  // 3. Legacy token-only links: recover the property from the contact-tracking row
  // (a bare code that wasn't a listing's short_code is tried as a token too).
  const legacy = token || raw;
  try {
    const rows = await select(
      'contact_link_clicks',
      `token=eq.${encodeURIComponent(legacy)}&select=property_id&limit=1`,
    );
    const pid = rows?.[0]?.property_id;
    if (pid) return NextResponse.redirect(dest(base, pid, legacy), 302);
  } catch {
    /* fall through to marketplace */
  }
  return NextResponse.redirect(`${base}/propiedades`, 302);
}
