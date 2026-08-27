// Short WhatsApp share link. A buyer sharing a listing over WhatsApp sends a
// short `<domain>/s/<code>` URL (see lib/contactTrack.js → shortUrl). The code
// is the contact tracking token; we look up its row in contact_link_clicks to
// recover the property, then 302-redirect to the full listing URL WITH the UTM
// params + ?t=<token> — so the shared message stays short while analytics and
// the "seller opened" tracking behave exactly as before.
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

const dest = (base, pid, token) =>
  `${base}/propiedad/${encodeURIComponent(pid)}?${UTM}&t=${encodeURIComponent(token)}`;

export async function GET(req, { params }) {
  const base = SITE.replace(/\/$/, '');
  const raw = String(params?.code || '').slice(0, 96).trim();
  if (!raw) return NextResponse.redirect(`${base}/propiedades`, 302);

  const { propertyId, token } = parseCode(raw);

  // New self-encoding format: the property UUID is in the code — resolve with no
  // DB dependency, so the link works even if the tracking write was dropped.
  if (propertyId && token) {
    return NextResponse.redirect(dest(base, propertyId, token), 302);
  }

  // Legacy token-only links (created before self-encoding): recover the property
  // from the contact-tracking row.
  try {
    const rows = await select(
      'contact_link_clicks',
      `token=eq.${encodeURIComponent(token)}&select=property_id&limit=1`,
    );
    const pid = rows?.[0]?.property_id;
    if (pid) return NextResponse.redirect(dest(base, pid, token), 302);
  } catch {
    /* fall through to marketplace */
  }
  return NextResponse.redirect(`${base}/propiedades`, 302);
}
