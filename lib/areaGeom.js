// Where to point the map for a search: robust bounds, an approximate outline and a label
// spot for an area, from the coordinates of its listings. Pure, so `npm test` runs it.
//
// Why "robust": a few listings sit far from where they really are (a Ciudad del Este flat
// geocoded into the Chaco, a Hernandarias house geocoded in Asunción, the centre-of-Paraguay
// fallback), and many sit on one spot (a building, or a barrio centroid). Fitting the map
// to the raw min/max then lands between two cities or zooms in to a single building.
// So: points far from the crowd are dropped, and the box never gets smaller than the area.
import { distanceKm } from '../utils/geo.js';

const median = (arr) => {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const quantile = (arr, q) => {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))];
};

const valid = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 && !(p[0] === 0 && p[1] === 0);

// The middle of the crowd: per-axis median (one far point can't move it).
export function crowdCenter(points) {
  const pts = (points || []).filter(valid);
  if (!pts.length) return null;
  return [median(pts.map((p) => p[0])), median(pts.map((p) => p[1]))];
}

// [[lat,lng],…] without the points far from the crowd: further from the median point than
// `k` times the distance three quarters of the points are within (at least `minKm`).
// Fewer than 4 points: kept as they are, unless one is over `maxKm` from the others' middle.
// `isolatedOnly` (free-text searches, whose matches may really be in several cities): a far
// point is only dropped when it is alone there, fewer than `minNear` other points within
// `nearKm` — a misplaced pin, not a second town.
export function dropOutliers(points, { k = 4, minKm = 3, maxKm = 150, isolatedOnly = false, nearKm = 10, minNear = 2 } = {}) {
  const pts = (points || []).filter(valid);
  if (pts.length < 2) return pts;
  const c = crowdCenter(pts);
  const d = pts.map((p) => distanceKm(c[0], c[1], p[0], p[1]));
  if (pts.length < 4) {
    const keep = pts.filter((p, i) => d[i] <= maxKm);
    return keep.length ? keep : pts;
  }
  if (!isolatedOnly) {
    const cutoff = Math.max(minKm, k * quantile(d, 0.75));
    return pts.filter((p, i) => d[i] <= cutoff);
  }
  // Several towns: "far" is measured against the main crowd only (half the points), and a
  // far point stays when it has company.
  const cutoff = Math.max(minKm, k * median(d));
  const kLng = kmPerDegLng(c[0]);
  const near = (a, b) => Math.hypot((a[0] - b[0]) * KM_PER_DEG_LAT, (a[1] - b[1]) * kLng) <= nearKm;
  return pts.filter((p, i) => {
    if (d[i] <= cutoff) return true;
    let n = 0;
    for (let j = 0; j < pts.length && n < minNear; j++) if (j !== i && near(p, pts[j])) n++;
    return n >= minNear;
  });
}

const KM_PER_DEG_LAT = 110.57;
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

// { n, s, e, w } of the points, grown around its middle to at least `minKm` on each side.
export function boundsOf(points, { minKm = 0 } = {}) {
  const pts = (points || []).filter(valid);
  if (!pts.length) return null;
  let n = -90, s = 90, e = -180, w = 180;
  for (const [lat, lng] of pts) { if (lat > n) n = lat; if (lat < s) s = lat; if (lng > e) e = lng; if (lng < w) w = lng; }
  if (minKm > 0) {
    const cLat = (n + s) / 2, cLng = (e + w) / 2;
    const hLat = minKm / 2 / KM_PER_DEG_LAT, hLng = minKm / 2 / Math.max(1e-6, kmPerDegLng(cLat));
    if (n - s < 2 * hLat) { n = cLat + hLat; s = cLat - hLat; }
    if (e - w < 2 * hLng) { e = cLng + hLng; w = cLng - hLng; }
  }
  return { n, s, e, w };
}

// Smallest box a kind of area is shown at: a barrio is a few blocks, a city a few km.
export const MIN_SPAN_KM = { barrio: 1.4, city: 5, dept: 30, search: 2 };

