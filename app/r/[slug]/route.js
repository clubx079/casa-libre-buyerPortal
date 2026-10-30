// /r/<slug> — a channel's UTM link (lib/campaigns.js: one per channel).
//
// Redirects to the home page with the channel's utm tags, so the visit shows up in
// analytics with a source instead of landing in "direct". Older links (/r/rda,
// /r/igs…) resolve to their channel; any ?t=… on them is ignored.
// WhatsApp campaign batches: /r/wa?b=<batch>&r=<person>&sell=1 — the click is recorded under
// that batch and person, utm_campaign becomes the batch (utm_content the person), and sell=1
// opens the sell wizard on arrival.
//
// It also records the CLICK itself, server-side, as a `link_click` event under the
// channel's slug — the admin's "UTM Links" page counts these as "opened". That is a
// different number from the page view that follows ("landed"): a click is counted
// even when the person leaves before the page loads or JavaScript is blocked.
import { NextResponse } from 'next/server';
import { campaignUrl, resolveSlug, batchOf, refOf, CAMPAIGNS } from '@/lib/campaigns';
import { SITE } from '@/lib/site';
import { COUNTRY_CODE } from '@/lib/country';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Fire-and-forget: analytics must never delay or break the redirect.
// slug = the channel's slug (an old alias like 'rda' is recorded as 'rd');
// via = the slug actually in the link, kept for reference.
function recordClick(req, slug, campaign, via, batch, ref) {
  if (!PH_KEY) return;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined;
  const ua = req.headers.get('user-agent') || '';
  // Bots and link previewers (Reddit, WhatsApp, Slack) fetch the URL too; don't
  // count those as people clicking.
  if (/bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|curl|wget|headless/i.test(ua)) return;
  try {
    fetch(`${PH_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PH_KEY,
        event: 'link_click',
        // one identity per IP, matching how the admin counts anonymous visitors
        distinct_id: ip || `slug:${slug}`,
        properties: {
          // Which country site served the link, so the admin's country switcher
          // scopes clicks the same way it scopes every other number. Without it
          // these events carry no host and fall back to Paraguay.
          site_country: COUNTRY_CODE,
          slug,
          utm_source: campaign?.source,
          utm_medium: campaign?.medium,
          utm_campaign: batch || campaign?.name,
          batch: batch || undefined,
          recipient: ref || undefined,
          utm_content: ref || undefined,
          via: via !== slug ? via : undefined,
          $ip: ip,
          $useragent: ua.slice(0, 200),
        },
      }),
    }).catch(() => {});
  } catch { /* never block the redirect */ }
}

export function GET(req, { params }) {
  const base = SITE.replace(/\/$/, '');
  const asked = String(params?.slug || '').toLowerCase();
  const slug = resolveSlug(asked); // 'rda' → 'rd'; unknown → null
  const sp = new URL(req.url).searchParams;
  const batch = slug === 'wa' ? batchOf(sp.get('b')) : '';
  const ref = batch ? refOf(sp.get('r')) : '';
  const url = slug ? campaignUrl(base, slug, { batch, sell: sp.get('sell') === '1', ref }) : null;

  if (url) recordClick(req, slug, CAMPAIGNS[slug], asked, batch, ref);

  // Unknown slug → the site, rather than a 404 on a link already in the wild.
  return NextResponse.redirect(url || `${base}/`, 302);
}
