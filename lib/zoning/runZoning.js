// Fill per-listing zoning for cities that have a provider (lib/zoning/providers.js).
// Pure with injected deps: db = lib/db-shaped, providerFor = providerForCity.
// - new listings and listings whose coordinates moved are (re)checked
// - cities without a provider are marked checked with no zone (never queried)
// - a provider error leaves the listing unchecked so the next run retries it
const moved = (r) => r.zoning_checked_at && (Number(r.zoning_lat) !== Number(r.latitude) || Number(r.zoning_lng) !== Number(r.longitude));

export async function runZoning({ db, now = new Date(), providerFor, limit = 300, concurrency = 4 }) {
  const out = { checked: 0, zoned: 0, noZone: 0, failed: 0, skipped: 0 };
  const rows = await db.select('properties',
    'select=id,city,latitude,longitude,zoning_checked_at,zoning_lat,zoning_lng&admin_status=eq.active&latitude=not.is.null&longitude=not.is.null&order=created_at.desc&limit=5000');
  const due = rows.filter((r) => !r.zoning_checked_at || moved(r)).slice(0, limit);
  const nowIso = now.toISOString();
  const save = (r, patch) => db.update('properties', `id=eq.${encodeURIComponent(r.id)}`,
    { ...patch, zoning_lat: r.latitude, zoning_lng: r.longitude, zoning_checked_at: nowIso }, { returning: 'minimal' });

  let i = 0;
  async function worker() {
    while (i < due.length) {
      const r = due[i++];
      out.checked++;
      const p = providerFor(r.city);
      if (!p) {
        await save(r, { zoning_code: null, zoning_category: null, zoning_max_floors: null, zoning_source: null });
        out.skipped++;
        continue;
      }
      let z;
      try { z = await p.lookup(r.latitude, r.longitude); } catch { out.failed++; continue; }
      await save(r, { zoning_code: z?.code || null, zoning_category: z?.category || null, zoning_max_floors: z?.maxFloors ?? null, zoning_source: p.id });
      if (z) out.zoned++; else out.noZone++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, worker));
  return out;
}
