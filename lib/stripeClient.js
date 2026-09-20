'use client';
// Resolve the Stripe.js instance for the client. Prefers the build-time
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY when it was inlined; otherwise fetches the
// publishable key from /api/stripe/config at RUNTIME (our deploy platform doesn't
// inline NEXT_PUBLIC_* at build). Memoized. Resolves to null when Stripe isn't
// configured anywhere (client then shows a "payments unavailable" state).
import { loadStripe } from '@stripe/stripe-js';

let cached;
export function getStripePromise() {
  if (cached) return cached;
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  cached = pk
    ? loadStripe(pk)
    : fetch('/api/stripe/config')
        .then((r) => r.json())
        .then((j) => (j && j.publishableKey ? loadStripe(j.publishableKey) : null))
        .catch(() => null);
  return cached;
}
