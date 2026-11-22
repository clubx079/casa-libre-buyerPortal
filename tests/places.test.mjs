import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlaceIndex, suggestPlaces, exactPlace, placeSubtitle, soundKey, titleCase, editDistance, nameScore,
  matchRange, addRecent, ASUNCION_BARRIOS, compactIndex, hydrateIndex,
} from '../lib/places.js';
import { placeParts, placeColumns, atUnknownSpot } from '../lib/placeFilter.js';
import { searchBounds } from '../lib/areaGeom.js';

// Shaped like the real feed: in Asunción the barrio sits in `city` and "Asunción" in `province`.
let n = 0;
const L = (city, neighborhood, province, lat, lng, extra = {}) => ({ id: `l${++n}`, city, neighborhood, province, lat, lng, type: 'Casa', mode: 'venta', ...extra });
const FEED = [
  L('Las Mercedes', null, 'Asunción', -25.287, -57.612),
  L('Las Mercedes', null, 'Asunción', -25.289, -57.610),
  L('Asunción', 'Las Mercedes', null, -25.286, -57.611),
  L('Asuncion', 'Barrio Las Mercedes', 'Asunción', -25.288, -57.613),
  L('San Lorenzo', 'Las Mercedes', 'Central', -25.335, -57.486),
  L('Recoleta', null, 'Asunción', -25.296, -57.585),
  L('Ycuá Satí', null, 'Asunción', -25.285, -57.560),
  L('Asunción', 'Ykua Sati', null, -25.286, -57.561),
  L('Villa Morra', null, 'Asunción', -25.293, -57.580),
  L('Asunción', 'Villamorra', 'Central', -25.294, -57.582),
  L('Ciudad Del Este', null, 'Alto Paraná', -25.509, -54.611),
  L('Ciudad del Este', 'Boquerón', 'Alto Paraná', -25.515, -54.62),
  L('Ciudad del Este', null, 'Central', -22.46266, -61.1650586),   // geocoded into the Chaco
  L('Luque', 'Campo Grande', 'Central', -25.268, -57.49),
  L('Luque', null, 'Central', -25.27, -57.48),
  L('Lambaré', null, 'Central', -25.34, -57.62),
  L('Lambaré', null, 'Central', -25.341, -57.621),
  L('Lambare', null, 'Asunción', -25.342, -57.622),                // a slip: still the town
  L('Carapeguá', 'Central', 'Central', -25.77, -57.24),            // barrio = departamento → none
  L('Asunción', null, null, -25.29, -57.6, { address: 'Arguello casi Boggiani, Recoleta, Asunción, Paraguay' }),
  L(null, null, null, -25.3, -57.58, { address: 'Calle 1, Villa Morra, Asunción, Paraguay' }),
  L('Mcal. Estigarribia', null, 'Asunción', -25.3, -57.6),
  L('Mariscal Estigarribia', null, 'Asunción', -25.301, -57.601),
];
const IX = buildPlaceIndex(FEED, { capital: 'Asunción', capitalBarrios: ASUNCION_BARRIOS });
const top = (q, k = 3) => suggestPlaces(IX, q, k).map((s) => `${s.place.name} | ${placeSubtitle(s.place)}`);
const byName = (name, kind) => IX.places.find((p) => p.name === name && p.kind === kind);

test('names: sound-alike keys and title case', () => {
  assert.equal(soundKey('Ycuá Satí'), soundKey('Ykua Sati'));
  assert.equal(soundKey('Villamorra'), soundKey('Villa Morra'));
  assert.equal(soundKey('Barrio Jara'), soundKey('Jara'));
  assert.equal(soundKey('Mcal. Estigarribia'), soundKey('Mariscal Estigarribia'));
  assert.notEqual(soundKey('Mburicaó'), soundKey('Mburucuyá'));
  assert.equal(titleCase('CIUDAD DEL ESTE'), 'Ciudad del Este');
  assert.equal(titleCase('ñemby'), 'Ñemby');
});

test('index: Asunción barrios filed as the city become barrios of Asunción', () => {
  const lm = IX.places.filter((p) => p.name === 'Las Mercedes');
  assert.deepEqual(lm.map((p) => `${p.kind}:${p.city}:${p.count}`).sort(), ['barrio:Asunción:4', 'barrio:San Lorenzo:1']);
  const asu = byName('Asunción', 'city');
  assert.ok(asu.capital);
  assert.ok(!IX.places.some((p) => p.kind === 'city' && /mercedes|recoleta/i.test(p.name)));
  assert.ok(!IX.places.some((p) => p.kind === 'dept' && /asunci/i.test(p.name)), 'the capital is no departamento');
});

