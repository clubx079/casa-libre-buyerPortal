# Asunción Zoning Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let buyers filter and see listings by what the city allows to be built there ("low / medium / tall buildings"), using Asunción's official zoning — with a design where other cities are added later as new "zoning providers" and every non-zoned city keeps working exactly as today.

**Architecture:** Each listing gets a stored zoning result (`zoning_code`, `zoning_category`, `zoning_max_floors`, `zoning_source`, `zoning_checked_at`) filled by an hourly buyer-portal cron. The cron asks a *provider* for the listing's city; today the only provider is Asunción, which queries the city's public ArcGIS layer (point + 25 m tolerance) and maps the zone code to a category with a rules table taken from Ordenanza 163/18. Search, pins, the listing page and the mobile app read the stored fields; a map toggle overlays the city's own rendered zoning tiles. Everything is behind `ZONING_ENABLED=1`, so nothing changes until the migration is applied and the flag is on.

**Tech Stack:** Next.js 14 (buyer portal), AiroBase PostgREST via `lib/db.js`, Google Maps JS (`utils/gmap.js`), Expo/React Native mobile app (WebView Google Map), node:test (buyer portal `tests/*.test.mjs`, mobile `lib/__tests__/*.test.mjs`).

**Spec:** the design agreed in chat on 2026-09-27 (summarised in "Zoning rules" below — this plan is the source of truth for the rules).

## Global Constraints

- Asunción only. Every other city: no zoning fields, no badge, filter shows nothing for them; behaviour otherwise identical to today.
- Feature flag `ZONING_ENABLED=1` (buyer portal env). Off → no zoning columns are selected, filtered or shown (safe to deploy before migration 007).
- Migration `migrations/007_zoning.sql` only ADDS nullable columns + one index to `properties`. PY DB is live: apply only with the user's explicit OK.
- Local only. Do not push any repo.
- City data source (read-only, public): `https://www.asuncion.gov.py/arcgis/rest/services/Mapa_Web/PlanRegulador/MapServer` layer `4` (field `zona_reg`). Lookup tolerance 25 m. Credit on every UI surface: "Fuente: Plan Regulador de Asunción (Ord. 163/18)".
- Disclaimer on every UI surface: "Referencia: lo que la zona permite construir, no lo ya construido. Verificá con la Municipalidad."
- Brand: ink/paper palette, pills, no emojis (Casa Libre rules).
- Be polite to the city server: at most 4 concurrent requests, max 300 listings per cron run.

## Zoning rules (Asunción, Ordenanza 163/18 + 161/2024)

Base heights from the ordinance; `+1` = "aumento de un nivel más" for AR1-B, AR2-A/B, AR3-A/B (Art., p.20).

| zona_reg | Official name | Max floors stored | Category |
|---|---|---|---|
| AR1A | Residencial Baja Densidad A (3 plantas / 9 m) | 3 | `baja` |
| AR1B | Residencial Baja Densidad B (3 + 1) | 4 | `baja` |
| AR2A | Residencial Media Densidad A (4 plantas / 12 m + 1) | 5 | `media` |
| AR2B, AR2B MOD | Residencial Media Densidad B (5 plantas / 15 m + 1) | 6 | `media` |
| AR3A, AR3A_1 | Residencial Alta Densidad A (5 pisos / 15 m + 1) | 6 | `media` |
| AR3B | Residencial Alta Densidad B (7 pisos / 21 m + 1) | 8 | `alta` |
| CENTRAL, EJE VILLA MORRA, FM1A, FM1B, FM2, FM3, EH, AT, ZUC | Central / mixed strips / axes (height by formula, up to 10 levels) | null | `alta` |
| AI1, AI2, AI3, AP, AUE, CEM, P, ZE | Industrial / port / specific use / cemetery / park / special | null | `otro` |

Category meaning shown to buyers: `baja` = "Baja altura · hasta 4 pisos (zona de casas)", `media` = "Media · 5–6 pisos", `alta` = "Alta · 7+ pisos / edificios", `otro` = "Otro uso (industrial, parque…)". Unknown codes → `otro`.

## Review Focus

1. Listing whose coordinates fall on a street (between blocks) → still zoned via the 25 m envelope (majority zone), not left empty.
2. City server down / slow / returns HTML error → cron records nothing for that listing and retries next run; never marks it "checked with no zone".
3. Listing outside Asunción (Luque, Lambaré…) → never queried, fields stay null, no badge, excluded from zoning filter only when that filter is active.
4. `ZONING_ENABLED` off or migration 007 not applied → search, pins, listing page, mobile feed behave exactly as before (no 400 from unknown columns).
5. Listing moved (lat/lng edited) after being zoned → re-zoned on the next run.

---

## File Structure

