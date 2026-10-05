// "Listings follow the map": after the visitor drags or zooms the map, the list
// shows only the listings inside the visible area. The area travels as four edges
// (n/s/e/w), rounded to ~100 m so nearby map positions share a search cache entry.

const r3 = (v) => Math.round(Number(v) * 1000) / 1000;

export function roundArea({ n, s, e, w }) {
  return { n: r3(n), s: r3(s), e: r3(e), w: r3(w) };
}

// The area from a search request, or null when absent / invalid (then no filter).
export function parseArea(p = {}) {
  const n = Number(p.n), s = Number(p.s), e = Number(p.e), w = Number(p.w);
  if (![p.n, p.s, p.e, p.w].every((v) => v !== undefined && v !== null && v !== '')) return null;
  if (![n, s, e, w].every(Number.isFinite)) return null;
  if (Math.abs(n) > 90 || Math.abs(s) > 90 || Math.abs(e) > 180 || Math.abs(w) > 180) return null;
  if (n <= s || e <= w) return null;
  return { n, s, e, w };
}

// PostgREST filter parts for listings inside the area.
export function areaParts(area) {
  if (!area) return [];
  return [`latitude=gte.${area.s}`, `latitude=lte.${area.n}`, `longitude=gte.${area.w}`, `longitude=lte.${area.e}`];
}
