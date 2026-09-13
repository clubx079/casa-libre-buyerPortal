// Pure dual-currency helpers (importable from server and client).
// `rate` = LOCAL currency units per 1 USD. Per-country currency/locale come from
// lib/country.js (NEXT_PUBLIC_COUNTRY); Paraguay (PYG / Gs. / es-PY) is unchanged.
import { COUNTRY } from './country';

// Round a CONVERTED (approximate) amount to a sensible human figure. The value
// came from a fluctuating FX rate, so we keep ~3 significant digits instead of
// implying false precision (e.g. Gs. 730,145,231 -> Gs. 730,000,000).
export function roundConverted(v) {
  if (!v || !Number.isFinite(v)) return v;
  const abs = Math.abs(v);
  let step;
  if (abs >= 100_000_000) step = 1_000_000;   // >=100M Gs  -> nearest 1,000,000
  else if (abs >= 10_000_000) step = 100_000; // >=10M  Gs  -> nearest 100,000
  else if (abs >= 1_000_000) step = 10_000;   // >=1M   Gs  -> nearest 10,000
  else if (abs >= 100_000) step = 1_000;      // >=100k Gs  -> nearest 1,000
  else if (abs >= 10_000) step = 1_000;       // USD side rarely this large
  else if (abs >= 1_000) step = 100;          // USD converted from PYG
  else if (abs >= 100) step = 10;
  else step = 1;
  return Math.round(v / step) * step;
}

// Given an original price + its currency, return both USD and local amounts.
// The ORIGINAL currency keeps its exact value; only the CONVERTED side is
// rounded, since it is an approximation derived from the live FX rate.
// (Return keys stay {usd, pyg} for back-compat; `pyg` = the local-currency side.)
export function dualPrice(price, currency, rate) {
  if (price == null || !rate) return { usd: null, pyg: null };
  const p = Number(price);
  if (!Number.isFinite(p)) return { usd: null, pyg: null };
  const cur = String(currency || '').toUpperCase();
  if (cur === COUNTRY.currencyCode) return { usd: roundConverted(Math.round(p / rate)), pyg: Math.round(p) };
  // USD (or unknown) is treated as USD
  return { usd: Math.round(p), pyg: roundConverted(Math.round(p * rate)) };
}

export function fmtUsd(v, loc) {
  return v == null ? '—' : 'US$ ' + Number(v).toLocaleString(loc || COUNTRY.locale);
}
export function fmtPyg(v, loc) {
  return v == null ? '—' : COUNTRY.currencyPrefix + Number(v).toLocaleString(loc || COUNTRY.locale);
}

// Referential FX-rate note for a small footnote near converted prices (audit #15).
// `rate` = local currency per USD; `source` = named provider; `dateIso` = the
// rate's own last-update date.
export function fmtRate(rate, lang, source, dateIso) {
  if (!rate || !Number.isFinite(Number(rate))) return null;
  // Big rates (e.g. PYG ~7300) round to the nearest 50 for a clean read; small
  // rates (BOB ~7, UYU ~40) keep 2 decimals instead of collapsing to 0.
  const n = Number(rate);
  const r = n >= 1000 ? Math.round(n / 50) * 50 : Math.round(n * 100) / 100;
  const gs = COUNTRY.currencyPrefix + r.toLocaleString(lang === 'en' ? 'en-US' : COUNTRY.locale);
  const src = source || COUNTRY.fxSource;
  let dateStr = '';
  if (dateIso) {
    try {
      dateStr = new Date(dateIso).toLocaleDateString(lang === 'en' ? 'en-US' : COUNTRY.locale, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { /* omit date if unparseable */ }
  }
  return lang === 'en'
    ? `Reference rate: US$ 1 ≈ ${gs} · source ${src}${dateStr ? ` · updated ${dateStr}` : ''}. Converted amounts are approximate.`
    : `Cotización referencial: US$ 1 ≈ ${gs} · fuente ${src}${dateStr ? ` · actualizado ${dateStr}` : ''}. Los montos convertidos son aproximados.`;
}
