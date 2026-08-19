'use client';
// Initializes PostHog once on the client and records SPA pageviews on route
// change. Renders its children untouched; safe no-op when no key is configured.
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { POSTHOG_KEY, POSTHOG_HOST } from '@/lib/analytics';

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
    });
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
