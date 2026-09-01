// Recompute the persisted `is_complete` flag for every active building using the
// SAME gate the portal uses (lib/completeness.js), so server-side search/pagination
// returns exactly the marketplace-visible set. Dry-run by default; --commit writes.
// Safe to run on a schedule (hourly cron) to keep newly-scraped listings fresh.
//
//   node scripts/recompute-complete.mjs            # dry-run: prints the counts
//   node scripts/recompute-complete.mjs --commit   # write is_complete
//   node scripts/recompute-complete.mjs --rate 7450 --commit
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; }
}
const URL = process.env.AIROBASE_URL, KEY = process.env.AIROBASE_SECRET_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const { isCompleteListing, shapeForGate } = await import(pathToFileURL(path.resolve('lib/completeness.js')).href);

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const COMMIT = process.argv.includes('--commit');
const RATE = Number(arg('--rate', 7300)) || 7300; // coarse floors — exact FX not needed
const LAND = ['lote', 'terreno', 'campo', 'fracci', 'parcela'];
// PostgREST here wants URL-encoded % (%25), not * — matches lib/land.js buildingsParts.
const buildings = LAND.map((p) => `property_type=not.ilike.%25${p}%25`).join('&');
const COLS = 'id,price,currency,listing_type,contact_phone,city,neighborhood,bedrooms,bathrooms,parking_spaces,covered_area,floor_area,land_area,property_type';

console.log(`[recompute] ${COMMIT ? 'COMMIT' : 'DRY-RUN'} | rate=${RATE}`);

// 1) page all active building rows
const all = [];
for (let off = 0; ; off += 1000) {
  const q = `select=${COLS}&admin_status=eq.active&${buildings}&order=id&limit=1000&offset=${off}`;
  const r = await fetch(`${URL}/rest/v1/properties?${q}`, { headers: H });
  if (!r.ok) { console.error('[recompute] fetch error', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  const page = await r.json();
  if (!Array.isArray(page) || !page.length) break;
  all.push(...page);
  if (page.length < 1000) break;
  if (all.length % 5000 === 0) console.log(`  …loaded ${all.length}`);
}

// 2) compute is_complete + normalised price_usd for every row
let complete = 0, incomplete = 0;
const updates = []; // { id, is_complete, price_usd }
for (const row of all) {
  const shaped = shapeForGate(row, RATE);
  const ok = isCompleteListing(shaped);
  if (ok) complete++; else incomplete++;
  if (COMMIT) updates.push({ id: row.id, is_complete: ok, price_usd: shaped.usd ?? null });
}
console.log(`[recompute] active buildings: ${all.length.toLocaleString()} | complete: ${complete.toLocaleString()} | incomplete: ${incomplete.toLocaleString()}`);

if (!COMMIT) { console.log('[recompute] dry-run — nothing written. Add --commit to persist.'); process.exit(0); }

// 3) upsert (merge) is_complete + price_usd in batches — one request per 500 rows
for (let i = 0; i < updates.length; i += 500) {
  const batch = updates.slice(i, i + 500);
  const r = await fetch(`${URL}/rest/v1/properties?on_conflict=id`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(batch),
  });
  if (!r.ok) { console.error('  [upsert] error', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  if (i % 5000 === 0) console.log(`  …upserted ${Math.min(i + 500, updates.length)}/${updates.length}`);
}
console.log(`[recompute] done — ${complete.toLocaleString()} complete flagged.`);
