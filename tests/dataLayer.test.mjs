import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
const { normalizeMode, dataLayerEvent, pushDataLayer, DATALAYER_PARAMS } = await import('../lib/dataLayer.js');
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

test('property_viewed keeps allowed params and drops address / lat / lng', () => {
  const e = dataLayerEvent('property_viewed', {
    property_id: 'abc', slug: 'abc', address: 'Av. España 1234', city: 'Asunción',
    neighborhood: 'Villa Morra', state: 'Central', price: 150000, currency: 'USD',
    mode: 'venta', type: 'casa', lat: -25.28, lng: -57.6,
  });
  assert.equal(e.event, 'property_viewed');
  assert.equal(e.mode, 'sale');
  assert.equal(e.property_id, 'abc');
  assert.equal(e.city, 'Asunción');
  assert.equal(e.price, 150000);
  for (const k of ['address', 'lat', 'lng', 'slug']) assert.equal(k in e, false, k);
});

test('personal data never reaches the dataLayer', () => {
  const e = dataLayerEvent('contact_whatsapp_click', {
    property_id: 'p1', mode: 'alquiler', email: 'a@b.com', phone: '+595981000000', name: 'Ana',
    full_name: 'Ana Pérez', seller_name: 'Juan', seller_phone: '595981', query: 'mi tel 0981', location_name: 'Calle 1',
  });
  assert.equal(e.mode, 'rent');
  assert.equal(e.property_id, 'p1');
  const json = JSON.stringify(e);
  for (const bad of ['a@b.com', '595981', 'Ana', 'Juan', '0981', 'Calle 1']) assert.equal(json.includes(bad), false, bad);
  assert.deepEqual(Object.keys(e).sort(), ['event', ...DATALAYER_PARAMS].sort());
});

test('every allowed key is present so values from earlier events do not linger', () => {
  const e = dataLayerEvent('user_signed_up', { method: 'google' });
  assert.equal(e.method, 'google');
  assert.ok('property_id' in e && e.property_id === undefined);
  assert.ok('mode' in e && e.mode === undefined);
});

test('search_applied derives mode from the operation filter', () => {
  assert.equal(dataLayerEvent('search_applied', { operation: 'alquiler', results_count: 3 }).mode, 'rent');
  assert.equal(dataLayerEvent('search_applied', { operation: 'all' }).mode, undefined);
});

test('pushDataLayer appends to window.dataLayer', () => {
  globalThis.window = {};
  pushDataLayer('property_saved', { property_id: 'x', mode: 'venta' });
  assert.equal(window.dataLayer.length, 1);
  assert.equal(window.dataLayer[0].event, 'property_saved');
  assert.equal(window.dataLayer[0].mode, 'sale');
  delete globalThis.window;
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
