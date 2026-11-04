import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, samePlace, changedFromGoogle, exactIn, areaIn, cityIs, cityOf, km, FAR_KM, cleanPinSource, zoomFor, plainResult } from '../lib/pinLocate.js';

const comp = (name, ...types) => ({ long_name: name, types });
// Daniel's case: the street Google gave was in Capitán Miranda
const capMiranda = { types: ['route'], components: [comp('Barrio San Jose', 'neighborhood'), comp('Capitán Miranda', 'locality')], lat: -27.2218, lng: -55.8011 };

test('fold / samePlace: accents, case and "Barrio" do not matter', () => {
  assert.equal(fold('Barrio San Pedro'), 'san pedro');
  assert.equal(fold('Encarnación'), 'encarnacion');
  assert.ok(samePlace('Encarnación', 'encarnacion'));
  assert.ok(samePlace('Barrio San Pedro', 'San Pedro'));
  assert.ok(!samePlace('Capitán Miranda', 'Encarnación'));
  assert.ok(!samePlace('', 'Encarnación'));
});

test('changedFromGoogle: only when the seller changed the city or the neighbourhood', () => {
  const geo = { city: 'Capitán Miranda', neighborhood: 'Barrio San Jose' };
  assert.equal(changedFromGoogle(geo, { city: 'Capitan Miranda', neighborhood: 'San Jose' }), false);
  assert.equal(changedFromGoogle(geo, { city: 'Encarnación', neighborhood: 'Barrio San Jose' }), true);
  assert.equal(changedFromGoogle(geo, { city: 'Capitán Miranda', neighborhood: 'San Pedro' }), true);
  assert.equal(changedFromGoogle(null, { city: 'X', neighborhood: 'Y' }), true);
});

test('exactIn: a street is only exact when it is inside the city the seller says', () => {
  assert.equal(exactIn(capMiranda, 'Capitán Miranda'), true);
  assert.equal(exactIn(capMiranda, 'Encarnación'), false);   // Daniel → he must place the pin
  const enc = { types: ['street_address'], components: [comp('Encarnación', 'locality')], lat: -27.31, lng: -55.87 };
  assert.equal(exactIn(enc, 'Encarnación'), true);
  const cityOnly = { types: ['locality', 'political'], components: [comp('Encarnación', 'locality')], lat: -27.33, lng: -55.86 };
  assert.equal(exactIn(cityOnly, 'Encarnación'), false);     // a city is never "exact"
  assert.equal(cityIs(cityOnly, 'Encarnación'), true);
});

test('areaIn: a neighbourhood result counts only inside the right city', () => {
  const sp = { types: ['neighborhood', 'political'], components: [comp('San Pedro', 'neighborhood'), comp('Encarnación', 'locality')], lat: -27.3095, lng: -55.8702 };
  assert.equal(areaIn(sp, 'Encarnación'), true);
  assert.equal(areaIn(sp, 'Asunción'), false);
  assert.equal(areaIn(capMiranda, 'Capitán Miranda'), false);   // a street is not an area
});

test('cityOf falls back to the department level', () => {
  assert.equal(cityOf([comp('Itapúa', 'administrative_area_level_1')]), 'Itapúa');
  assert.equal(cityOf([]), '');
});

test('km: Capitán Miranda pin is ~12 km from San Pedro, Encarnación (beyond nothing, under FAR_KM)', () => {
  const d = km({ lat: -27.2218, lng: -55.8011 }, { lat: -27.3095, lng: -55.8702 });
  assert.ok(d > 10 && d < 13, String(d));
  assert.ok(km({ lat: -25.28, lng: -57.63 }, { lat: -27.33, lng: -55.86 }) > FAR_KM);   // Asunción → Encarnación
});

test('cleanPinSource only accepts known sources', () => {
  assert.equal(cleanPinSource('owner'), 'owner');
  assert.equal(cleanPinSource('approx'), 'approx');
  assert.equal(cleanPinSource('hack'), null);
  assert.equal(cleanPinSource(''), null);
});

test('zoomFor and plainResult', () => {
  assert.equal(zoomFor('area'), 16);
  assert.equal(zoomFor('city'), 13);
  assert.equal(zoomFor('country'), 6);
  const r = plainResult({ types: ['route'], address_components: [], geometry: { location: { lat: () => -27.1, lng: () => -55.2 } } });
  assert.deepEqual([r.lat, r.lng], [-27.1, -55.2]);
});

test('a shop Google returns for a vague text is never "exact" (Daniel: a store in Encarnación)', () => {
  const shop = { types: ['establishment', 'food', 'point_of_interest', 'store'], components: [comp('Encarnacion', 'locality')], lat: -27.31268, lng: -55.86767 };
  assert.equal(exactIn(shop, 'Encarnación'), false);
  const barrio = { types: ['neighborhood', 'political'], components: [comp('San Pedro', 'neighborhood'), comp('Encarnación', 'locality')], lat: -27.30822, lng: -55.86501 };
  assert.equal(areaIn(barrio, 'Encarnación'), true);   // → the map opens at the centre of San Pedro
});
