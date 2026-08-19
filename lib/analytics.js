'use client';
// Thin, safe wrapper around posthog-js. Every call no-ops unless PostHog is
// actually configured (NEXT_PUBLIC_POSTHOG_KEY set) and loaded, so the site
// works identically with or without analytics enabled.
import posthog from 'posthog-js';

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Ingest host (note the "i") for the US cloud. The admin portal queries the
// non-"i" host (https://us.posthog.com).
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

const ready = () => typeof window !== 'undefined' && !!POSTHOG_KEY && posthog.__loaded;

// Capture a product event. Extra props are attached as event properties.
export function track(event, props = {}) {
  if (!ready()) return;
  try { posthog.capture(event, props); } catch { /* never break the UI for analytics */ }
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
