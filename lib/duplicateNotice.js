// The email sent the moment a listing is held as a possible duplicate (/api/publish) — the
// "same property listed twice" template of the duplicate_listings automation (Admin →
// Automations / Email templates), sent instead of "your listing is live". Same dedupe key
// as the hourly duplicate job (dup:<ids>), so the owner never gets it twice.
import 'server-only';
import * as db from './db';
import { sendOnce } from './automations/sendOnce';
import { DUPLICATES_AUTOMATION_ID, listingTitle, setKey } from './automations/duplicateListings';
import { sendRenderedEmail, templateFrame, siteUrl } from './email';
import { COUNTRY } from './country';

const fmt = (s) => { try { return new Date(s).toLocaleDateString(COUNTRY.locale, { day: 'numeric', month: 'long' }); } catch { return String(s).slice(0, 10); } };

// automation = the duplicate_listings row (its template_id); held = the new listing (saved);
// original = the listing it repeats; count = how many copies there are now.
export async function sendDuplicateNotice({ automation, held, original, count = 2, to, name }) {
  const templates = await db.select('email_templates', 'select=*').catch(() => []);
  const tpl = templates.find((t) => String(t.id) === String(automation?.template_id)) || templates.find((t) => t.key === 'duplicate-listing');
  const site = siteUrl();
  const myListings = `${site}/cuenta/publicaciones`;
  return sendOnce({
    db, automationId: DUPLICATES_AUTOMATION_ID, runId: held.id, dedupeKey: setKey([original.id, held.id]), tpl,
    frame: templateFrame(), deliver: sendRenderedEmail,
    to: process.env.AUTOMATION_EMAIL_OVERRIDE || String(to || '').trim().toLowerCase(),
    vars: {
      name: String(name || '').trim().split(/\s+/)[0] || '',
      property_title: listingTitle(held),
      listing_count: String(count),
      listing_links: [
        `[Publicación 1 · ${fmt(original.created_at)}](${site}/propiedad/${encodeURIComponent(original.id)})`,
        `[Publicación ${count} · ${fmt(held.created_at)} · en revisión](${myListings})`,
      ].join('\n'),
      my_listings_url: myListings,
      property_url: `${site}/propiedad/${encodeURIComponent(original.id)}`,
    },
  }).catch(() => 'failed');
}
