// GET /api/promo/renew?token=… — one-click renewal from the day-29 reminder email.
// The signed token names the property/user/plan; we re-check ownership, charge the
// vaulted card off-session for another 30 days, extend the promotion, and log it to
// the transaction history. Renders a small branded confirmation page (it's opened in
// a browser from the inbox). If the card needs authentication or none is saved, we
// bounce to /cuenta/pagos to finish there.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { select } from '@/lib/db';
import { stripe, promoPlan, promoCents, promoUsd, PROMO } from '@/lib/stripe';
import { getUserBillingRow, ensureStripeCustomer, grantPromotion, recordPayment } from '@/lib/billing';
import { verifyRenewToken } from '@/lib/promoToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = (process.env.APP_PUBLIC_URL || 'https://casa-libre.com.py').replace(/\/$/, '');

function page({ title, body, cta }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
  <body style="margin:0;background:#f9f4ee;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;color:#111">
    <div style="max-width:460px;margin:8vh auto;padding:0 20px">
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.03em;margin-bottom:22px">casa-libre<span style="font-style:italic">.py</span></div>
      <div style="background:#fff;border:1.5px solid rgba(17,17,17,.12);border-radius:20px;padding:28px 26px">
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">${title}</div>
        <div style="font-size:14px;color:rgba(17,17,17,.65);margin-top:10px;line-height:1.6">${body}</div>
        ${cta ? `<div style="margin-top:20px"><a href="${cta.href}" style="display:inline-block;background:#111;color:#f9f4ee;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px">${cta.label}</a></div>` : ''}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(17,17,17,.4);margin-top:16px">Casa Libre — Paraguay</div>
    </div>
  </body></html>`;
}
const html = (s, status = 200) => new NextResponse(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token');
  const claim = verifyRenewToken(token);
  if (!claim) return html(page({ title: 'Enlace no válido', body: 'Este enlace de renovación venció o no es válido. Podés renovar desde tu cuenta.', cta: { href: `${SITE}/cuenta/pagos`, label: 'Ir a mi cuenta' } }), 400);

  const plan = promoPlan(claim.plan);
  const { pid, uid } = claim;

  if (!stripe) return html(page({ title: 'No disponible', body: 'El pago no está configurado. Intentá más tarde.', }), 500);

  // Ownership re-check (never trust the token alone for the mutation).
  const rows = await select('properties', `select=id,created_by,property_type,neighborhood,promotion_plan,promotion_expires_at&id=eq.${encodeURIComponent(pid)}&limit=1`).catch(() => []);
  const prop = Array.isArray(rows) && rows[0];
  if (!prop || String(prop.created_by) !== String(uid)) {
    return html(page({ title: 'No encontrada', body: 'No pudimos encontrar esta propiedad en tu cuenta.', cta: { href: `${SITE}/cuenta/pagos`, label: 'Ir a mi cuenta' } }), 404);
  }

  // Idempotency: if a renewal for this property already succeeded in the last 10 min
  // (e.g. an email scanner pre-fetched the link, or a double click), don't charge again.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recent = await select('payments', `select=id,highlight_until&property_id=eq.${encodeURIComponent(pid)}&kind=eq.renewal&status=eq.succeeded&created_at=gt.${encodeURIComponent(since)}&limit=1`).catch(() => []);
  if (Array.isArray(recent) && recent[0]) {
    return html(page({ title: '¡Ya está renovada!', body: `Tu propiedad ya fue renovada por 30 días más bajo el plan ${PROMO[plan].label.es}.`, cta: { href: `${SITE}/cuenta/publicaciones`, label: 'Ver mis publicaciones' } }));
  }

  const user = await getUserBillingRow(uid);
  if (!user) return html(page({ title: 'Cuenta no encontrada', body: 'No pudimos cargar tu cuenta.', cta: { href: `${SITE}/cuenta/pagos`, label: 'Ir a mi cuenta' } }), 404);

  // No saved card → finish in the account page.
  if (!user.card_pm_id) {
    return NextResponse.redirect(`${SITE}/cuenta/pagos?renew=${encodeURIComponent(pid)}&plan=${plan}`, 302);
  }

  let customerId;
  try { customerId = await ensureStripeCustomer(user); }
  catch { return NextResponse.redirect(`${SITE}/cuenta/pagos?renew=${encodeURIComponent(pid)}&plan=${plan}`, 302); }

  const usd = promoUsd(plan);
  try {
    const pi = await stripe.paymentIntents.create({
      amount: promoCents(plan), currency: 'usd', customer: customerId,
      payment_method: user.card_pm_id, off_session: true, confirm: true,
      metadata: { user_id: String(uid), property_id: String(pid), product: 'casa-libre-promo', plan, kind: 'renewal' },
      description: plan === 'home' ? 'Casa Libre — renovar portada (30 días)' : 'Casa Libre — renovar verificación (30 días)',
    });
    if (pi.status === 'succeeded') {
      const until = await grantPromotion(pid, plan, { extendFrom: prop.promotion_expires_at });
      await recordPayment({ user_id: uid, property_id: pid, kind: 'renewal', plan, amount_usd: usd, currency: 'usd', status: 'succeeded', stripe_payment_intent_id: pi.id, card_brand: user.card_brand, card_last4: user.card_last4, highlight_until: until });
      try { revalidateTag('listings'); } catch {}
      const untilEs = new Date(until).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' });
      return html(page({ title: '¡Renovada por 30 días!', body: `Cobramos US$${usd} a tu tarjeta terminada en ${user.card_last4 || '••••'}. Tu propiedad seguirá ${plan === 'home' ? 'en la portada y verificada' : 'verificada'} hasta el ${untilEs}.`, cta: { href: `${SITE}/cuenta/publicaciones`, label: 'Ver mis publicaciones' } }));
    }
    // Needs authentication → finish in the account page.
    return NextResponse.redirect(`${SITE}/cuenta/pagos?renew=${encodeURIComponent(pid)}&plan=${plan}`, 302);
  } catch (e) {
    const piErr = e?.raw?.payment_intent || e?.payment_intent;
    if ((e?.code === 'authentication_required' || e?.raw?.code === 'authentication_required') && piErr) {
      return NextResponse.redirect(`${SITE}/cuenta/pagos?renew=${encodeURIComponent(pid)}&plan=${plan}`, 302);
    }
    await recordPayment({ user_id: uid, property_id: pid, kind: 'renewal', plan, amount_usd: usd, currency: 'usd', status: 'failed', stripe_payment_intent_id: piErr?.id || null, card_brand: user.card_brand, card_last4: user.card_last4, failure_reason: (e?.decline_code || e?.code || 'error') });
    return html(page({ title: 'No se pudo cobrar', body: 'Tu tarjeta fue rechazada o no se pudo procesar el pago. Podés reintentar desde tu cuenta.', cta: { href: `${SITE}/cuenta/pagos?renew=${encodeURIComponent(pid)}&plan=${plan}`, label: 'Reintentar en mi cuenta' } }), 402);
  }
}