// Bounds to fit the map to for these listing coordinates.
// kind 'barrio' | 'city' | 'dept' (a picked place) or 'search' (any other result list).
export function searchBounds(points, kind = 'search') {
  const keep = dropOutliers(points, { minKm: kind === 'dept' ? 25 : kind === 'city' ? 6 : 3, isolatedOnly: kind === 'search' });
  return boundsOf(keep, { minKm: MIN_SPAN_KM[kind] || MIN_SPAN_KM.search });
}

// Convex hull (monotone chain) of [x,y] points, counter-clockwise, not closed.
export function convexHull(points) {
  const pts = [...new Map((points || []).map((p) => [p[0] + ',' + p[1], p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// A circle of `km` radius around [lat,lng] as a closed [[lng,lat],…] ring.
export function circleRing(center, km, steps = 32) {
  const [lat, lng] = center, ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lng + (Math.cos(a) * km) / kmPerDegLng(lat), lat + (Math.sin(a) * km) / KM_PER_DEG_LAT]);
  }
  return ring;
}

const BUFFER_KM = { barrio: 0.18, city: 0.6, dept: 3 };
const SPOT_KM = { barrio: 0.45, city: 2.2, dept: 12 };

// The outline drawn for a searched area: the hull of its listings (outliers dropped),
// pushed out a little so edge pins sit inside; a circle when the listings are on one
// spot or a line. Closed [[lng,lat],…] ring (GeoJSON order), or null.
export function areaRing(points, kind = 'barrio') {
  const keep = dropOutliers(points, { minKm: kind === 'dept' ? 25 : kind === 'city' ? 6 : 3 });
  const c = crowdCenter(keep);
  if (!c) return null;
  const xy = keep.map(([lat, lng]) => [lng, lat]);
  const hull = convexHull(xy);
  const b = boundsOf(keep);
  const spanKm = Math.min((b.n - b.s) * KM_PER_DEG_LAT, (b.e - b.w) * kmPerDegLng(c[0]));
  if (hull.length < 3 || spanKm < (SPOT_KM[kind] || 0.45) / 2) return circleRing(c, SPOT_KM[kind] || 0.45);
  const buf = BUFFER_KM[kind] || 0.2;
  const cx = hull.reduce((a, p) => a + p[0], 0) / hull.length, cy = hull.reduce((a, p) => a + p[1], 0) / hull.length;
  const ring = hull.map(([x, y]) => {
    const dx = (x - cx) * kmPerDegLng(cy), dy = (y - cy) * KM_PER_DEG_LAT, len = Math.hypot(dx, dy) || 1;
    return [x + ((dx / len) * buf) / kmPerDegLng(cy), y + ((dy / len) * buf) / KM_PER_DEG_LAT];
  });
  ring.push(ring[0]);
  return ring;
}

// Everything the map needs to show one searched place: outline, label spot (the top of
// the outline, so the name sits above the pins), bounds to fit.
export function placeArea(place) {
  if (!place || !place.pts || !place.pts.length) return null;
  const kind = place.kind || 'barrio';
  const ring = kind === 'dept' ? null : areaRing(place.pts, kind);
  const bounds = searchBounds(place.pts, kind);
  let top = null;
  if (ring) for (const p of ring) if (!top || p[1] > top[1]) top = p;
  if (!top) top = [(bounds.e + bounds.w) / 2, bounds.n];
  return { id: place.id, name: place.name, kind, ring, label: top, bounds };
}

// One label per barrio with enough listings, at the middle of its crowd: [{ id, name, lat, lng }].
export function barrioLabels(places, { min = 3 } = {}) {
  const out = [];
  for (const p of places || []) {
    if (p.kind !== 'barrio' || p.pts.length < min) continue;
    const c = crowdCenter(dropOutliers(p.pts));
    if (c) out.push({ id: p.id, name: p.name, lat: Math.round(c[0] * 1e5) / 1e5, lng: Math.round(c[1] * 1e5) / 1e5 });
  }
  return out;
}
