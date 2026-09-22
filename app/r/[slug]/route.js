// /r/<slug> — the short link we hand out anywhere off-site.
//
// Redirects to the real page with utm parameters attached, so the visit shows up
// in analytics with a source instead of landing in "direct". Reddit comments,
// Instagram bios, Meta ads and printed cards all use this; whatever arrives with
// no utm is organic (Google) or truly direct.
//
// ?t=<tag> becomes utm_content, so one slug can distinguish individual threads
// or posts without inventing a slug for each: /r/rda?t=askpy_sep26
import { NextResponse } from 'next/server';
import { campaignUrl } from '@/lib/campaigns';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req, { params }) {
  const base = SITE.replace(/\/$/, '');
  const { searchParams } = new URL(req.url);
  const url = campaignUrl(base, params?.slug, {
    content: searchParams.get('t') || undefined,
    campaign: searchParams.get('c') || undefined,
  });
  // Unknown slug → the site, rather than a 404 on a link already in the wild.
  return NextResponse.redirect(url || `${base}/`, 302);
}
