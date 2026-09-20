// SEO landing-page matrix: operation × property-type × city (e.g. /venta/casas/asuncion).
// Pure, country-dynamic. Combos are generated FROM inventory and gated at MIN_LISTINGS
// so we never publish a thin/empty page. Discovery is via the sitemap; these helpers
// also drive the route's validation, H1/intro copy, and indexability.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { select } from './db';
import { COUNTRY } from './country';
import { CITIES } from './site';

export const MIN_LISTINGS = 5; // below this, a combo is not indexed / not in the sitemap.

// URL operation slug → internal listing filter + Spanish label.
export const OPS = {
  venta: { op: 'venta', label: 'en venta', short: 'Venta' },
  alquiler: { op: 'alquiler', label: 'en alquiler', short: 'Alquiler' },
};

// URL type slug (SEO-friendly plural) → { type: internal slug used by searchListings,
// kw: property_type match keywords, sing/plural: display labels }.
export const TIPOS = {
  casas: { type: 'casa', kw: ['casa', 'house'], sing: 'casa', plural: 'casas' },
  departamentos: { type: 'depto', kw: ['departamento', 'depto', 'apartment', 'flat'], sing: 'departamento', plural: 'departamentos' },
  duplex: { type: 'duplex', kw: ['duplex', 'dúplex'], sing: 'dúplex', plural: 'dúplex' },
  oficinas: { type: 'oficina', kw: ['oficina', 'office'], sing: 'oficina', plural: 'oficinas' },
  locales: { type: 'comercial', kw: ['comercial', 'local', 'commercial', 'tienda'], sing: 'local comercial', plural: 'locales comerciales' },
  depositos: { type: 'deposito', kw: ['deposito', 'depósito', 'warehouse', 'galp'], sing: 'depósito', plural: 'depósitos' },
};

export const isOp = (s) => Object.prototype.hasOwnProperty.call(OPS, String(s || ''));
export const tipoBySlug = (s) => TIPOS[String(s || '')] || null;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Which type slug does a raw property_type string belong to? First keyword hit wins.
function typeSlugOf(propertyType) {
  const h = norm(propertyType);
  for (const [slug, t] of Object.entries(TIPOS)) {
    if (t.kw.some((k) => h.includes(norm(k)))) return slug;
  }
  return null;
}

// Which city slug does a raw city string belong to? (matches the configured CITIES).
function citySlugOf(city) {
  const h = norm(city);
  if (!h) return null;
  const hit = CITIES.find((c) => h === norm(c.name) || h.includes(norm(c.name)) || h === c.slug);
  return hit ? hit.slug : null;
}

