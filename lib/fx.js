// Live USD -> local-currency exchange rate for dual-currency display.
// Uses the free, key-less open.er-api.com feed, cached ~6h in-memory and via the
// Next fetch cache. The target currency + fallback rate come from lib/country.js
// (NEXT_PUBLIC_COUNTRY); Paraguay (PYG / 7300) is unchanged.
import 'server-only';
import { COUNTRY } from './country';

const TTL = 6 * 3600 * 1000;
let cache = null; // { pyg, at, updated }  — `pyg` = local currency per USD; `updated` = source's own last-update ISO date

export const FX_SOURCE = COUNTRY.fxSource;
// Env override is `<CUR>_PER_USD` (e.g. PYG_PER_USD, BOB_PER_USD, UYU_PER_USD).
const fallback = () => Number(process.env[`${COUNTRY.fxTarget}_PER_USD`]) || COUNTRY.fxFallback;

// Local currency units per 1 USD (name kept for back-compat; also exported as getUsdToLocal).
export async function getUsdToPyg() {
  if (cache && Date.now() - cache.at < TTL) return cache.pyg;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 21600 } });
    if (r.ok) {
      const d = await r.json();
      const rate = d?.rates?.[COUNTRY.fxTarget];
      if (rate && Number.isFinite(Number(rate))) {
        const updated = d?.time_last_update_unix ? new Date(d.time_last_update_unix * 1000).toISOString() : null;
        cache = { pyg: Number(rate), at: Date.now(), updated };
        return cache.pyg;
      }
    }
  } catch { /* fall through to fallback */ }
  const fb = fallback();
  cache = { pyg: fb, at: Date.now(), updated: null };
  return fb;
}
export const getUsdToLocal = getUsdToPyg;

// Rate + provenance for the referential FX note (audit #15): the live rate, its
// named source, and the source's own last-update date (null on the env fallback).
export async function getFxMeta() {
  const rate = await getUsdToPyg();
  return { rate, source: FX_SOURCE, updated: cache?.updated || null };
}
