// Stripe server client + Casa Libre publication plan pricing (charged in USD).
import 'server-only';
import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// USD price per plan (mirrors the Publicar plan cards). Stripe amounts are in cents.
export const PLAN_USD = { basico: 10, destacado: 20, premium: 39 };
