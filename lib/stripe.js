// Stripe server client + Casa Libre publication plan pricing (charged in USD).
import 'server-only';
import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// USD price per plan (mirrors the Publicar plan cards). Stripe amounts are in cents.
export const PLAN_USD = { basico: 10, destacado: 20, premium: 39 };

// Two paid promotion plans (one-time, 30 days). Free publishing is unchanged; opt-in.
//   • verified — US$5  → "Verified" badge + a star map-pin that never hides in a
//                        cluster. NORMAL order (not floated to the top of the list).
//   • home     — US$20 → everything in verified + the listing shows on the landing page.
// home ⊃ verified: both are "promoted" (Verified badge + map star); only home hits the home page.
export const PROMO_DAYS = 30;
export const PROMO = {
  verified: { plan: 'verified', usd: 5, cents: 500, label: { es: 'Verificada', en: 'Verified' } },
  home: { plan: 'home', usd: 20, cents: 2000, label: { es: 'En la portada', en: 'On the landing page' } },
};
export const isPromoPlan = (p) => p === 'verified' || p === 'home';
export const promoPlan = (p) => (isPromoPlan(p) ? p : 'verified');
export const promoCents = (p) => PROMO[promoPlan(p)].cents;
export const promoUsd = (p) => PROMO[promoPlan(p)].usd;

// Back-compat aliases (the old single-tier highlight == the new "verified" plan).
export const HIGHLIGHT_USD = PROMO.verified.usd;
export const HIGHLIGHT_CENTS = PROMO.verified.cents;
export const HIGHLIGHT_DAYS = PROMO_DAYS;
