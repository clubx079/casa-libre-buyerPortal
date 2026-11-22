// /l/<code>?c=<channel> — a listing's share link (lib/shareLinks.js). The code is derived
// from the listing id, so it is found back with a uuid range query (no table).
//   → 307 /propiedad/<id>?utm_source=<channel name>&utm_medium=share&utm_campaign=listing_share
//         &utm_content=<code>[&ref=<owner's referral code>]
// The click is recorded server-side as PostHog `share_link_click` {listing_id, channel,
// owner_id, country} (like /r/<slug>: link previewers and bots are not counted, one identity
// per IP). The owner opening their own link is not counted.
// While the referral program is on, the visitor also gets the owner's referral cookie (the same
// cl_ref cookie /ref/<code> sets: first link wins, never overwritten while valid), so an
// account created after a share counts as the owner's referral.
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { publicOrigin } from '@/lib/publicOrigin';
import { getSession } from '@/lib/auth';
import { COUNTRY_CODE } from '@/lib/country';
import { codeRange, isShareCode, channelOf, shareTarget, CHANNEL_NAMES } from '@/lib/shareLinks';
import { referralConfig, parseRefCookie, makeRefCookie, REF_COOKIE, DAY } from '@/lib/referrals/core';
import { ensureCode } from '@/lib/referrals/store';
import { referralRow } from '@/lib/referrals/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
export const BOTS = /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|curl|wget|headless|telegram|discord|embedly|vkshare|pinterest|skypeuri|bitlybot|linkedinbot|twitterbot/i;

function recordClick(req, props) {
  if (!PH_KEY) return Promise.resolve();
  const ip = (req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || '').trim() || undefined;
  const ua = req.headers.get('user-agent') || '';
  return fetch(`${PH_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: PH_KEY,
      event: 'share_link_click',
      distinct_id: ip || `share:${props.listing_id}`,
      properties: { site_country: COUNTRY_CODE, country: COUNTRY_CODE, utm_source: CHANNEL_NAMES[props.channel], utm_medium: 'share', utm_campaign: 'listing_share', ...props, $ip: ip, $useragent: ua.slice(0, 200) },
    }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
}

async function findListing(code) {
  const r = codeRange(code);
  if (!r) return null;
  const rows = await db.select('properties', `select=id,created_by,status,admin_status,created_at&id=gte.${r.lo}&id=lte.${r.hi}&order=created_at.desc&limit=5`).catch(() => []);
  return rows.find((p) => p.status === 'published' && p.admin_status === 'active') || rows[0] || null;
}

export async function GET(req, { params }) {
  const origin = publicOrigin(req);
  const code = String(params?.code || '').toLowerCase();
  const channel = channelOf(new URL(req.url).searchParams.get('c'));
  const listing = isShareCode(code) ? await findListing(code) : null;
  if (!listing) return NextResponse.redirect(new URL('/propiedades', origin), 307);

  const ownerId = listing.created_by ? String(listing.created_by) : null;
  const session = getSession();
  const isOwner = !!(session && ownerId && String(session.uid) === ownerId);
  const ua = req.headers.get('user-agent') || '';
  const bot = BOTS.test(ua);

  // the owner's referral code, while the program is on
  let refCode = null, cfg = null;
  if (ownerId) {
    try {
      cfg = referralConfig(await referralRow());
      if (cfg.enabled) {
        const [owner] = await db.select('users', `select=id,email&id=eq.${encodeURIComponent(ownerId)}&limit=1`);
        if (owner) refCode = await ensureCode(db, owner);
      }
    } catch { refCode = null; }
  }

  const res = NextResponse.redirect(shareTarget(origin, listing.id, { code, channel, refCode }), 307);
  if (bot || isOwner) return res;

  if (refCode && !session && !parseRefCookie(req.cookies.get(REF_COOKIE)?.value, Date.now(), cfg.attributionDays)) {
    res.cookies.set(REF_COOKIE, makeRefCookie(refCode, Date.now()), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: Math.round((cfg.attributionDays * DAY) / 1000) });
  }
  await recordClick(req, { listing_id: listing.id, channel, owner_id: ownerId, code, ref: refCode || undefined });
  return res;
}
