// Server side of the service-partner pages (casa-libre.com.py/<slug>): Stripe Checkout for the
// founding-partner subscription, the payment check on the way back from Stripe, PostHog events
// and the "partner paid" email to the team.
import 'server-only';
import { stripe } from '@/lib/stripe';
import { COUNTRY_CODE } from '@/lib/country';
import { sendRenderedEmail } from '@/lib/email';
import { PARTNER_COUNTRIES } from '@/lib/partners';
import { confirmPayment, cleanId, UTM_KEYS } from '@/lib/partnerPayment';

export { cleanId, UTM_KEYS };

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const partnerPagesOn = () => PARTNER_COUNTRIES.includes(COUNTRY_CODE);

export const isBot = (ua = '') => /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|curl|wget|headless|safelinks|proofpoint|mimecast|barracuda/i.test(ua);

// Server-side PostHog event. Never throws, never blocks longer than 3 s.
export async function phCapture(event, distinctId, props = {}) {
  if (!PH_KEY) return;
  try {
    await fetch(`${PH_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        api_key: PH_KEY,
        event,
        distinct_id: distinctId || `partner:${props.partner || 'unknown'}`,
        properties: { site_country: COUNTRY_CODE, $process_person_profile: false, ...props },
      }),
    });
  } catch { /* analytics never breaks payments */ }
}

// Stripe Checkout session for the monthly founding-partner plan.
export async function createPartnerCheckout(partner, { origin, distinctId, utm = {} }) {
  if (!stripe) throw new Error('stripe_not_configured');
  const meta = { kind: 'service_partner', partner: partner.slug, country: COUNTRY_CODE, ph_distinct_id: distinctId || '', ...utm };
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    locale: 'es',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: partner.plan.cents,
        recurring: { interval: partner.plan.interval },
        product_data: {
          name: `Casa-Libre · Socio fundador · ${partner.name}`,
          description: 'Perfil de empresa en Casa-Libre y presencia en las publicaciones de propiedades. Sin permanencia.',
        },
      },
    }],
    subscription_data: { metadata: meta, description: `Socio fundador · ${partner.name}` },
    metadata: meta,
    client_reference_id: partner.slug,
    custom_text: { submit: { message: 'Después del pago, envíennos su logo y los textos y su perfil queda activo en Casa-Libre.' } },
    success_url: `${origin}/${partner.slug}?pago=ok&session_id={CHECKOUT_SESSION_ID}#precio`,
    cancel_url: `${origin}/${partner.slug}?pago=cancelado#precio`,
  });
}

// Back from Stripe: see lib/partnerPayment.js.
export const confirmPartnerPayment = (partner, sessionId) =>
  confirmPayment({ stripe, capture: phCapture, notify: notifyTeam }, partner, sessionId);

async function notifyTeam(partner, { email, name, amount, sub, livemode }) {
  const to = process.env.PARTNER_PAYMENT_EMAIL || process.env.PARTNER_INQUIRY_EMAIL || process.env.CONTACT_EMAIL;
  if (!to) return;
  const test = livemode ? '' : ' [PRUEBA]';
  const rows = [
    ['Empresa', partner.name], ['Plan', `Socio fundador · US$${amount} por mes`],
    ['Pagó', [name, email].filter(Boolean).join(' · ') || '—'], ['Suscripción Stripe', sub],
  ];
  const html = `<div style="font-family:Arial,sans-serif;color:#111;font-size:15px;line-height:1.5">
<p><b>${partner.name} pagó el plan de socio fundador${test}.</b></p>
<table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#666">${k}</td><td style="padding:4px 0">${String(v).replace(/</g, '&lt;')}</td></tr>`).join('')}</table>
<p>Próximo paso: pedirles el logo y los textos y activar el perfil.</p></div>`;
  await sendRenderedEmail({ to, subject: `${partner.name} pagó: socio fundador US$${amount}/mes${test}`, html, text: rows.map((r) => r.join(': ')).join('\n') });
}
