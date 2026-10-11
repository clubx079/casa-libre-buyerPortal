'use client';
// Thin, safe wrapper around posthog-js. Every call no-ops unless PostHog is
// actually configured (NEXT_PUBLIC_POSTHOG_KEY set) and loaded, so the site
// works identically with or without analytics enabled.
import posthog from 'posthog-js';
import { pushDataLayer } from './dataLayer';

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Ingest host (note the "i") for the US cloud. The admin portal queries the
// non-"i" host (https://us.posthog.com).
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

const ready = () => typeof window !== 'undefined' && !!POSTHOG_KEY && posthog.__loaded;

// Events fired before PostHog has started wait here. React runs a page's own effects
// BEFORE the PostHogProvider's init effect, so on a page opened directly (Google, a
// WhatsApp link) the first property_viewed / $pageview used to be dropped — the funnel
// showed far fewer "Viewed a property" than "Contacted a seller". flushQueued() sends
// them right after init. Capped so a page that never inits can't grow it forever.
const queued = [];

// Send to PostHog now, or after init when it hasn't started yet.
export function capture(event, props = {}) {
  if (typeof window === 'undefined' || !POSTHOG_KEY) return;
  if (!posthog.__loaded) { if (queued.length < 50) queued.push([event, props]); return; }
  try { posthog.capture(event, props); } catch { /* never break the UI for analytics */ }
}

// Called by PostHogProvider once posthog.init has run.
export function flushQueued() {
  if (!ready()) return;
  for (const [event, props] of queued.splice(0)) {
    try { posthog.capture(event, props); } catch { /* ignore */ }
  }
}

// Capture a product event. Extra props are attached as event properties.
// Also mirrored to the GTM dataLayer (allow-listed params only — lib/dataLayer.js);
// that push doesn't depend on PostHog being configured.
export function track(event, props = {}) {
  pushDataLayer(event, props);
  capture(event, props);
}

// Tie subsequent events to a known user. Called whenever the auth state resolves
// to a logged-in user (covers email, OTP signup, and Google OAuth paths).
export function identifyUser(user) {
  if (!ready() || !user?.id) return;
  const full = (user.full_name || '').trim();
  const sp = full.indexOf(' ');
  const first_name = sp > 0 ? full.slice(0, sp) : full;
  const last_name = sp > 0 ? full.slice(sp + 1) : '';
  try {
    posthog.identify(String(user.id), {
      email: user.email || undefined,
      name: full || undefined,
      first_name: first_name || undefined,
      last_name: last_name || undefined,
      phone: user.phone || undefined,
      verified: user.verified,
    });
  } catch { /* ignore */ }
}

// Clear identity on logout so the next visitor isn't merged into this person.
export function resetUser() {
  if (!ready()) return;
  try { posthog.reset(); } catch { /* ignore */ }
}
