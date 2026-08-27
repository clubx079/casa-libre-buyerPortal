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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UTM = 'utm_source=whatsapp&utm_medium=seller_contact&utm_campaign=property_share';

export async function GET(req, { params }) {
  const base = SITE.replace(/\/$/, '');
  const code = String(params?.code || '').slice(0, 64).trim();
  if (!code) return NextResponse.redirect(`${base}/propiedades`, 302);

  try {
    const rows = await select(
      'contact_link_clicks',
      `token=eq.${encodeURIComponent(code)}&select=property_id&limit=1`,
    );
    const pid = rows?.[0]?.property_id;
    if (pid) {
      const dest = `${base}/propiedad/${encodeURIComponent(pid)}?${UTM}&t=${encodeURIComponent(code)}`;
      return NextResponse.redirect(dest, 302);
    }
  } catch {
    /* fall through to marketplace */
  }
  return NextResponse.redirect(`${base}/propiedades`, 302);
}
