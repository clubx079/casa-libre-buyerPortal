import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
const { normalizeMode, dataLayerEvent, pushDataLayer, isOwnerEvent, DATALAYER_PARAMS } = await import('../lib/dataLayer.js');
const { consumeSignupSignal, SIGNUP_COOKIE } = await import('../lib/signupSignal.js');

test('mode maps venta/alquiler to sale/rent', () => {
  assert.equal(normalizeMode('venta'), 'sale');
  assert.equal(normalizeMode('alquiler'), 'rent');
  assert.equal(normalizeMode('Venta'), 'sale');
  assert.equal(normalizeMode('sale'), 'sale');
  assert.equal(normalizeMode('rent'), 'rent');
  assert.equal(normalizeMode('all'), undefined);
  assert.equal(normalizeMode(undefined), undefined);
});

test('property_viewed matches the agency table and drops address / lat / lng', () => {
  const e = dataLayerEvent('property_viewed', {
    property_id: 'abc', slug: 'abc', address: 'Av. España 1234', city: 'Asunción',
    neighborhood: 'Villa Morra', state: 'Central', price: 150000, currency: 'USD',
    mode: 'venta', type: 'casa', lat: -25.28, lng: -57.6,
  }, 'py');
  assert.equal(e.event, 'property_viewed');
  assert.equal(e.mode, 'sale');
  assert.equal(e.property_id, 'abc');
  assert.equal(e.property_type, 'casa');
  assert.equal(e.city, 'Asunción');
  assert.equal(e.price, 150000);
  assert.equal(e.site_country, 'py');
  for (const k of ['address', 'lat', 'lng', 'slug', 'state', 'type']) assert.equal(k in e, false, k);
});

test('contact events carry listing_ref (from ref)', () => {
  const e = dataLayerEvent('contact_call_click', { ref: 'CL-123', property_id: 'p', mode: 'alquiler' }, 'py');
  assert.equal(e.listing_ref, 'CL-123');
  assert.equal(e.mode, 'rent');
  assert.equal('ref' in e, false);
});

test('personal data never reaches the dataLayer', () => {
  const e = dataLayerEvent('contact_whatsapp_click', {
    property_id: 'p1', mode: 'alquiler', email: 'a@b.com', phone: '+595981000000', name: 'Ana',
    full_name: 'Ana Pérez', seller_name: 'Juan', seller_phone: '595981', query: 'mi tel 0981', location_name: 'Calle 1',
  }, 'py');
  assert.equal(e.mode, 'rent');
  assert.equal(e.property_id, 'p1');
  const json = JSON.stringify(e);
  for (const bad of ['a@b.com', '595981', 'Ana', 'Juan', '0981', 'Calle 1']) assert.equal(json.includes(bad), false, bad);
  assert.deepEqual(Object.keys(e).sort(), ['event', ...DATALAYER_PARAMS].sort());
});

test('every allowed key is present so values from earlier events do not linger', () => {
  const e = dataLayerEvent('user_signed_up', { method: 'google' }, 'py');
  assert.equal(e.method, 'google');
  assert.equal(e.site_country, 'py');
  assert.ok('property_id' in e && e.property_id === undefined);
  assert.ok('mode' in e && e.mode === undefined);
});

test('search_applied derives mode from the operation filter', () => {
  assert.equal(dataLayerEvent('search_applied', { operation: 'alquiler', results_count: 3 }).mode, 'rent');
  assert.equal(dataLayerEvent('search_applied', { operation: 'all' }).mode, undefined);
});

test('owner-side events are not pushed', () => {
  for (const ev of ['listing_created', 'sell_wizard_opened', 'sell_otp_sent', 'sell_otp_verified']) assert.equal(isOwnerEvent(ev), true, ev);
  for (const ev of ['property_viewed', 'contact_call_click', 'user_signed_up', 'search_applied']) assert.equal(isOwnerEvent(ev), false, ev);
});

test('pushDataLayer appends buyer events with site_country, skips owner events', () => {
  globalThis.window = { __CL_COUNTRY__: 'bo' };
  pushDataLayer('property_saved', { property_id: 'x', mode: 'venta' });
  pushDataLayer('listing_created', { property_id: 'y', operation: 'venta' });
  assert.equal(window.dataLayer.length, 1);
  assert.equal(window.dataLayer[0].event, 'property_saved');
  assert.equal(window.dataLayer[0].mode, 'sale');
  assert.equal(window.dataLayer[0].site_country, 'bo');
  delete globalThis.window;
});

test('neighborhood / city with a number (street address fallback) are dropped', () => {
  const e = dataLayerEvent('property_viewed', { neighborhood: 'Av. España 1234', city: 'Asunción', mode: 'venta' });
  assert.equal(e.neighborhood, undefined);
  assert.equal(e.city, 'Asunción');
  assert.equal(dataLayerEvent('x', { neighborhood: 'Villa Morra' }).neighborhood, 'Villa Morra');
  assert.equal(dataLayerEvent('x', { city: 'Calle 25 de Mayo 300' }).city, undefined);
});

test('priceBand turns filter bounds into a readable US$ band', async () => {
  const { priceBand } = await import('../lib/dataLayer.js');
  assert.equal(priceBand({}), 'all');
  assert.equal(priceBand({ priceMax: 100000 }), '0-100000');
  assert.equal(priceBand({ priceMin: 100000, priceMax: 200000 }), '100000-200000');
  assert.equal(priceBand({ priceMin: 200000 }), '200000+');
  assert.equal(dataLayerEvent('search_applied', { price_range: priceBand({}) }).price_range, undefined);
});

test("filter value 'all' is sent as undefined", () => {
  const e = dataLayerEvent('search_applied', { operation: 'all', property_type: 'all', price_range: 'all', bedrooms: 'all', results_count: 12 });
  assert.equal(e.property_type, undefined);
  assert.equal(e.price_range, undefined);
  assert.equal(e.bedrooms, undefined);
  assert.equal(e.results_count, 12);
});

test('GTM id must be a well-formed container id', async () => {
  process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TJZM7Z9C';
  assert.equal((await import('../lib/dataLayer.js?ok')).GTM_ID, 'GTM-TJZM7Z9C');
  process.env.NEXT_PUBLIC_GTM_ID = 'GTM-X</script><script>alert(1)';
  assert.equal((await import('../lib/dataLayer.js?bad')).GTM_ID, '');
  process.env.NEXT_PUBLIC_GTM_ID = '';
  assert.equal((await import('../lib/dataLayer.js?empty')).GTM_ID, '');
  process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
});

test('signup signal is read once, then cleared', () => {
  let cookie = `foo=1; ${SIGNUP_COOKIE}=google; bar=2`;
  const doc = {
    get cookie() { return cookie; },
    set cookie(v) { if (v.startsWith(`${SIGNUP_COOKIE}=;`)) cookie = 'foo=1; bar=2'; },
  };
  assert.equal(consumeSignupSignal(doc), 'google');
  assert.equal(consumeSignupSignal(doc), null);
  assert.equal(consumeSignupSignal({ cookie: `${SIGNUP_COOKIE}=<script>`, set cookie(v) {} }), null);
});
