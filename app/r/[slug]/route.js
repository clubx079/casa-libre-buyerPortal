// /r/<slug> — the short link we hand out anywhere off-site.
//
// Redirects to the real page with utm parameters attached, so the visit shows up
// in analytics with a source instead of landing in "direct". Reddit comments,
// Instagram bios, Meta ads and printed cards all use this; whatever arrives with
// no utm is organic (Google) or truly direct.
//
// ?t=<tag> becomes utm_content, so one slug can distinguish individual threads
// or posts without inventing a slug for each: /r/rda?t=askpy_sep26
//
// It also records the CLICK itself, server-side, as a `link_click` event. That is
// a different number from the pageview that follows: a click is counted even when
// the person leaves before the page loads, when JavaScript is blocked, or when an
// in-app browser drops the referrer. Clicks minus landings is the leak.
import { NextResponse } from 'next/server';
import { campaignUrl, CAMPAIGNS } from '@/lib/campaigns';
import { SITE } from '@/lib/site';
import { COUNTRY_CODE } from '@/lib/country';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Fire-and-forget: analytics must never delay or break the redirect.
function recordClick(req, slug, campaign, content) {
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
          utm_campaign: campaign?.name,
          utm_content: content || undefined,
          $ip: ip,
          $useragent: ua.slice(0, 200),
        },
      }),
    }).catch(() => {});
  } catch { /* never block the redirect */ }
}

export function GET(req, { params }) {
  const base = SITE.replace(/\/$/, '');
  const { searchParams } = new URL(req.url);
  const slug = String(params?.slug || '').toLowerCase();
  const content = searchParams.get('t') || undefined;
  const url = campaignUrl(base, slug, { content, campaign: searchParams.get('c') || undefined });

  if (url) recordClick(req, slug, CAMPAIGNS[slug], content);

  // Unknown slug → the site, rather than a 404 on a link already in the wild.
  return NextResponse.redirect(url || `${base}/`, 302);
}