Buyer portal (`casa-libre-BuyerPortal/`):
- Create `migrations/007_zoning.sql` — new nullable columns + index.
- Create `lib/zoning/categories.js` — category ids, labels ES/EN, `zoningFilterPart(height)` (pure).
- Create `lib/zoning/asuncionRules.js` — `zoneRule(code)` → `{ category, maxFloors, label }` (pure).
- Create `lib/zoning/asuncion.js` — `lookupAsuncionZone(lat, lng, { fetchImpl })` (network, injectable).
- Create `lib/zoning/providers.js` — `providerForCity(city)`; registry `{ asuncion: {...} }` (the single place a new city is added).
- Create `lib/zoning/runZoning.js` — `runZoning({ db, now, providerFor, limit })` job (pure w/ injected deps).
- Create `app/api/cron/zoning/route.js` — hourly cron wiring.
- Create `utils/zoningOverlay.js` — `zoningTileUrl(x, y, z)` (pure) + `addZoningOverlay(google, map)`.
- Create `components/ZoningBadge.js` — listing detail badge.
- Modify `lib/marketplace.js` — `height` filter in `baseParts`.
- Modify `app/api/listings/pins/route.js` — pass `height`.
- Modify `lib/listings.js` — select + shape zoning fields (flag-gated), add to `slimForMobile`.
- Modify `components/MarketplaceClient.js`, `components/MobileMarketplace.js` — filter select + map toggle.
- Modify `components/PropertyDetailView.js` — render `ZoningBadge`.
- Tests: `tests/zoningRules.test.mjs`, `tests/zoningLookup.test.mjs`, `tests/runZoning.test.mjs`, `tests/zoningOverlay.test.mjs`.

Mobile app (`casa-libre-mobile-app/`):
- Modify `lib/mapFilter.js` — `heightF` in `applyFilters`.
- Modify `app/(tabs)/index.js` — "Altura permitida" dropdown.
- Modify `components/PropertyMap.js` — zoning tile overlay toggle.
- Modify `lib/i18n.js` — strings.
- Test: `lib/__tests__/mapFilter.test.mjs`.

---

### Task 1: Migration 007 + zoning rules table

**Files:**
- Create: `migrations/007_zoning.sql`
- Create: `lib/zoning/categories.js`
- Create: `lib/zoning/asuncionRules.js`
- Test: `tests/zoningRules.test.mjs`

**Interfaces:**
- Produces: `CATEGORIES` (array of `{ id: 'baja'|'media'|'alta'|'otro', es, en }`), `categoryLabel(id, lang)`, `zoningFilterPart(height)` → PostgREST fragment string or `null`; `zoneRule(code)` → `{ code, category, maxFloors, label }`.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/007_zoning.sql — per-listing zoning (Asunción first). Additive; idempotent.
alter table public.properties add column if not exists zoning_code       text;
alter table public.properties add column if not exists zoning_category   text;
alter table public.properties add column if not exists zoning_max_floors integer;
alter table public.properties add column if not exists zoning_source     text;
alter table public.properties add column if not exists zoning_checked_at timestamptz;
alter table public.properties add column if not exists zoning_lat        double precision;
alter table public.properties add column if not exists zoning_lng        double precision;
alter table public.properties drop constraint if exists properties_zoning_category_chk;
alter table public.properties add constraint properties_zoning_category_chk
  check (zoning_category is null or zoning_category in ('baja','media','alta','otro'));
create index if not exists properties_zoning_category_idx on public.properties (zoning_category) where zoning_category is not null;
```

(`zoning_lat/lng` = the coordinates the zone was computed for, so a moved listing is re-zoned.)

- [ ] **Step 2: Write the failing test**

```js
// tests/zoningRules.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneRule } from '../lib/zoning/asuncionRules.js';
import { CATEGORIES, categoryLabel, zoningFilterPart } from '../lib/zoning/categories.js';

test('residential zones map to the ordinance floors and category', () => {
  assert.deepEqual([zoneRule('AR1A').maxFloors, zoneRule('AR1A').category], [3, 'baja']);
  assert.deepEqual([zoneRule('AR1B').maxFloors, zoneRule('AR1B').category], [4, 'baja']);
  assert.deepEqual([zoneRule('AR2A').maxFloors, zoneRule('AR2A').category], [5, 'media']);
  assert.deepEqual([zoneRule('AR2B MOD').maxFloors, zoneRule('AR2B MOD').category], [6, 'media']);
  assert.deepEqual([zoneRule('AR3A_1').maxFloors, zoneRule('AR3A_1').category], [6, 'media']);
  assert.deepEqual([zoneRule('AR3B').maxFloors, zoneRule('AR3B').category], [8, 'alta']);
});

test('mixed/central zones are alta with no fixed floors; industrial/parks are otro', () => {
  for (const c of ['CENTRAL', 'EJE VILLA MORRA', 'FM1A', 'FM1B', 'FM2', 'FM3', 'EH', 'AT', 'ZUC']) {
    assert.equal(zoneRule(c).category, 'alta', c); assert.equal(zoneRule(c).maxFloors, null, c);
  }
  for (const c of ['AI1', 'AI2', 'AI3', 'AP', 'AUE', 'CEM', 'P', 'ZE']) assert.equal(zoneRule(c).category, 'otro', c);
});

test('unknown or messy codes are otro, codes are trimmed/upper-cased', () => {
  assert.equal(zoneRule('XYZ').category, 'otro');
  assert.equal(zoneRule(null).category, 'otro');
  assert.equal(zoneRule(' ar1a ').maxFloors, 3);
});

