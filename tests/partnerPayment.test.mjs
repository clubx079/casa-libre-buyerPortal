import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmPayment, cleanId } from '../lib/partnerPayment.js';
import { PARTNERS, waLink } from '../lib/partners.js';

const partner = PARTNERS['casa-limpia'];
const SID = 'cs_test_abc123';

function fakes(session) {
  const calls = { capture: [], notify: [], update: [] };
  const sub = session?.subscription;
  const stripe = {
    checkout: { sessions: { retrieve: async (id) => { if (id !== SID) throw new Error('no such session'); return session; } } },
    subscriptions: { update: async (id, { metadata }) => { calls.update.push(id); if (sub) sub.metadata = metadata; } },
  };
  return {
    calls,
    deps: { stripe, capture: async (...a) => calls.capture.push(a), notify: async (...a) => calls.notify.push(a) },
  };
}
const paidSession = () => ({
  id: SID, status: 'complete', payment_status: 'paid', amount_total: 4900, livemode: false,
  metadata: { partner: 'casa-limpia', ph_distinct_id: 'ph-visitor-1', utm_campaign: 'socios_casa_limpia', utm_source: 'email' },
  customer_details: { email: 'hola@casa-limpia.com.py', name: 'Tomas' },
  subscription: { id: 'sub_1', metadata: { partner: 'casa-limpia' } },
});

test('paid session: confirmed, tracked and the team emailed exactly once', async () => {
  const { deps, calls } = fakes(paidSession());
  const r1 = await confirmPayment(deps, partner, SID);
  assert.deepEqual(r1, { paid: true, email: 'hola@casa-limpia.com.py', first: true });
  assert.equal(calls.capture.length, 1);
  const [event, id, props] = calls.capture[0];
  assert.equal(event, 'partner_payment_completed');
  assert.equal(id, 'ph-visitor-1');
  assert.equal(props.amount_usd, 49);
  assert.equal(props.utm_campaign, 'socios_casa_limpia');
  assert.equal(calls.notify.length, 1);
  assert.equal(calls.notify[0][1].amount, 49);
  // reload of the success page: still paid, no second email/event
  const r2 = await confirmPayment(deps, partner, SID);
  assert.equal(r2.paid, true);
  assert.equal(r2.first, false);
  assert.equal(calls.notify.length, 1);
  assert.equal(calls.capture.length, 1);
});

test('unpaid, foreign or bogus sessions are not treated as paid', async () => {
  const open = { ...paidSession(), status: 'open', payment_status: 'unpaid' };
  assert.equal((await confirmPayment(fakes(open).deps, partner, SID)).paid, false);
  const other = { ...paidSession(), metadata: { partner: 'someone-else' } };
  assert.equal((await confirmPayment(fakes(other).deps, partner, SID)).paid, false);
  const { deps, calls } = fakes(paidSession());
  assert.equal((await confirmPayment(deps, partner, 'cs_test_unknown')).paid, false);
  assert.equal((await confirmPayment(deps, partner, '../etc')).paid, false);
  assert.equal((await confirmPayment({ ...deps, stripe: null }, partner, SID)).paid, false);
  assert.equal(calls.notify.length, 0);
});

test('cleanId keeps PostHog ids and drops junk', () => {
  assert.equal(cleanId('0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'), '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
  assert.equal(cleanId('<script>'), '');
  assert.equal(cleanId(''), '');
});

test('CasaLimpia data: business WhatsApp link and US$49 monthly plan', () => {
  assert.match(waLink(partner, 'es'), /^https:\/\/wa\.me\/595972993999\?text=Hola%20CasaLimpia/);
  assert.deepEqual(partner.plan, { usd: 49, cents: 4900, listUsd: 99, interval: 'month' });
});
