// The country's place index (every barrio / city / departamento the live listings name,
// lib/places.js), built on the server from the listings' place fields and kept in memory.
//
//  - getPlacePayload(): the compact copy the browser downloads once for the search
//    suggestions (/api/listings/places), plus barrio-name labels for the map.
//  - placeById(id): the full place (listing coordinates + stored spellings) that
//    lib/marketplace.js turns into the "listings in this place" filter.
//  - placeAreaById(id): outline + label spot + box for the map (/api/listings/places?id=).
//
// Read-only: one paged SELECT of the active listings' place columns, rebuilt every 15 min
// (stale copy served while the new one builds). Kept on globalThis so every route of the
// server process shares one copy.
import 'server-only';
import { select } from './db';
import { COUNTRY } from './country';
import { buildPlaceIndex, compactIndex, ASUNCION_BARRIOS } from './places';
import { searchBounds, barrioLabels, placeArea } from './areaGeom';
import { atUnknownSpot } from './placeFilter';

const TTL_MS = 15 * 60 * 1000;
const PAGE = 5000;
const MAX_ROWS = 80000;
const KEY = '__clPlaceIndex';

const toNum = (v) => (v == null || v === '' ? null : Number(v));

async function loadRows() {
  const out = [];
  for (let offset = 0; offset < MAX_ROWS;) {
    const q = ['is_complete=eq.true', 'admin_status=eq.active', 'select=id,latitude,longitude,city,neighborhood,province,address', 'order=id', `limit=${PAGE}`, `offset=${offset}`].join('&');
    const rows = await select('properties', q);
    if (!Array.isArray(rows) || !rows.length) break;
    out.push(...rows);
    offset += rows.length;
    if (rows.length < PAGE && rows.length % 1000 !== 0) break;   // a short page = the end (a server cap returns round pages)
  }
  return out;
}

async function build() {
  const rows = await loadRows();
  const listings = rows.map((r) => {
    let lat = toNum(r.latitude), lng = toNum(r.longitude);
    // "Address not found, only the country matched" → no location (lib/placeFilter.js).
    if (lat != null && lng != null && atUnknownSpot(COUNTRY.code, lat, lng)) { lat = null; lng = null; }
    return { id: r.id, lat, lng, city: r.city, neighborhood: r.neighborhood, province: r.province, address: r.address };
  });
  const capital = COUNTRY.code === 'py' ? 'Asunción' : '';
  const index = buildPlaceIndex(listings, capital ? { capital, capitalBarrios: ASUNCION_BARRIOS } : {});
  if (capital) for (const p of index.places) if (p.kind === 'dept') p.notCity = capital;   // lib/placeFilter.js
  const payload = {
    country: COUNTRY.code,
    places: compactIndex(index, (p) => (p.pts.length ? searchBounds(p.pts, p.kind) : null)),
    labels: barrioLabels(index.places),
  };
  return { at: Date.now(), index, payload };
}

function state() {
  if (!globalThis[KEY]) globalThis[KEY] = { data: null, pending: null };
  return globalThis[KEY];
}

export async function getPlaceData() {
  const st = state();
  const fresh = st.data && Date.now() - st.data.at < TTL_MS;
  if (fresh) return st.data;
  if (!st.pending) {
    st.pending = build()
      .then((d) => { st.data = d; return d; })
      .finally(() => { st.pending = null; });
  }
  // A stale copy answers at once while the new one builds; the first build is awaited.
  if (st.data) { st.pending.catch(() => {}); return st.data; }
  return st.pending;
}

export async function getPlacePayload() {
  return (await getPlaceData()).payload;
}

export async function placeById(id) {
  if (!id) return null;
  return (await getPlaceData()).index.byId.get(String(id)) || null;
}

const r5 = (v) => Math.round(v * 1e5) / 1e5;
export async function placeAreaById(id) {
  const a = placeArea(await placeById(id));
  if (!a) return null;
  return {
    ...a,
    ring: a.ring ? a.ring.map(([x, y]) => [r5(x), r5(y)]) : null,
    label: [r5(a.label[0]), r5(a.label[1])],
  };
}