test('index: spellings merge, accents win, departamento of a city is its most common one', () => {
  assert.equal(byName('Ycuá Satí', 'barrio').count, 2);
  assert.equal(byName('Villa Morra', 'barrio').count, 3);   // + the one read from the address
  assert.equal(byName('Mariscal Estigarribia', 'barrio').count, 2);
  const cde = byName('Ciudad del Este', 'city');
  assert.equal(cde.count, 3);
  assert.equal(cde.dept, 'Alto Paraná');
  assert.equal(placeSubtitle(cde), 'Ciudad, Alto Paraná');
  assert.equal(placeSubtitle(cde, 'en'), 'City, Alto Paraná');
});

test('index: a town filed once under Asunción stays a town; a barrio named like its departamento is none', () => {
  assert.equal(byName('Lambaré', 'city').count, 3);
  assert.ok(!IX.places.some((p) => p.kind === 'barrio' && /lambar/i.test(p.name)));
  assert.ok(!IX.places.some((p) => p.kind === 'barrio' && p.name === 'Central'));
});

test('index: missing barrio / city read from the address', () => {
  const reco = byName('Recoleta', 'barrio');
  assert.equal(reco.count, 2);
  const noCity = FEED.find((l) => l.city == null && /Villa Morra/.test(l.address || ''));
  assert.equal(IX.placeOf(noCity).barrio, byName('Villa Morra', 'barrio').id);
});

test('suggest: same barrio name in two cities, the bigger first, each says where it is', () => {
  assert.deepEqual(top('las mercedes'), ['Las Mercedes | Barrio, Asunción', 'Las Mercedes | Barrio, San Lorenzo']);
  assert.deepEqual(top('mercedes', 1), ['Las Mercedes | Barrio, Asunción']);
  assert.equal(top('las mercedes san lorenzo', 1)[0], 'Las Mercedes | Barrio, San Lorenzo');
});

test('suggest: accent-insensitive, sound-alike, typo-tolerant, Portuguese and nicknames', () => {
  assert.equal(top('ykua sati', 1)[0], 'Ycuá Satí | Barrio, Asunción');
  assert.equal(top('YCUA', 1)[0], 'Ycuá Satí | Barrio, Asunción');
  assert.equal(top('recoletta', 1)[0], 'Recoleta | Barrio, Asunción');
  assert.equal(top('luqe', 1)[0], 'Luque | Ciudad, Central');
  assert.equal(top('assunção', 1)[0], 'Asunción | Ciudad, Capital');
  assert.equal(top('cde', 1)[0], 'Ciudad del Este | Ciudad, Alto Paraná');
  assert.equal(top('vila mora', 1)[0], 'Villa Morra | Barrio, Asunción');
  assert.deepEqual(top('a'), []);   // one letter: nothing yet
});

test('suggest: a clear hit hides weak typo guesses', () => {
  const s = suggestPlaces(IX, 'luque', 8).map((x) => x.place.name);
  assert.equal(s[0], 'Luque');
  assert.ok(!s.includes('Lambaré'));
});

test('exactPlace: the Search key picks a place only when the text names it', () => {
  assert.equal(exactPlace(IX, 'las mercedes').city, 'Asunción');
  assert.equal(exactPlace(IX, 'mercedes asuncion').name, 'Las Mercedes');
  assert.equal(exactPlace(IX, 'Ciudad del Este').kind, 'city');
  assert.equal(exactPlace(IX, 'merc'), null);
  assert.equal(exactPlace(IX, 'senador long'), null);
});

// Website: the server filters the DB with placeParts (lib/placeFilter.js); a plain lower-case
// pattern stands in for lib/marketplace.js accentRegex here.
const rx = (v) => v.toLowerCase();
const dec = (part) => decodeURIComponent(part);

test('placeParts: a picked barrio = its stored spellings in its columns, inside its own box', () => {
  const asuLm = IX.places.find((p) => p.name === 'Las Mercedes' && p.city === 'Asunción');
  const [names, loc] = placeParts(asuLm, rx).map(dec);
  assert.deepEqual(placeColumns(asuLm), ['neighborhood', 'city', 'address']);
  assert.ok(names.startsWith('or=(neighborhood.imatch.las mercedes,'), names);
  assert.ok(names.includes('city.imatch.barrio las mercedes'), names);
  assert.ok(loc.startsWith('or=(latitude.is.null,and(latitude.gte.'), loc);
  // Asunción's box is far from San Lorenzo's Las Mercedes (-57.486).
  const w = Number(/longitude\.gte\.(-?[\d.]+)/.exec(loc)[1]), e = Number(/longitude\.lte\.(-?[\d.]+)/.exec(loc)[1]);
  assert.ok(w < -57.61 && e < -57.5 && e > -57.62, loc);
});

test('placeParts: a city keeps its misplaced listing by id; the capital also matches province', () => {
  const cde = byName('Ciudad del Este', 'city');
  const loc = dec(placeParts(cde, rx)[1]);
  const chaco = FEED.find((l) => l.lng < -60);
  assert.ok(loc.includes(`id.in.("${chaco.id}")`), loc);
  assert.ok(!/longitude\.gte\.-6[01]/.test(loc), 'the box stays on the city');
  assert.deepEqual(placeColumns(byName('Asunción', 'city')), ['city', 'province', 'neighborhood', 'address']);
  assert.deepEqual(placeColumns(cde), ['city', 'address']);
  assert.deepEqual(placeParts(null, rx), []);
  // A departamento: the province column only, without the capital inside it.
  const central = { ...byName('Central', 'dept'), notCity: 'Asunción' };
  assert.deepEqual(placeColumns(central), ['province']);
  assert.ok(placeParts(central, rx).map(dec).includes('or=(city.is.null,city.not.imatch.asunción)'));
});

