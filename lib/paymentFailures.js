// A card declined in the browser (Stripe card form) never reaches our server by itself — the
// pay windows report it to their /confirm route, which records it here as a 'failed'
// payment so the admin's Earnings page shows every attempt, paid or not. One row per
// PaymentIntent + decline (a retried report doesn't duplicate it).
import 'server-only';
import { select } from './db';
import { recordPayment } from './billing';

export const declineOf = (pi) => {
  const e = pi?.last_payment_error;
  return e ? String(e.decline_code || e.code || e.type || 'declined').slice(0, 60) : null;
};

export async function recordDeclineOnce(pi, row) {
  const reason = declineOf(pi);
  if (!reason || !pi?.id) return false;
  const seen = await select('payments', `select=id&stripe_payment_intent_id=eq.${encodeURIComponent(pi.id)}&status=eq.failed&failure_reason=eq.${encodeURIComponent(reason)}&limit=1`).catch(() => []);
  if (seen.length) return false;
  const card = pi.last_payment_error?.payment_method?.card || null;
  await recordPayment({ ...row, status: 'failed', stripe_payment_intent_id: pi.id, failure_reason: reason, card_brand: card?.brand || null, card_last4: card?.last4 || null });
  return true;
}
