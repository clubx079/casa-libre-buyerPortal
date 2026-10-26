// At sign-in: a NEW account (created in the last 30 min) gets
//   1. users.attribution = where its first visit came from (the cl_ft cookie, lib/attribution.js),
//      written once (only while still empty). A DB without the column just skips it.
//   2. a server-side PostHog `account_created` event with the method and that source, so
//      PostHog counts EVERY sign-up — the browser's user_signed_up deliberately skips sellers
//      signing up from the sell form (it is the Google Ads / GA4 conversion), and can be lost
//      on redirects or blockers.
// Never throws, never blocks the sign-in. Server-only.
import 'server-only';
import { update } from './db';
import { COUNTRY_CODE } from './country';
import { attributionFromCookie, isNewAccount, FIRST_TOUCH_COOKIE } from './attribution';

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const recorded = (globalThis.__clSignupsRecorded ||= new Set());

// cookieValue: the raw cl_ft cookie; method: 'email' | 'google' | 'apple' | 'whatsapp' | …
export async function recordSignup(user, { cookieValue = null, method = null, now = Date.now() } = {}) {
  if (!user?.id || !isNewAccount(user, now)) return { skipped: 'not_new' };
  // once per account (a profile save in the first minutes refreshes the session too)
  if (recorded.has(String(user.id))) return { skipped: 'already' };
  recorded.add(String(user.id));
  const source = attributionFromCookie(cookieValue);
  const out = { attribution: false, event: false };
  if (source) {
    const where = `id=eq.${encodeURIComponent(user.id)}&attribution=is.null`;
    // jsonb column (or text: then as a JSON string); a DB without the column → skipped
    out.attribution = await update('users', where, { attribution: source }, { returning: 'minimal' }).then(() => true)
      .catch(() => update('users', where, { attribution: JSON.stringify(source) }, { returning: 'minimal' }).then(() => true).catch(() => false));
  }
  if (PH_KEY) {
    out.event = await fetch(`${PH_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PH_KEY,
        event: 'account_created',
        distinct_id: String(user.id),   // the same id the browser identifies the person with
        properties: {
          site_country: COUNTRY_CODE,
          method: method || user.auth_provider || 'email',
          ...(source ? { first_source: source.source, first_medium: source.medium, first_campaign: source.campaign, first_landing: source.landing, first_ads_click: source.ads_click } : {}),
        },
      }),
    }).then((r) => r.ok).catch(() => false);
  }
  return out;
}

export const FIRST_TOUCH = FIRST_TOUCH_COOKIE;