test('placeParts: a barrio without located listings needs its city named too', () => {
  const feed = [['Capiatá', 1], ['Capiatá', 2], ['Luque', 3]].map(([city, i]) => ({ id: `c${i}`, city, neighborhood: 'Centro', province: null, address: 'Centro' }));
  const ix = buildPlaceIndex(feed, {});
  const cap = ix.places.find((p) => p.kind === 'barrio' && p.city === 'Capiatá');
  const parts = placeParts(cap, rx).map(dec);
  assert.equal(parts.length, 2);
  assert.equal(parts[1], 'or=(city.imatch.capiatá,province.imatch.capiatá,address.imatch.capiatá)');
});

test('placeParts: the raw spellings are what the DB has ("Mcal. Estigarribia", not only the expanded name)', () => {
  const me = byName('Mariscal Estigarribia', 'barrio');
  const names = dec(placeParts(me, rx)[0]);
  assert.ok(names.includes('city.imatch.mcal. estigarribia'), names);
  assert.ok(names.includes('city.imatch.mariscal estigarribia'), names);
});

test('compactIndex → hydrateIndex: the browser copy suggests the same places, with boxes', () => {
  const list = JSON.parse(JSON.stringify(compactIndex(IX, (p) => (p.pts.length ? searchBounds(p.pts, p.kind) : null))));
  assert.ok(!JSON.stringify(list).includes('"ids"') && !JSON.stringify(list).includes('"pts"'));
  const ix = hydrateIndex(list);
  const names = (index, q) => suggestPlaces(index, q, 5).map((x) => `${x.place.id}|${placeSubtitle(x.place)}`);
  for (const q of ['las mercedes', 'ykua sati', 'cde', 'luqe', 'mercedes asuncion']) assert.deepEqual(names(ix, q), names(IX, q), q);
  assert.equal(exactPlace(ix, 'las mercedes').id, exactPlace(IX, 'las mercedes').id);
  const cde = ix.places.find((p) => p.name === 'Ciudad del Este');
  assert.ok(cde.bounds.w > -55, JSON.stringify(cde.bounds));
  assert.deepEqual(hydrateIndex(null).places, []);
});

test('the centre-of-Paraguay geocoder fallback is an unknown spot', () => {
  assert.ok(atUnknownSpot('py', -23.4425, -58.4438));
  assert.ok(!atUnknownSpot('py', -25.29, -57.6));
  assert.ok(!atUnknownSpot('bo', -23.4425, -58.4438));
});

test('editDistance, nameScore, matchRange', () => {
  assert.equal(editDistance('recoleta', 'recoletta'), 1);
  assert.equal(editDistance('luqe', 'luque'), 1);
  assert.equal(editDistance('ab', 'ba'), 1);
  assert.equal(nameScore('las mercedes', 'las mercedes'), 100);
  assert.equal(nameScore('las mercedes', 'las m'), 90);
  assert.equal(nameScore('las mercedes', 'mercedes'), 80);
  assert.equal(nameScore('paraguari', 'jara'), 0);
  assert.deepEqual(matchRange('Las Mercedes', 'merc'), [4, 8]);
  assert.deepEqual(matchRange('Asunción', 'asunc'), [0, 5]);
});

test('recent searches: newest first, no repeats, capped', () => {
  let r = [];
  r = addRecent(r, { type: 'text', q: 'Senador Long' });
  r = addRecent(r, { type: 'place', id: 'b:x', name: 'X' });
  r = addRecent(r, { type: 'text', q: 'senador long' });
  assert.deepEqual(r.map((x) => x.q || x.id), ['senador long', 'b:x']);
  r = addRecent(r, { type: 'text', q: '  ' });
  assert.equal(r.length, 2);
  for (let i = 0; i < 10; i++) r = addRecent(r, { type: 'text', q: 'q' + i });
  assert.equal(r.length, 6);
});

test('exactPlace: a name shared evenly by several towns stays a text search', () => {
  const feed = ['Encarnación', 'San Lorenzo', 'Villa Elisa'].flatMap((c, i) => [1, 2].map((k) => ({ id: `${c}${k}`, city: c, neighborhood: 'Centro', province: 'Central', lat: -25 - i, lng: -57 })));
  const ix = buildPlaceIndex(feed, {});
  assert.equal(suggestPlaces(ix, 'centro', 5).length, 3);
  assert.equal(exactPlace(ix, 'centro'), null);
  assert.equal(exactPlace(ix, 'centro villa elisa').city, 'Villa Elisa');
});