// Aggregate active inventory into combo counts, in ONE lightweight query (no GROUP BY
// needed — we tally in JS over ~a few thousand rows). Cached; busts on the 'listings' tag.
export const getMatrixCombos = unstable_cache(
  async () => {
    let rows = [];
    try {
      rows = await select(
        'properties',
        'select=listing_type,property_type,city&is_complete=eq.true&admin_status=eq.active&price=gt.0&limit=20000',
      );
    } catch { rows = []; }
    const counts = new Map(); // key `${op}/${tipo}/${ciudad}` -> count
    for (const r of rows) {
      const op = r.listing_type === 'rent' ? 'alquiler' : 'venta';
      const tipo = typeSlugOf(r.property_type);
      const ciudad = citySlugOf(r.city);
      if (!tipo || !ciudad) continue;
      const k = `${op}/${tipo}/${ciudad}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return [...counts.entries()].map(([k, count]) => {
      const [op, tipo, ciudad] = k.split('/');
      return { op, tipo, ciudad, count };
    });
  },
  ['cl-matrix-combos-v1'],
  { revalidate: 3600, tags: ['listings'] },
);

// Count for one combo (from the aggregated set). 0 if the combo has no inventory.
export async function comboCount({ op, tipo, ciudad }) {
  const combos = await getMatrixCombos();
  const hit = combos.find((c) => c.op === op && c.tipo === tipo && c.ciudad === ciudad);
  return hit ? hit.count : 0;
}

// Combos that clear the MIN_LISTINGS gate (indexed + listed in the sitemap).
export async function indexableCombos() {
  return (await getMatrixCombos()).filter((c) => c.count >= MIN_LISTINGS);
}

// ── Level 4: neighborhood (barrio) matrix — /{op}/{tipo}/{ciudad}/{barrio} ──────
// InfoCasas' biggest tier. Barrios are free-text (`properties.neighborhood`), so we
// generate them FROM inventory and slugify. Same MIN_LISTINGS gate → only barrios
// with real depth get a page (never thin pages). The canonical display name is the
// most frequent raw spelling seen for a slug.
const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export const getMatrixBarrioCombos = unstable_cache(
  async () => {
    let rows = [];
    try {
      rows = await select(
        'properties',
        'select=listing_type,property_type,city,neighborhood&is_complete=eq.true&admin_status=eq.active&price=gt.0&limit=20000',
      );
    } catch { rows = []; }
    const map = new Map(); // key op/tipo/ciudad/barrioSlug -> { count, names: Map(name->n) }
    for (const r of rows) {
      const op = r.listing_type === 'rent' ? 'alquiler' : 'venta';
      const tipo = typeSlugOf(r.property_type);
      const ciudad = citySlugOf(r.city);
      const bname = String(r.neighborhood || '').trim();
      if (!tipo || !ciudad || !bname) continue;
      const barrio = slugify(bname);
      if (!barrio) continue;
      const k = `${op}/${tipo}/${ciudad}/${barrio}`;
      let e = map.get(k);
      if (!e) { e = { count: 0, names: new Map() }; map.set(k, e); }
      e.count += 1;
      e.names.set(bname, (e.names.get(bname) || 0) + 1);
    }
    return [...map.entries()].map(([k, e]) => {
      const [op, tipo, ciudad, barrio] = k.split('/');
      let barrioName = barrio, best = -1;
      for (const [name, n] of e.names) if (n > best) { best = n; barrioName = name; }
      return { op, tipo, ciudad, barrio, barrioName, count: e.count };
    });
  },
  ['cl-matrix-barrio-combos-v1'],
  { revalidate: 3600, tags: ['listings'] },
);

// Barrio combos that clear the gate (indexed + in the sitemap + servable).
export async function indexableBarrioCombos() {
  return (await getMatrixBarrioCombos()).filter((c) => c.count >= MIN_LISTINGS);
}
// One barrio combo (or null). Carries the canonical display name + count.
export async function resolveBarrio({ op, tipo, ciudad, barrio }) {
  return (await getMatrixBarrioCombos()).find(
    (c) => c.op === op && c.tipo === tipo && c.ciudad === ciudad && c.barrio === barrio,
  ) || null;
}
// Indexable barrios for a given city page (its internal-link block).
export async function barriosForCity(op, tipo, ciudad) {
  return (await indexableBarrioCombos()).filter((c) => c.op === op && c.tipo === tipo && c.ciudad === ciudad);
}

// Data-templated copy for a barrio combo (H1, <title>, meta description, intro).
export function comboContentBarrio({ op, tipo, barrioName, cityName, count = 0 }) {
  const o = OPS[op];
  const t = TIPOS[tipo];
  const Tipo = t.plural.charAt(0).toUpperCase() + t.plural.slice(1);
  const place = `${barrioName}, ${cityName}`;
  const h1 = `${o.short} de ${t.plural} en ${place}`;
  const title = `${Tipo} ${o.label} en ${place} — ${count} propiedades | Casa Libre`;
  const description = `${count} ${t.plural} ${o.label} en ${barrioName}, ${cityName}, ${COUNTRY.name}. Explorá precios, fotos y ubicación en el mapa con Casa Libre. Buscar es gratis.`;
  const intro = `Encontrá ${t.plural} ${o.label} en ${barrioName} (${cityName}). Casa Libre reúne ${count} ${count === 1 ? 'propiedad' : 'propiedades'} de ${t.plural} ${o.label} en ${barrioName} y la zona — filtrá por precio, dormitorios y superficie, y compará cada opción en el mapa con fotos reales.`;
  return { h1, title, description, intro, place };
}

// Unique, data-templated copy for a combo (H1, <title>, meta description, intro).
export function comboContent({ op, tipo, ciudad, count = 0 }) {
  const o = OPS[op];
  const t = TIPOS[tipo];
  const city = CITIES.find((c) => c.slug === ciudad);
  const cityName = city ? city.name : ciudad;
  const Tipo = t.plural.charAt(0).toUpperCase() + t.plural.slice(1);
  const h1 = `${o.short} de ${t.plural} en ${cityName}`;
  const title = `${Tipo} ${o.label} en ${cityName} — ${count} propiedades | Casa Libre`;
  const description = `${count} ${t.plural} ${o.label} en ${cityName}, ${COUNTRY.name}. Explorá precios, fotos y ubicación en el mapa con Casa Libre. Buscar es gratis.`;
  const intro = `Encontrá ${t.plural} ${o.label} en ${cityName}. Casa Libre reúne ${count} ${count === 1 ? 'propiedad' : 'propiedades'} de ${t.plural} ${o.label} en ${cityName} y alrededores — filtrá por precio, dormitorios y superficie, y compará cada opción en el mapa con fotos reales.`;
  return { h1, title, description, intro, cityName, tipoLabel: t.plural, opLabel: o.label };
}