test('filter fragment only for known categories', () => {
  assert.equal(zoningFilterPart('baja'), 'zoning_category=eq.baja');
  assert.equal(zoningFilterPart('all'), null);
  assert.equal(zoningFilterPart('drop table'), null);
  assert.equal(CATEGORIES.map((c) => c.id).join(','), 'baja,media,alta,otro');
  assert.match(categoryLabel('baja', 'es'), /hasta 4 pisos/);
  assert.match(categoryLabel('alta', 'en'), /7\+/);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/zoning/asuncionRules.js'`.

- [ ] **Step 4: Implement**

```js
// lib/zoning/categories.js — the buyer-facing zoning categories (all cities share these).
export const CATEGORIES = [
  { id: 'baja', es: 'Baja altura · hasta 4 pisos (zona de casas)', en: 'Low-rise · up to 4 floors (houses)' },
  { id: 'media', es: 'Media · 5–6 pisos', en: 'Mid-rise · 5–6 floors' },
  { id: 'alta', es: 'Alta · 7+ pisos / edificios', en: 'High-rise · 7+ floors / towers' },
  { id: 'otro', es: 'Otro uso (industrial, parque…)', en: 'Other use (industrial, park…)' },
];
const IDS = new Set(CATEGORIES.map((c) => c.id));
export const categoryLabel = (id, lang = 'es') => (CATEGORIES.find((c) => c.id === id) || {})[lang === 'en' ? 'en' : 'es'] || '';
export const zoningFilterPart = (height) => (IDS.has(height) ? `zoning_category=eq.${height}` : null);
export const ZONING_SOURCE_LABEL = { asuncion: 'Plan Regulador de Asunción (Ord. 163/18)' };
```

```js
// lib/zoning/asuncionRules.js — Asunción zone code → floors + category (Ordenanza 163/18,
// Central/AT per 161/2024). Floors include the "+1 nivel" of AR1-B, AR2-A/B, AR3-A/B.
const RULES = {
  AR1A: [3, 'baja', 'Residencial de baja densidad (AR1-A)'],
  AR1B: [4, 'baja', 'Residencial de baja densidad (AR1-B)'],
  AR2A: [5, 'media', 'Residencial de media densidad (AR2-A)'],
  AR2B: [6, 'media', 'Residencial de media densidad (AR2-B)'],
  'AR2B MOD': [6, 'media', 'Residencial de media densidad (AR2-B)'],
  AR3A: [6, 'media', 'Residencial de alta densidad (AR3-A)'],
  AR3A_1: [6, 'media', 'Residencial de alta densidad (AR3-A)'],
  AR3B: [8, 'alta', 'Residencial de alta densidad (AR3-B)'],
  CENTRAL: [null, 'alta', 'Área central'],
  'EJE VILLA MORRA': [null, 'alta', 'Eje Villa Morra'],
  FM1A: [null, 'alta', 'Franja mixta 1-A'], FM1B: [null, 'alta', 'Franja mixta 1-B'],
  FM2: [null, 'alta', 'Franja mixta 2'], FM3: [null, 'alta', 'Franja mixta 3'],
  EH: [null, 'alta', 'Eje habitacional'], AT: [null, 'alta', 'Área de transición'],
  ZUC: [null, 'alta', 'Zona urbana concertada'],
  AI1: [null, 'otro', 'Área industrial 1'], AI2: [null, 'otro', 'Área industrial 2'], AI3: [null, 'otro', 'Área industrial 3'],
  AP: [null, 'otro', 'Área portuaria'], AUE: [null, 'otro', 'Área de uso específico'],
  CEM: [null, 'otro', 'Cementerio'], P: [null, 'otro', 'Parque'], ZE: [null, 'otro', 'Zona especial'],
};
export function zoneRule(code) {
  const k = String(code || '').trim().toUpperCase();
  const r = RULES[k];
  if (!r) return { code: k || null, category: 'otro', maxFloors: null, label: k || 'Sin zona' };
  return { code: k, category: r[1], maxFloors: r[0], label: r[2] };
}
```

- [ ] **Step 5: Run tests** — Run: `npm test` — Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add migrations/007_zoning.sql lib/zoning/categories.js lib/zoning/asuncionRules.js tests/zoningRules.test.mjs
git commit -m "feat(zoning): migration 007 + Asunción zoning rules table"
```

---

### Task 2: Asunción lookup + provider registry

**Files:**
- Create: `lib/zoning/asuncion.js`
- Create: `lib/zoning/providers.js`
- Test: `tests/zoningLookup.test.mjs`

**Interfaces:**
- Consumes: `zoneRule(code)` (Task 1).
- Produces: `lookupAsuncionZone(lat, lng, { fetchImpl = fetch, toleranceM = 25 })` → `{ code, category, maxFloors, label } | null` (null = no zone found), throws on network/HTTP/JSON errors. `providerForCity(city)` → `{ id: 'asuncion', lookup } | null`. `PROVIDERS` object.

- [ ] **Step 1: Write the failing test**

```js
// tests/zoningLookup.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupAsuncionZone } from '../lib/zoning/asuncion.js';
import { providerForCity } from '../lib/zoning/providers.js';

const fakeFetch = (features, { ok = true, text } = {}) => async (url) => {
  fakeFetch.last = url;
  return { ok, status: ok ? 200 : 500, text: async () => text ?? JSON.stringify({ features }) };
};

test('returns the majority zone inside the 25 m envelope, mapped through the rules', async () => {
  const f = fakeFetch([{ attributes: { zona_reg: 'AR2A' } }, { attributes: { zona_reg: 'AR2A' } }, { attributes: { zona_reg: 'FM2' } }]);
  const z = await lookupAsuncionZone(-25.2907, -57.5803, { fetchImpl: f });
  assert.deepEqual([z.code, z.category, z.maxFloors], ['AR2A', 'media', 5]);
  assert.match(fakeFetch.last, /PlanRegulador\/MapServer\/4\/query/);
  assert.match(fakeFetch.last, /esriGeometryEnvelope/);
  assert.match(fakeFetch.last, /returnGeometry=false/);
});

test('no features → null (a street or outside the plan)', async () => {
  assert.equal(await lookupAsuncionZone(-25.3, -57.6, { fetchImpl: fakeFetch([]) }), null);
});

test('HTTP error or HTML response throws (so the cron retries later)', async () => {
  await assert.rejects(lookupAsuncionZone(-25.3, -57.6, { fetchImpl: fakeFetch([], { ok: false }) }));
  await assert.rejects(lookupAsuncionZone(-25.3, -57.6, { fetchImpl: fakeFetch([], { text: '<html>error</html>' }) }));
});

test('provider registry: Asunción variants only', () => {
  for (const c of ['Asunción', 'asuncion', ' ASUNCIÓN ', 'Asuncion (Villa Morra)']) assert.equal(providerForCity(c)?.id, 'asuncion', c);
  for (const c of ['Luque', 'Lambaré', 'San Lorenzo', '', null]) assert.equal(providerForCity(c), null, String(c));
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
// lib/zoning/asuncion.js — which Plan Regulador zone a point is in, from the city's
// public ArcGIS layer. The zone outlines aren't downloadable, but the layer answers a
// spatial query. A 25 m box absorbs addresses geocoded onto the street centre line.
import { zoneRule } from './asuncionRules.js';

const URL_ = 'https://www.asuncion.gov.py/arcgis/rest/services/Mapa_Web/PlanRegulador/MapServer/4/query';

export async function lookupAsuncionZone(lat, lng, { fetchImpl = fetch, toleranceM = 25 } = {}) {
  const la = Number(lat), lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  const dLat = toleranceM / 111320;
  const dLng = toleranceM / (111320 * Math.cos((la * Math.PI) / 180));
  const geometry = JSON.stringify({ xmin: lo - dLng, ymin: la - dLat, xmax: lo + dLng, ymax: la + dLat, spatialReference: { wkid: 4326 } });
  const qs = new URLSearchParams({ geometry, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'zona_reg', returnGeometry: 'false', f: 'json' });
  const res = await fetchImpl(`${URL_}?${qs}`, { headers: { 'User-Agent': 'CasaLibre/1.0 (+https://casa-libre.com.py)' } });
  if (!res.ok) throw new Error(`asuncion_zoning_http_${res.status}`);
  const j = JSON.parse(await res.text());           // throws on an HTML error page
  if (j.error) throw new Error(`asuncion_zoning_${j.error.code || 'error'}`);
  const codes = (j.features || []).map((f) => f?.attributes?.zona_reg).filter(Boolean);
  if (!codes.length) return null;
  const tally = new Map();
  for (const c of codes) tally.set(c, (tally.get(c) || 0) + 1);
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return zoneRule(top);
}
```

```js
// lib/zoning/providers.js — THE place a city gets zoning. To add a city later (e.g. Luque),
// write lib/zoning/<city>.js with the same lookup(lat, lng) contract and register it here.
// Any city without a provider is simply never zoned (it behaves exactly as before).
import { lookupAsuncionZone } from './asuncion.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const PROVIDERS = {
  asuncion: { id: 'asuncion', matches: (c) => norm(c).startsWith('asuncion'), lookup: lookupAsuncionZone },
};

export function providerForCity(city) {
  if (!norm(city)) return null;
  return Object.values(PROVIDERS).find((p) => p.matches(city)) || null;
}
```

- [ ] **Step 4: Run tests** — `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/zoning/asuncion.js lib/zoning/providers.js tests/zoningLookup.test.mjs
git commit -m "feat(zoning): Asunción ArcGIS lookup (25 m tolerance) + provider registry"
```

---

### Task 3: Zoning job + hourly cron

**Files:**
- Create: `lib/zoning/runZoning.js`
- Create: `app/api/cron/zoning/route.js`
- Test: `tests/runZoning.test.mjs` (uses `tests/support/fakePostgrest.mjs`)

**Interfaces:**
- Consumes: `providerForCity(city)` (Task 2) — injected as `providerFor`.
- Produces: `runZoning({ db, now, providerFor, limit = 300, concurrency = 4 })` → `{ checked, zoned, noZone, failed, skipped }`.

Selection: active listings with coordinates where `zoning_checked_at is null` OR the coordinates changed (`zoning_lat`/`zoning_lng` differ). Non-provider cities are marked checked with no zone and never re-queried (`zoning_source = null`).

- [ ] **Step 1: Write the failing test**

```js
// tests/runZoning.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './support/fakePostgrest.mjs';
import { runZoning } from '../lib/zoning/runZoning.js';

const NOW = new Date('2026-10-01T12:00:00Z');
const prop = (id, city, extra = {}) => ({ id, city, latitude: -25.29, longitude: -57.58, admin_status: 'active', zoning_checked_at: null, zoning_lat: null, zoning_lng: null, ...extra });
const provider = (impl) => (city) => (String(city).startsWith('Asun') ? { id: 'asuncion', lookup: impl } : null);

test('zones Asunción listings, marks other cities checked without calling a provider', async () => {
  const db = createStore().seed('properties', [prop('a', 'Asunción'), prop('l', 'Luque')]);
  let calls = 0;
  const r = await runZoning({ db, now: NOW, providerFor: provider(async () => { calls++; return { code: 'AR1A', category: 'baja', maxFloors: 3 }; }) });
  assert.equal(calls, 1);
  assert.equal(r.zoned, 1); assert.equal(r.skipped, 1);
  const [a] = await db.select('properties', 'id=eq.a');
  assert.deepEqual([a.zoning_code, a.zoning_category, a.zoning_max_floors, a.zoning_source], ['AR1A', 'baja', 3, 'asuncion']);
  assert.equal(a.zoning_lat, -25.29);
  const [l] = await db.select('properties', 'id=eq.l');
  assert.equal(l.zoning_category, null); assert.ok(l.zoning_checked_at);
});

test('no zone found is recorded (checked, empty); provider error is NOT recorded (retry)', async () => {
  const db = createStore().seed('properties', [prop('n', 'Asunción'), prop('e', 'Asunción')]);
  const r = await runZoning({ db, now: NOW, providerFor: provider(async (lat, lng) => { if (lat === -25.29 && db.__err) throw new Error('down'); return null; }) });
  assert.equal(r.noZone, 2);
  const db2 = createStore().seed('properties', [prop('e', 'Asunción')]);
  const r2 = await runZoning({ db: db2, now: NOW, providerFor: provider(async () => { throw new Error('down'); }) });
  assert.equal(r2.failed, 1);
  const [e] = await db2.select('properties', 'id=eq.e');
  assert.equal(e.zoning_checked_at, null);
});

test('already-zoned listings are skipped unless their coordinates moved', async () => {
  const db = createStore().seed('properties', [
    prop('same', 'Asunción', { zoning_checked_at: '2026-09-01T00:00:00Z', zoning_lat: -25.29, zoning_lng: -57.58, zoning_category: 'baja' }),
    prop('moved', 'Asunción', { zoning_checked_at: '2026-09-01T00:00:00Z', zoning_lat: -25.30, zoning_lng: -57.60, zoning_category: 'baja' }),
  ]);
  let calls = 0;
  await runZoning({ db, now: NOW, providerFor: provider(async () => { calls++; return { code: 'AR3B', category: 'alta', maxFloors: 8 }; }) });
  assert.equal(calls, 1);
  const [m] = await db.select('properties', 'id=eq.moved');
  assert.equal(m.zoning_category, 'alta');
});

test('respects the per-run limit', async () => {
  const db = createStore().seed('properties', Array.from({ length: 7 }, (_, i) => prop(`p${i}`, 'Asunción')));
  const r = await runZoning({ db, now: NOW, limit: 3, providerFor: provider(async () => ({ code: 'AR1A', category: 'baja', maxFloors: 3 })) });
  assert.equal(r.checked, 3);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```js
// lib/zoning/runZoning.js — fill per-listing zoning for cities that have a provider.
// Pure with injected deps (db = lib/db-shaped; providerFor = providerForCity).
const moved = (r) => r.zoning_checked_at && (Number(r.zoning_lat) !== Number(r.latitude) || Number(r.zoning_lng) !== Number(r.longitude));

export async function runZoning({ db, now = new Date(), providerFor, limit = 300, concurrency = 4 }) {
  const out = { checked: 0, zoned: 0, noZone: 0, failed: 0, skipped: 0 };
  const rows = await db.select('properties',
    'select=id,city,latitude,longitude,zoning_checked_at,zoning_lat,zoning_lng&admin_status=eq.active&latitude=not.is.null&longitude=not.is.null&order=created_at.desc&limit=5000');
  const due = rows.filter((r) => !r.zoning_checked_at || moved(r)).slice(0, limit);
  const nowIso = now.toISOString();
  const save = (id, patch) => db.update('properties', `id=eq.${encodeURIComponent(id)}`, { ...patch, zoning_checked_at: nowIso }, { returning: 'minimal' });

  let i = 0;
  async function worker() {
    while (i < due.length) {
      const r = due[i++];
      out.checked++;
      const p = providerFor(r.city);
      if (!p) {
        await save(r.id, { zoning_code: null, zoning_category: null, zoning_max_floors: null, zoning_source: null, zoning_lat: r.latitude, zoning_lng: r.longitude });
        out.skipped++;
        continue;
      }
      let z;
      try { z = await p.lookup(r.latitude, r.longitude); }
      catch { out.failed++; continue; }                      // leave unchecked → retried next run
      await save(r.id, {
        zoning_code: z?.code || null, zoning_category: z?.category || null, zoning_max_floors: z?.maxFloors ?? null,
        zoning_source: p.id, zoning_lat: r.latitude, zoning_lng: r.longitude,
      });
      if (z) out.zoned++; else out.noZone++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, worker));
  return out;
}
```

(Remove the unused `db.__err` branch from the second test if it confuses — the second half of that test is the real assertion.)

```js
// app/api/cron/zoning/route.js — hourly: zone new/moved listings (Asunción today).
// Off unless ZONING_ENABLED=1 (needs migration 007). CRON_SECRET like the other crons.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import * as db from '@/lib/db';
import { runZoning } from '@/lib/zoning/runZoning';
import { providerForCity } from '@/lib/zoning/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const qs = new URL(req.url).searchParams.get('secret');
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (process.env.ZONING_ENABLED !== '1') return NextResponse.json({ ok: true, skipped: 'zoning_disabled' });
  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit')) || 300, 1000);
  try {
    const r = await runZoning({ db, now: new Date(), providerFor: providerForCity, limit });
    if (r.zoned || r.noZone) revalidateTag('listings');
    return NextResponse.json({ ok: true, ...r, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: 'zoning_failed', detail: e?.message }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
```

- [ ] **Step 4: Run tests** — `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/zoning/runZoning.js app/api/cron/zoning/route.js tests/runZoning.test.mjs
git commit -m "feat(zoning): hourly job zoning new/moved listings via city providers"
```

---

### Task 4: Search, pins and listing data (flag-gated)

**Files:**
- Modify: `lib/marketplace.js` (`baseParts`)
- Modify: `app/api/listings/pins/route.js`
- Modify: `lib/listings.js` (`SELECT`, `LIGHT_SELECT`, `shape`, `slimForMobile`)
- Test: extend `tests/zoningRules.test.mjs`

**Interfaces:**
- Consumes: `zoningFilterPart(height)` (Task 1).
- Produces: request param `height` ∈ `baja|media|alta|otro` on `/api/listings/search` (POST body) and `/api/listings/pins` (query); listing objects gain `zoning: { code, category, maxFloors, source } | null`; mobile slim feed gains `zc` (category string or null).

- [ ] **Step 1: Test the flag helper (failing)**

Add to `tests/zoningRules.test.mjs`:

```js
import { zoningEnabled, zoningFromRow } from '../lib/zoning/categories.js';
test('zoningFromRow only when enabled and categorised', () => {
  assert.equal(zoningFromRow({ zoning_category: 'baja' }, false), null);
  assert.equal(zoningFromRow({ zoning_category: null }, true), null);
  assert.deepEqual(zoningFromRow({ zoning_code: 'AR1A', zoning_category: 'baja', zoning_max_floors: 3, zoning_source: 'asuncion' }, true),
    { code: 'AR1A', category: 'baja', maxFloors: 3, source: 'asuncion' });
  assert.equal(typeof zoningEnabled(), 'boolean');
});
```

- [ ] **Step 2: Run** — `npm test` — Expected: FAIL (`zoningEnabled` not exported).

- [ ] **Step 3: Implement** — append to `lib/zoning/categories.js`:

```js
export const zoningEnabled = () => process.env.ZONING_ENABLED === '1';
export const ZONING_COLUMNS = 'zoning_code,zoning_category,zoning_max_floors,zoning_source';
export function zoningFromRow(r, enabled = zoningEnabled()) {
  if (!enabled || !r?.zoning_category) return null;
  return { code: r.zoning_code || null, category: r.zoning_category, maxFloors: r.zoning_max_floors ?? null, source: r.zoning_source || null };
}
```

In `lib/marketplace.js`:
- import: `import { zoningEnabled, zoningFilterPart } from './zoning/categories';`
- at the end of `baseParts` before `return parts;`:
```js
  if (zoningEnabled()) { const zp = zoningFilterPart(p.height); if (zp) parts.push(zp); }
```

In `app/api/listings/pins/route.js` add `'height'` to the param list:
```js
  const p = Object.fromEntries(['op', 'type', 'beds', 'priceMin', 'priceMax', 'barrio', 'seller', 'q', 'height'].map((k) => [k, sp.get(k) || '']));
```

In `lib/listings.js`:
- import `import { zoningEnabled, zoningFromRow, ZONING_COLUMNS } from './zoning/categories';`
- make both select strings append zoning columns only when enabled (they're module constants today — turn the uses into functions):
```js
const withZoning = (sel) => (zoningEnabled() ? `${sel},${ZONING_COLUMNS}` : sel);
```
  and replace `select=${SELECT}` with `select=${withZoning(SELECT)}`, and the light select expression with `withZoning(light ? LIGHT_SELECT + (withImage ? ',feature_image_url' : '') : SELECT)` — in `getListings`, `getListing`, `getListingsByIds`, `getUserListings`.
- in `shape()` add `zoning: zoningFromRow(r),`
- in `slimForMobile` add `zc: l.zoning ? l.zoning.category : null,`

- [ ] **Step 4: Run tests + build** — `npm test` (PASS) and `npx next build` in a worktree (Compiled successfully).

- [ ] **Step 5: Commit**

```bash
git add lib/zoning/categories.js lib/marketplace.js app/api/listings/pins/route.js lib/listings.js tests/zoningRules.test.mjs
git commit -m "feat(zoning): height filter in search/pins + zoning on listings (flag-gated)"
```

---

### Task 5: Web UI — filter, map overlay, listing badge

**Files:**
- Create: `utils/zoningOverlay.js`
- Create: `components/ZoningBadge.js`
- Modify: `components/MarketplaceClient.js`, `components/MobileMarketplace.js`, `components/PropertyDetailView.js`
- Test: `tests/zoningOverlay.test.mjs`

**Interfaces:**
- Consumes: `CATEGORIES`, `categoryLabel`, `ZONING_SOURCE_LABEL` (Task 1); `height` param (Task 4); `listing.zoning` (Task 4).
- Produces: `zoningTileUrl(x, y, z)` → string; `addZoningOverlay(google, map)` → `{ remove() }`; `<ZoningBadge zoning lang />`.

- [ ] **Step 1: Failing test for the tile maths**

```js
// tests/zoningOverlay.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoningTileUrl, tileBbox3857 } from '../utils/zoningOverlay.js';

test('tile bbox in Web Mercator', () => {
  const [xmin, ymin, xmax, ymax] = tileBbox3857(0, 0, 0);
  assert.ok(Math.abs(xmin + 20037508.34) < 1 && Math.abs(ymax - 20037508.34) < 1);
  assert.ok(Math.abs(xmax - 20037508.34) < 1 && Math.abs(ymin + 20037508.34) < 1);
});

test('tile url asks the city for layer 4 as transparent png', () => {
  const u = zoningTileUrl(4640, 9315, 14);
  assert.match(u, /PlanRegulador\/MapServer\/export\?/);
  assert.match(u, /layers=show%3A4/);
  assert.match(u, /transparent=true/);
  assert.match(u, /bboxSR=3857/);
});
```

- [ ] **Step 2: Run** — `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement overlay + badge**

```js
// utils/zoningOverlay.js — Asunción zoning drawn by the city's own map server, as
// transparent 256px tiles over our Google map (Web Mercator bbox per tile).
const R = 20037508.342789244;
const EXPORT = 'https://www.asuncion.gov.py/arcgis/rest/services/Mapa_Web/PlanRegulador/MapServer/export';

export function tileBbox3857(x, y, z) {
  const size = (2 * R) / 2 ** z;
  const xmin = -R + x * size, ymax = R - y * size;
  return [xmin, ymax - size, xmin + size, ymax];
}

export function zoningTileUrl(x, y, z) {
  const qs = new URLSearchParams({
    bbox: tileBbox3857(x, y, z).join(','), bboxSR: '3857', imageSR: '3857', size: '256,256',
    layers: 'show:4', transparent: 'true', format: 'png32', f: 'image',
  });
  return `${EXPORT}?${qs}`;
}

export function addZoningOverlay(google, map, { opacity = 0.55 } = {}) {
  const layer = new google.maps.ImageMapType({
    getTileUrl: (c, z) => (z >= 11 ? zoningTileUrl(c.x, c.y, z) : null),   // city-scale only
    tileSize: new google.maps.Size(256, 256), opacity, name: 'zonificacion',
  });
  map.overlayMapTypes.push(layer);
  return { remove() { const i = map.overlayMapTypes.getArray().indexOf(layer); if (i >= 0) map.overlayMapTypes.removeAt(i); } };
}
```

```jsx
// components/ZoningBadge.js — "what this area allows" on a listing page (zoned cities only).
import { categoryLabel, ZONING_SOURCE_LABEL } from '@/lib/zoning/categories';

export default function ZoningBadge({ zoning, lang = 'es' }) {
  if (!zoning) return null;
  const es = lang !== 'en';
  const floors = zoning.maxFloors ? (es ? `hasta ${zoning.maxFloors} pisos` : `up to ${zoning.maxFloors} floors`) : null;
  return (
    <div className="rounded-[14px] border border-ink/15 bg-card px-4 py-3">
      <div className="text-[11px] font-mono uppercase tracking-label text-ink/45">{es ? 'Zonificación' : 'Zoning'}</div>
      <div className="text-[14px] font-semibold text-ink mt-1">{categoryLabel(zoning.category, lang)}{floors ? ` · ${floors}` : ''}</div>
      <div className="text-[11.5px] text-ink/55 mt-1">
        {es ? 'Fuente' : 'Source'}: {ZONING_SOURCE_LABEL[zoning.source] || zoning.source} ({zoning.code}).{' '}
        {es ? 'Referencia: lo que la zona permite construir, no lo ya construido. Verificá con la Municipalidad.'
            : 'Reference only: what the zone allows to be built, not what is built. Check with the municipality.'}
      </div>
    </div>
  );
}
```

`components/PropertyDetailView.js`: import `ZoningBadge` and render `<ZoningBadge zoning={l.zoning} lang={lang} />` right under the features/facts block (next to the "N days on Casa Libre" line, `listedAt` area ~line 116).

`components/MarketplaceClient.js` (and the same in `MobileMarketplace.js`):
- state: `const [heightF, setHeightF] = useState('all');`
- body/url: add `height: heightF === 'all' ? undefined : heightF` to `searchBody`, and in `pinsUrl` `if (heightF !== 'all') p.set('height', heightF);`; add `heightF` to the effect's dependency list alongside the other filters.
- UI, after the beds select, only when the server says zoning is on (pass `zoningOn` prop from `app/propiedades/page.js` = `process.env.ZONING_ENABLED === '1'`):
```jsx
{zoningOn && (
  <select value={heightF} onChange={(e) => setHeightF(e.target.value)} className={selCls} title={lang === 'en' ? 'Asunción only' : 'Solo Asunción'}>
    <option value="all">{lang === 'en' ? 'Allowed height (Asunción)' : 'Altura permitida (Asunción)'}</option>
    {CATEGORIES.filter((c) => c.id !== 'otro').map((c) => <option key={c.id} value={c.id}>{lang === 'en' ? c.en : c.es}</option>)}
  </select>
)}
```
- Map toggle button (top-right of the map container, pill style), only when `zoningOn`:
```jsx
const zoningRef = useRef(null);
const [showZoning, setShowZoning] = useState(false);
useEffect(() => {
  const map = mapRef.current; const google = window.google;
  if (!map || !google) return;
  if (showZoning && !zoningRef.current) zoningRef.current = addZoningOverlay(google, map);
  if (!showZoning && zoningRef.current) { zoningRef.current.remove(); zoningRef.current = null; }
}, [showZoning, mapReady]);
```
  Button label "Zonificación" / "Zoning"; when on, show a small legend card: the three colours from the city map are not uniform, so the legend text is: "Colores: Plan Regulador de Asunción · amarillo = residencial baja/media, naranja = residencial alta, rojo/bordó = franjas mixtas y centro, magenta = industrial, verde = parques" + the disclaimer sentence.

- [ ] **Step 4: Run tests + build + browser check** — `npm test` PASS; production build Compiled; run locally with `ZONING_ENABLED=1` against the local stand-in (Task 7) and confirm: filter visible, overlay tiles load over Asunción, badge on an Asunción listing, nothing on a Luque listing.

- [ ] **Step 5: Commit**

```bash
git add utils/zoningOverlay.js components/ZoningBadge.js components/MarketplaceClient.js components/MobileMarketplace.js components/PropertyDetailView.js app/propiedades/page.js tests/zoningOverlay.test.mjs
git commit -m "feat(zoning): height filter, zoning map overlay and listing badge (Asunción)"
```

---

### Task 6: Mobile app — filter + overlay

**Files (mobile repo `casa-libre-mobile-app/`):**
- Modify: `lib/mapFilter.js`, `app/(tabs)/index.js`, `components/PropertyMap.js`, `lib/i18n.js`
- Test: `lib/__tests__/mapFilter.test.mjs`

**Interfaces:**
- Consumes: slim feed field `zc` (Task 4).
- Produces: `applyFilters(list, { …, heightF })`.

- [ ] **Step 1: Failing test** — append to `lib/__tests__/mapFilter.test.mjs`:

```js
test('applyFilters: heightF keeps only that zoning category; all = no filter', () => {
  const list = [L('b', 0, 0, { zc: 'baja' }), L('a', 0, 0, { zc: 'alta' }), L('n', 0, 0, { zc: null })];
  assert.deepEqual(applyFilters(list, { heightF: 'baja' }).map((l) => l.id), ['b']);
  assert.deepEqual(applyFilters(list, { heightF: 'all' }).map((l) => l.id), ['b', 'a', 'n']);
});
```

- [ ] **Step 2: Run** — `npm test` — Expected: FAIL (all three returned).

- [ ] **Step 3: Implement**
- `lib/mapFilter.js` signature: add `heightF = 'all'` to the destructured options and after the mode filter:
```js
  if (heightF && heightF !== 'all') out = out.filter((l) => l.zc === heightF);
```
- `app/(tabs)/index.js`: `const [heightF, setHeightF] = useState('all');` add to `applyFilters` call + deps, to `activeCount`, `clearFilters`, `filterKey`; a fifth `<Dropdown label={t('allowedHeight')} …>` with options `[{k:'all',label:t('anyHeight')},{k:'baja',label:t('heightLow')},{k:'media',label:t('heightMid')},{k:'alta',label:t('heightHigh')}]`, shown only when `raw.some((l) => l.zc)` (so it appears only where zoning exists).
- `lib/i18n.js` ES/EN: `allowedHeight: 'Altura permitida (Asunción)' / 'Allowed height (Asunción)'`, `anyHeight: 'Cualquiera' / 'Any'`, `heightLow: 'Baja · hasta 4 pisos' / 'Low · up to 4 floors'`, `heightMid: 'Media · 5–6 pisos' / 'Mid · 5–6 floors'`, `heightHigh: 'Alta · 7+ pisos' / 'High · 7+ floors'`.
- `components/PropertyMap.js`: inside the WebView script add the same tile function and a `window.__clZoning(on)` that pushes/removes an `ImageMapType` with `getTileUrl` → city export URL (copy `tileBbox3857`/`zoningTileUrl` logic inline, since the WebView can't import); expose `setZoning(on)` via `useImperativeHandle`; in `index.js` a small round "Zonas" map button (next to the locate button) toggles it.

- [ ] **Step 4: Run tests + bundle** — `npm test` PASS; `npx expo export --platform android` Exported.

- [ ] **Step 5: Commit**

```bash
git add lib/mapFilter.js "app/(tabs)/index.js" components/PropertyMap.js lib/i18n.js lib/__tests__/mapFilter.test.mjs
git commit -m "feat(zoning): mobile allowed-height filter + zoning map layer (Asunción)"
```

---

### Task 7: End-to-end check + real-data dry run

**Files:**
- Create: `scripts/zoning-dry-run.mjs` (buyer portal)

- [ ] **Step 1:** Write a script that reads active Asunción listings with coordinates from the DB **read-only**, runs `lookupAsuncionZone` on each (4 at a time), and prints the category distribution and match rate — writing NOTHING. Expected (from the 2026-09-27 research): ≥ 90 % matched.
- [ ] **Step 2:** Local end-to-end: `scripts/dev-postgrest.mjs` seeded with 3 Asunción + 2 Luque listings (with the 007 columns); run the buyer portal with `ZONING_ENABLED=1` against it; call `/api/cron/zoning?secret=…` → Asunción rows get categories, Luque rows `checked` with null; `/api/listings/search` with `height=baja` returns only the low-rise Asunción listing; `/api/listings/pins?height=baja` same.
- [ ] **Step 3:** Browser check (Playwright): filter visible, overlay tiles load, badge shown on Asunción listing, absent on Luque listing, no console errors. With `ZONING_ENABLED` unset: no filter, no badge, search unchanged.
- [ ] **Step 4:** Production builds of buyer portal + mobile bundle; commit the script.

```bash
git add scripts/zoning-dry-run.mjs
git commit -m "test(zoning): real-data dry run (read-only) + e2e notes"
```

---

## Go-live (only when the user says so)

1. Apply `migrations/007_zoning.sql` on the PY DB (SQL editor) — additive.
2. Set `ZONING_ENABLED=1` in the buyer portal env; push; schedule `/api/cron/zoning` hourly (Bearer CRON_SECRET). First runs backfill ~860 Asunción listings at 300/run.
3. Mobile: ship in the next app build.

## Adding another city later (e.g. Luque)

Write `lib/zoning/luque.js` exporting `lookupLuqueZone(lat, lng)` with the same return shape (`{ code, category, maxFloors, label }` or null) — Luque's POUT map already carries `NPisoMax`, so category = `≤4 baja, 5–6 media, ≥7 alta`. Register it in `lib/zoning/providers.js`, add `luque: 'POUT Luque (Ord. 09/2025)'` to `ZONING_SOURCE_LABEL`, reset `zoning_checked_at` for Luque listings, and the cron fills them. Nothing else changes.
