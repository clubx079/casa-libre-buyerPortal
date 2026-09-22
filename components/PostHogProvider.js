'use client';
// Initializes PostHog once on the client and records SPA pageviews on route
// change. Renders its children untouched; safe no-op when no key is configured.
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { POSTHOG_KEY, POSTHOG_HOST } from '@/lib/analytics';
import { COUNTRY } from '@/lib/country';

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!POSTHOG_KEY || !posthog.__loaded || typeof window === 'undefined') return;
    let url = window.location.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);
  return null;
}

export default function PostHogProvider({ children }) {
  useEffect(() => {
    if (!POSTHOG_KEY || posthog.__loaded) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,   // we send $pageview manually on route change
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      // Don't create a PostHog "person" for every anonymous visitor. Events are
      // still captured with $ip + geoip (the admin analytics groups anonymous
      // visitors by IP), but a person row is only created once a user logs in
      // and we posthog.identify() them — keeps the Persons list clean.
      person_profiles: 'identified_only',
    });
    // Stamp every event with the country site it came from. One PostHog project
    // serves .com.py / .com.bo / uy / .com.ve, and until now they were only
    // distinguishable by $host — which breaks the moment a domain changes. The
    // admin filters on site_country; site_host stays for cross-checking.
    try {
      posthog.register({ site_country: COUNTRY.code, site_host: typeof window !== 'undefined' ? window.location.host : undefined });
    } catch { /* analytics must never break the page */ }
  }, []);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  );
}
