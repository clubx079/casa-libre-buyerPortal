// Live USD -> PYG (guaraníes) exchange rate for dual-currency display.
// Uses the free, key-less open.er-api.com feed, cached ~6h in-memory and via the
// Next fetch cache. Falls back to the PYG_PER_USD env value if the feed is down.
import 'server-only';

const TTL = 6 * 3600 * 1000;
let cache = null; // { pyg, at, updated }  — `updated` = source's own last-update ISO date

export const FX_SOURCE = 'open.er-api.com';
const fallback = () => Number(process.env.PYG_PER_USD) || 7300;

// Guaraníes per 1 USD.
export async function getUsdToPyg() {
  if (cache && Date.now() - cache.at < TTL) return cache.pyg;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 21600 } });
    if (r.ok) {
      const d = await r.json();
      const pyg = d?.rates?.PYG;
      if (pyg && Number.isFinite(Number(pyg))) {
        const updated = d?.time_last_update_unix ? new Date(d.time_last_update_unix * 1000).toISOString() : null;
        cache = { pyg: Number(pyg), at: Date.now(), updated };
        return cache.pyg;
      }
    }
  } catch { /* fall through to fallback */ }
  const fb = fallback();
  cache = { pyg: fb, at: Date.now(), updated: null };
  return fb;
}

// Rate + provenance for the referential FX note (audit #15): the live rate, its
// named source, and the source's own last-update date (null on the env fallback).
export async function getFxMeta() {
  const rate = await getUsdToPyg();
  return { rate, source: FX_SOURCE, updated: cache?.updated || null };
}
