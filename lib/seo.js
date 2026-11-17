// The SEO pipeline, website side (the admin's Admin → SEO decides; this file reads its decisions at
// render time, so changes go live without a deploy):
//   seo_overrides  per page: title / H1 / description, the page variants switched on, extra links
//   seo_drafts     approved guides → /guias (numbers filled from live listings, refreshed monthly)
// Both are cached 5 minutes under the 'seo' tag (POST /api/seo/publish busts it at once).
// Live page stats (count, typical price, range, newest) come from the same active listings as the
// matrix, cached 5 minutes under 'listings'.
// Tables: migrations/011_seo_pipeline.sql in the ADMIN repo. Until a DB has them, everything here
// returns "nothing" and the pages render exactly as before. Server-only.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { select } from './db';
import { COUNTRY } from './country';
import { typeSlugOf, citySlugOf, slugify } from './matrix';
import { statsOf, inVariant, isVariantSlug, VARIANTS } from './seoVariants';
import { getUsdToPyg } from './fx';
import { fmtUsd, fmtPyg, roundConverted } from './money';

const CC = COUNTRY.code;

// seo_* tables: the country DB, or — LOCAL DEV ONLY, before the migration has run there — the admin's
// stand-in (SEO_DB_URL, scripts/dev-seo-db.mjs in the admin repo).
async function seoSelect(table, query) {
  if (process.env.SEO_DB_URL) {
    const key = process.env.SEO_DB_KEY || 'local-dev';
    const r = await fetch(`${process.env.SEO_DB_URL}/rest/v1/${table}?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (!r.ok) throw Object.assign(new Error(`seo db ${r.status}`), { status: r.status });
    return r.json();
  }
  return select(table, query);
}
const missingOk = async (fn) => { try { return await fn(); } catch { return []; } };

const getOverridesCached = unstable_cache(
  async () => missingOk(() => seoSelect('seo_overrides', `select=path,title,h1,description,enabled_variants,retired_variants,extra_links&country=eq.${CC}&limit=5000`)),
  ['cl-seo-overrides-v1'],
  { revalidate: 300, tags: ['seo'] },
);
export async function getOverride(path) {
  const rows = await getOverridesCached();
  return rows.find((r) => r.path === path) || null;
}
export async function enabledVariantPaths() {
  const rows = await getOverridesCached();
  return rows.flatMap((r) => (r.enabled_variants || []).filter(isVariantSlug).map((v) => ({ base: r.path, variant: v, path: `${r.path}/${v}` })));
}

// ── live stats ──
const getStatRowsCached = unstable_cache(
  async () => {
    const rows = await select('properties', 'select=listing_type,property_type,city,neighborhood,price_usd,bedrooms,created_at&is_complete=eq.true&admin_status=eq.active&limit=20000');
    return rows.map((r) => ({
      op: r.listing_type === 'rent' ? 'alquiler' : 'venta', tipo: typeSlugOf(r.property_type), ciudad: citySlugOf(r.city) || '',
      barrio: r.neighborhood ? slugify(r.neighborhood) : '', price_usd: r.price_usd == null ? null : Number(r.price_usd), bedrooms: r.bedrooms == null ? null : Number(r.bedrooms), created_at: r.created_at,
    })).filter((r) => r.tipo);
  },
  ['cl-seo-stat-rows-v1'],
  { revalidate: 300, tags: ['listings'] },
);

// Stats for a matrix path: /op/tipo/ciudad, /op/tipo/ciudad/barrio or /op/tipo/ciudad/variant.
export function statsForPathFromRows(rows, path) {
  const [op, tipo, ciudad, fourth] = String(path || '').split('/').filter(Boolean);
  if (!ciudad) return statsOf(rows.filter((r) => r.op === op && r.tipo === tipo));   // /{op}/{tipo}: the whole country (guides)
  const city = rows.filter((r) => r.op === op && r.tipo === tipo && r.ciudad === ciudad);
  if (!fourth) return statsOf(city);
  if (isVariantSlug(fourth)) {
    const cs = statsOf(city);
    return { ...statsOf(city.filter((r) => inVariant(r, fourth, cs.median))), cityMedian: cs.median };
  }
  return statsOf(city.filter((r) => r.barrio === fourth));
}
export async function pageStats(path) {
  try { return statsForPathFromRows(await getStatRowsCached(), path); } catch { return statsOf([]); }
}

// A price for the page copy: local currency with the US$ equivalent (or US$ only where that is the currency).
export async function moneyFormatter() {
  const rate = await getUsdToPyg().catch(() => null);
  return (usd) => {
    if (usd == null) return '—';
    const u = Math.round(Number(usd));
    if (COUNTRY.currencyCode === 'USD' || !rate) return fmtUsd(u);
    return `${fmtPyg(roundConverted(u * rate))} (≈ ${fmtUsd(roundConverted(u))})`;
  };
}

// ── guides from the pipeline (approved drafts) ──
const getDbGuidesCached = unstable_cache(
  async () => missingOk(() => seoSelect('seo_drafts', `select=slug,kind,title,h1,description,answer,sections,faq,related,approved_at,updated_at&country=eq.${CC}&status=eq.approved&order=approved_at.desc&limit=500`)),
  ['cl-seo-guides-v1'],
  { revalidate: 300, tags: ['seo'] },
);
export async function dbGuides() { return getDbGuidesCached(); }
export async function dbGuide(slug) { return (await getDbGuidesCached()).find((g) => g.slug === slug) || null; }

// Guide numbers refresh MONTHLY: the stats are cached per calendar month (key = YYYY-MM + paths).
const monthKey = () => new Date().toISOString().slice(0, 7);
const getGuideStatsCached = unstable_cache(
  async (month, pathsKey) => {
    const rows = await getStatRowsCached();
    return Object.fromEntries(pathsKey.split('|').filter(Boolean).map((p) => [p, statsForPathFromRows(rows, p)]));
  },
  ['cl-seo-guide-stats-v1'],
  { revalidate: 31 * 86400 },
);
export async function guideStats(paths) {
  try { return await getGuideStatsCached(monthKey(), [...paths].sort().join('|')); } catch { return {}; }
}

export { VARIANTS };
