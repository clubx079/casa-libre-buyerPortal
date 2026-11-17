// SEO page variants + live page stats (pure — tests/seoVariants.test.mjs). A variant is a REAL filter
// on a city page (/{op}/{tipo}/{ciudad}/{variant}):
//   baratos         price (US$) below the median of that op + type + city
//   N-dormitorio(s) exactly N bedrooms
// A variant page only exists when the admin's SEO pipeline switched it on (seo_overrides.enabled_variants
// of the city page), is indexed + in the sitemap only with ≥ MIN listings (the same 5-listing gate as
// every matrix page), and answers noindex once the weekly loop retired it (retired_variants).
// Same list as the admin's lib/seo/matrix.js VARIANTS.
export const VARIANTS = {
  baratos: { kind: 'cheap', es: 'baratos', esSing: 'barato', en: 'cheap', pt: 'baratos' },
  '1-dormitorio': { kind: 'beds', beds: 1, es: 'de 1 dormitorio', en: 'with 1 bedroom', pt: 'de 1 quarto' },
  '2-dormitorios': { kind: 'beds', beds: 2, es: 'de 2 dormitorios', en: 'with 2 bedrooms', pt: 'de 2 quartos' },
  '3-dormitorios': { kind: 'beds', beds: 3, es: 'de 3 dormitorios', en: 'with 3 bedrooms', pt: 'de 3 quartos' },
};
export const isVariantSlug = (s) => Object.prototype.hasOwnProperty.call(VARIANTS, String(s || ''));

export function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// rows: [{ price_usd, created_at, ... }] → { count, priced, median, min, max, newest }
export function statsOf(rows) {
  const prices = rows.map((r) => Number(r.price_usd)).filter((n) => Number.isFinite(n) && n > 0);
  return {
    count: rows.length,
    priced: prices.length,
    median: median(prices),
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    newest: rows.map((r) => r.created_at).filter(Boolean).sort().pop() || null,
  };
}

export function inVariant(row, slug, cityMedian) {
  const v = VARIANTS[slug];
  if (!v) return false;
  if (v.kind === 'cheap') { const p = Number(row.price_usd); return Number.isFinite(p) && p > 0 && cityMedian != null && p < cityMedian; }
  if (v.kind === 'beds') return Number(row.bedrooms) === v.beds;
  return false;
}

// The filter the listing grid uses for a variant: cheap → price_usd below the median; beds → exact.
export function variantFilter(slug, cityMedian) {
  const v = VARIANTS[slug];
  if (!v) return null;
  if (v.kind === 'cheap') return cityMedian ? { priceMax: Math.floor(cityMedian - 0.01) } : null;
  if (v.kind === 'beds') return { bedsExact: v.beds };
  return null;
}

// 'index' | 'noindex' | 'off' (404) — see the header.
export function variantState({ slug, count = 0, enabled = [], retired = [], min = 5 }) {
  if (!isVariantSlug(slug) || !count) return 'off';
  if ((enabled || []).includes(slug)) return count >= min ? 'index' : 'noindex';
  if ((retired || []).includes(slug)) return 'noindex';
  return 'off';
}

// An override title may carry {count}: filled with the live listing count at render time.
export const fillCount = (s, count) => (s ? String(s).replace(/\{count\}/g, String(count)) : s);
