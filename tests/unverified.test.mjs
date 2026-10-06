import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looseFor, unverifiedFields, hideUnverified, contactSellerFor, unverifiedNote, isUnverified } from '../lib/unverified.js';
import { isCompleteListing } from '../lib/completeness.js';

const sale = (o = {}) => ({ mode: 'venta', usd: 150000, pyg: 150000 * 7300, beds: 3, baths: 2, parking: 1, covered: 180, lot: 360, area: 180, type: 'Casa', contact_phone: '595981000000', city: 'Asunción', neighborhood: 'Villa Morra', ...o });
const rent = (o = {}) => sale({ mode: 'alquiler', usd: 800, pyg: 800 * 7300, ...o });

test('every Casa Libre country uses the looser rule; unknown ones stay strict', () => {
  assert.equal(looseFor('py'), true);
  assert.equal(looseFor('PY'), true);
  for (const cc of ['bo', 'uy', 've', 'BO']) assert.equal(looseFor(cc), true);
  for (const cc of ['ar', '', undefined]) assert.equal(looseFor(cc), false);
});

test('a listing whose data all checks out has nothing unverified', () => {
  assert.deepEqual(unverifiedFields(sale()), []);
  assert.deepEqual(unverifiedFields(rent()), []);
  assert.equal(hideUnverified(sale()).unverified, undefined);
});

test('price: missing, too low, absurdly high, or a sale price on a rental', () => {
  assert.deepEqual(unverifiedFields(sale({ usd: null, pyg: null })), ['price']);
  assert.deepEqual(unverifiedFields(sale({ usd: 3000, pyg: 3000 * 7300 })), ['price']);
  assert.deepEqual(unverifiedFields(sale({ usd: 60000000, pyg: 1 })), ['price']);
  assert.deepEqual(unverifiedFields(rent({ usd: 20, pyg: 150000 })), ['price']);           // under ₲ 300,000/month
  assert.deepEqual(unverifiedFields(rent({ usd: 165000, pyg: 165000 * 7300 })), ['price']); // sale price on a rental
});

test('area, bedrooms, bathrooms and parking out of range', () => {
  assert.deepEqual(unverifiedFields(sale({ covered: 9000 })), ['area']);
  assert.deepEqual(unverifiedFields(sale({ covered: 2 })), ['area']);
  assert.deepEqual(unverifiedFields(sale({ type: 'Terreno', covered: 9000 })), []);   // land: built area doesn't apply
  assert.deepEqual(unverifiedFields(sale({ beds: 25, baths: 12, parking: 40 })), ['bedrooms', 'bathrooms', 'parking']);
});

test('hideUnverified blanks exactly the fields it could not verify', () => {
  const l = hideUnverified(sale({ usd: 3000, pyg: 3000 * 7300, price: 3000, beds: 25, covered: 9000 }));
  assert.deepEqual(l.unverified, ['price', 'area', 'bedrooms']);
  assert.equal(l.usd, null); assert.equal(l.pyg, null); assert.equal(l.price, null);
  assert.equal(l.beds, null); assert.equal(l.covered, null);
  assert.equal(l.area, 360);   // built area unknown → land area still shown
  assert.equal(l.baths, 2); assert.equal(l.parking, 1);   // verified fields untouched
  assert.ok(isUnverified(l, 'price') && !isUnverified(l, 'bathrooms'));
});

test('the gate: strict everywhere else, Paraguay holds back only missing contact or location', () => {
  const bad = sale({ usd: 3000, pyg: 3000 * 7300, beds: 25 });
  assert.equal(isCompleteListing(bad), false);
  assert.equal(isCompleteListing(bad, { loose: false }), false);
  assert.equal(isCompleteListing(bad, { loose: true }), true);
  assert.equal(isCompleteListing(sale({ contact_phone: null }), { loose: true }), false);
  assert.equal(isCompleteListing(sale({ city: null, neighborhood: null }), { loose: true }), false);
  // Array.filter passes an index as the 2nd argument — must read as strict
  assert.deepEqual([bad, sale()].filter(isCompleteListing).length, 1);
});

test('"Contact seller for …" lines and the fine-print note, in English and Spanish', () => {
  assert.equal(contactSellerFor('price', 'en'), 'Contact seller for price');
  assert.equal(contactSellerFor('price', 'es'), 'Consultá el precio con el vendedor');
  assert.equal(contactSellerFor('bedrooms', 'en'), 'Contact seller for bedrooms');
  assert.equal(unverifiedNote(['price'], 'en'), 'Our system could not verify the correct price of this property. Please contact the seller directly.');
  assert.equal(unverifiedNote(['price', 'area'], 'en'), 'Our system could not verify the correct price and area of this property. Please contact the seller directly.');
  assert.equal(unverifiedNote(['price', 'area', 'bedrooms'], 'en'), 'Our system could not verify the correct price, area and number of bedrooms of this property. Please contact the seller directly.');
  assert.equal(unverifiedNote(['price'], 'es'), 'Nuestro sistema no pudo verificar el precio correcto de esta propiedad. Por favor, contactá directamente al vendedor.');
  assert.equal(unverifiedNote(['bedrooms', 'parking'], 'es'), 'Nuestro sistema no pudo verificar la cantidad correcta de dormitorios y la cantidad correcta de cocheras de esta propiedad. Por favor, contactá directamente al vendedor.');
  assert.equal(unverifiedNote([], 'en'), '');
  assert.equal(unverifiedNote(undefined, 'es'), '');
});
