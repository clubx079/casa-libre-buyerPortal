// POST /api/highlight/create-intent — start a paid promotion for one of the user's
// properties under a plan ('verified' = US$5 | 'home' = US$20). Two paths: (1) one-click
// charge on the saved card (off_session), or (2) a fresh PaymentIntent whose card the
// client confirms + we vault for next time. Requires login + ownership; the property must
// be active/complete and not already currently promoted.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { select } from '@/lib/db';
import { stripe, promoPlan, promoCents, promoUsd, PROMO } from '@/lib/stripe';
import { getUserBillingRow, ensureStripeCustomer, grantPromotion, recordPayment } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Map a Stripe error to a short Spanish message for the user.
function friendly(e) {
  const code = e?.decline_code || e?.code || e?.raw?.decline_code || e?.raw?.code;
  if (code === 'insufficient_funds') return 'Fondos insuficientes en la tarjeta.';
  if (code === 'card_declined' || code === 'generic_decline') return 'La tarjeta fue rechazada.';
  if (code === 'expired_card') return 'La tarjeta está vencida.';
  if (code === 'incorrect_cvc') return 'El código de seguridad (CVC) es incorrecto.';
  if (code === 'processing_error') return 'Hubo un error al procesar la tarjeta. Intentá de nuevo.';
  return e?.message || 'El pago no pudo completarse.';
}

export async function POST(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const { propertyId, useSavedCard } = body;
  const plan = promoPlan(body.plan);        // 'verified' | 'home' (defaults to verified)
  const cents = promoCents(plan);
  const usd = promoUsd(plan);
  if (!propertyId) return NextResponse.json({ error: 'missing_property' }, { status: 400 });

  // Ownership + publishability + not-already-promoted.
  const rows = await select('properties', `select=id,created_by,admin_status,is_complete,promotion_plan,promotion_expires_at&id=eq.${encodeURIComponent(propertyId)}&limit=1`).catch(() => []);
  const prop = Array.isArray(rows) && rows[0];
  if (!prop) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (String(prop.created_by) !== String(session.uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (prop.admin_status !== 'active' || prop.is_complete === false) return NextResponse.json({ error: 'not_publishable' }, { status: 400 });
  if (prop.promotion_plan && prop.promotion_expires_at && new Date(prop.promotion_expires_at) > new Date()) {
    return NextResponse.json({ error: 'already_promoted', plan: prop.promotion_plan, promotionUntil: prop.promotion_expires_at }, { status: 400 });
  }

  const user = await getUserBillingRow(session.uid);
  if (!user) return NextResponse.json({ error: 'no_user' }, { status: 400 });
  let customerId;
  try { customerId = await ensureStripeCustomer(user); }
  catch (e) { return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 }); }

  const metadata = { user_id: String(session.uid), property_id: String(propertyId), product: 'casa-libre-promo', plan };
  const description = plan === 'home'
    ? 'Casa Libre — destacar en la portada (30 días)'
    : 'Casa Libre — propiedad verificada (30 días)';

  // (1) One-click: charge the saved card immediately, off-session.
  if (useSavedCard && user.card_pm_id) {
    try {
      const pi = await stripe.paymentIntents.create({
        amount: cents, currency: 'usd', customer: customerId,
        payment_method: user.card_pm_id, off_session: true, confirm: true,
        metadata, description,
      });
      if (pi.status === 'succeeded') {
        const until = await grantPromotion(propertyId, plan);
        await recordPayment({ user_id: session.uid, property_id: propertyId, kind: 'highlight', plan, amount_usd: usd, currency: 'usd', status: 'succeeded', stripe_payment_intent_id: pi.id, card_brand: user.card_brand, card_last4: user.card_last4, highlight_until: until });
        try { revalidateTag('listings'); } catch {}
        return NextResponse.json({ status: 'succeeded', plan, promotionUntil: until, card: { brand: user.card_brand, last4: user.card_last4 } });
      }
      if (pi.status === 'requires_action' || pi.status === 'requires_confirmation') {
        return NextResponse.json({ status: 'requires_action', clientSecret: pi.client_secret, paymentIntentId: pi.id, plan });
      }
      await recordPayment({ user_id: session.uid, property_id: propertyId, kind: 'highlight', plan, amount_usd: usd, currency: 'usd', status: 'failed', stripe_payment_intent_id: pi.id, card_brand: user.card_brand, card_last4: user.card_last4, failure_reason: pi.status });
      return NextResponse.json({ status: 'failed', error: 'El pago no se completó.' });
    } catch (e) {
      const pi = e?.raw?.payment_intent || e?.payment_intent;
      if ((e?.code === 'authentication_required' || e?.raw?.code === 'authentication_required') && pi?.client_secret) {
        return NextResponse.json({ status: 'requires_action', clientSecret: pi.client_secret, paymentIntentId: pi.id, plan });
      }
      await recordPayment({ user_id: session.uid, property_id: propertyId, kind: 'highlight', plan, amount_usd: usd, currency: 'usd', status: 'failed', stripe_payment_intent_id: pi?.id || null, card_brand: user.card_brand, card_last4: user.card_last4, failure_reason: (e?.decline_code || e?.code || 'error') });
      return NextResponse.json({ status: 'failed', error: friendly(e) });
    }
  }

  // (2) New card: create the PI and save the card for future one-click reuse. The
  // client confirms it with the Payment Element, then calls /confirm to grant.
  try {
    const pi = await stripe.paymentIntents.create({
      amount: cents, currency: 'usd', customer: customerId,
      setup_future_usage: 'off_session', payment_method_types: ['card'],
      metadata, description,
    });
    return NextResponse.json({ status: 'requires_payment', clientSecret: pi.client_secret, paymentIntentId: pi.id, amount: usd, plan });
  } catch (e) {
    return NextResponse.json({ error: 'stripe_error', detail: e?.message }, { status: 502 });
  }
}
