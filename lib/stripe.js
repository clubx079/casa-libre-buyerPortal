// Stripe server client + Casa Libre publication plan pricing (charged in USD).
import 'server-only';
import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// USD price per plan (mirrors the Publicar plan cards). Stripe amounts are in cents.
export const PLAN_USD = { basico: 10, destacado: 20, premium: 39 };

// Highlight ("Destacar") — a flat one-time fee that features a property on top of
// the marketplace + home for 30 days. Free publishing is unchanged; this is opt-in.
export const HIGHLIGHT_USD = 5;
export const HIGHLIGHT_CENTS = HIGHLIGHT_USD * 100;
export const HIGHLIGHT_DAYS = 30;
