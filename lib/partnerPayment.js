// Back from Stripe Checkout on a service-partner page: is this session really paid for this
// partner? The first time a paid session is seen it is recorded (PostHog) and the team is
// emailed; the subscription's metadata gets notified=1 so a reload doesn't do it twice.
// Dependencies are passed in (stripe client, capture, notify) so it can be tested in plain Node.

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
export const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;
export const cleanId = (v) => (/^[A-Za-z0-9:_.$-]{6,120}$/.test(String(v || '')) ? String(v) : '');

export async function confirmPayment({ stripe, capture, notify }, partner, sessionId) {
  if (!stripe || !SESSION_ID_RE.test(String(sessionId || ''))) return { paid: false };
  let s;
  try { s = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription', 'customer_details'] }); }
  catch { return { paid: false }; }
  if (s?.metadata?.partner !== partner.slug) return { paid: false };
  const paid = s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required');
  if (!paid) return { paid: false };
  const sub = s.subscription && typeof s.subscription === 'object' ? s.subscription : null;
  const email = s.customer_details?.email || '';
  const name = s.customer_details?.name || '';
  const amount = (s.amount_total || 0) / 100;
  let first = false;
  if (sub && sub.metadata?.notified !== '1') {
    first = true;
    try { await stripe.subscriptions.update(sub.id, { metadata: { ...sub.metadata, notified: '1' } }); } catch { /* still notify */ }
    const utm = Object.fromEntries(UTM_KEYS.filter((k) => s.metadata?.[k]).map((k) => [k, s.metadata[k]]));
    await capture('partner_payment_completed', cleanId(s.metadata?.ph_distinct_id), {
      partner: partner.slug, amount_usd: amount, session_id: s.id, subscription_id: sub.id, livemode: !!s.livemode, ...utm,
    });
    await notify(partner, { email, name, amount, sub: sub.id, livemode: !!s.livemode });
  }
  return { paid: true, email, first };
}
