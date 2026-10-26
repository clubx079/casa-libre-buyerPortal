import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanStreet, roomCount, cleanCoords, hasRooms } from '../lib/listingInput.js';
import { cleanDraftData } from '../lib/drafts.js';

test('street: kept when it is a real street, null when empty or just the barrio / city', () => {
  assert.equal(cleanStreet('  Mcal. López   1234 ', { neighborhood: 'Villa Morra', city: 'Asunción' }), 'Mcal. López 1234');
  assert.equal(cleanStreet('Villa Morra', { neighborhood: 'Villa Morra', city: 'Asunción' }), null);
  assert.equal(cleanStreet('asunción', { neighborhood: 'Centro', city: 'Asunción' }), null);
  assert.equal(cleanStreet('', {}), null);
  assert.equal(cleanStreet('ab', {}), null);
  assert.equal(cleanStreet('x'.repeat(300), {}).length, 160);
});

test('bedrooms / bathrooms: whole numbers 0–50 only', () => {
  assert.equal(roomCount('3'), 3);
  assert.equal(roomCount('0'), 0);
  assert.equal(roomCount(''), null);
  assert.equal(roomCount('2.5'), null);
  assert.equal(roomCount('99'), null);
  assert.equal(roomCount('tres'), null);
});

test('only houses / apartments / duplex / condos have rooms', () => {
  for (const t of ['casa', 'depto', 'departamento', 'duplex', 'condominio']) assert.equal(hasRooms(t), true, t);
  for (const t of ['terreno', 'comercial', 'oficina', 'campo', 'otro', '']) assert.equal(hasRooms(t), false, t);
});

test('map position: real numbers in range, never 0,0 or blank', () => {
  assert.deepEqual(cleanCoords('-25.2878', '-57.5799'), { lat: -25.2878, lng: -57.5799 });
  assert.equal(cleanCoords('', ''), null);
  assert.equal(cleanCoords('0', '0'), null);
  assert.equal(cleanCoords('120', '10'), null);
  assert.equal(cleanCoords('abc', '1'), null);
});

test('drafts keep the new fields (street, position, rooms)', () => {
  const d = cleanDraftData({ street: 'Mcal. López 1234', lat: '-25.28', lng: '-57.58', bedrooms: '3', bathrooms: '2', junk: 'x' });
  assert.deepEqual(d, { street: 'Mcal. López 1234', lat: '-25.28', lng: '-57.58', bedrooms: '3', bathrooms: '2' });
});
