// Creates a Stripe PaymentIntent for the chosen publication plan. Requires login.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stripe, PLAN_USD } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });

  const { plan } = await req.json().catch(() => ({}));
  const usd = PLAN_USD[plan];
  if (!usd) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });

  try {
    const pi = await stripe.paymentIntents.create({
      amount: usd * 100, // cents
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { plan, user_id: session.uid, email: session.email, product: 'casa-libre-listing' },
      description: `Casa Libre — publicación plan ${plan}`,
    });
    return NextResponse.json({ clientSecret: pi.client_secret, amount: usd, paymentIntentId: pi.id });
  } catch (e) {
    return NextResponse.json({ error: 'stripe_error', detail: e?.message || String(e) }, { status: 502 });
  }
}
