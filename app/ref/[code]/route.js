// /ref/<code> — someone's referral link (Casa-Libre referral program, lib/referrals/).
// Records the click (once per visitor per day), remembers the link in the visitor's
// cl_ref cookie for 30 days (the FIRST link they used wins; it is never overwritten while
// valid), then opens the home page with the sell wizard, tagged utm_source=referral.
// The account they create later, by any sign-in method, is attached to the referrer
// (lib/auth.js → lib/referrals/run.js recordReferralSignup).
// The owner opening their own link is sent to their Referrals page; nothing is recorded.
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as db from '@/lib/db';
import { publicOrigin } from '@/lib/publicOrigin';
import { getSession } from '@/lib/auth';
import { isCode, parseRefCookie, makeRefCookie, referralConfig, REF_COOKIE, VISITOR_COOKIE, DAY } from '@/lib/referrals/core';
import { codeOwner, recordClick } from '@/lib/referrals/store';
import { referralRow } from '@/lib/referrals/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOTS = /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|curl|wget|headless|telegram|discord/i;

export async function GET(req, { params }) {
  const origin = publicOrigin(req);
  const code = String(params?.code || '').toLowerCase();
  const landing = new URL('/', origin);
  landing.search = new URLSearchParams({ sell: '1', utm_source: 'referral', utm_medium: 'referral', utm_campaign: 'referidos', utm_content: isCode(code) ? code : 'invalido' }).toString();
  const home = NextResponse.redirect(landing);
  if (!isCode(code)) return home;

  let cfg, owner;
  try {
    cfg = referralConfig(await referralRow());
    owner = cfg.enabled ? await codeOwner(db, code) : null;
  } catch { return home; }
  if (!owner) return home;

  const session = getSession();
  if (session && String(session.uid) === owner.userId) return NextResponse.redirect(new URL('/cuenta/referidos?own=1', origin));

  const ua = req.headers.get('user-agent') || '';
  if (BOTS.test(ua)) return home;                              // link previews don't count

  const now = Date.now();
  const secure = process.env.NODE_ENV === 'production';
  let visitor = req.cookies.get(VISITOR_COOKIE)?.value;
  if (!/^[a-f0-9-]{36}$/.test(String(visitor || ''))) {
    visitor = randomUUID();
    home.cookies.set(VISITOR_COOKIE, visitor, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 400 * 24 * 3600 });
  }
  // a signed-in visitor is not a new person: the click counts, the cookie is not set
  const existing = parseRefCookie(req.cookies.get(REF_COOKIE)?.value, now, cfg.attributionDays);
  if (!session && !existing) {
    home.cookies.set(REF_COOKIE, makeRefCookie(code, now), { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: Math.round((cfg.attributionDays * DAY) / 1000) });
  }
  await recordClick(db, { code, ownerId: owner.userId, visitor, now: new Date(now) }).catch(() => {});
  return home;
}
