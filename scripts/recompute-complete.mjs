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
const GATE = 'id,price,currency,listing_type,contact_phone,city,neighborhood,bedrooms,bathrooms,parking_spaces,covered_area,floor_area,land_area,property_type';
// In commit mode also read the current flags so we only write rows that changed.
const COLS = GATE + (COMMIT ? ',is_complete,price_usd' : '');
const CONC = 16;

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

// 2) compute is_complete + normalised price_usd; queue only rows that changed
let complete = 0, incomplete = 0;
const updates = []; // { id, is_complete, price_usd }
const numOrNull = (v) => (v == null ? null : Number(v));
for (const row of all) {
  const shaped = shapeForGate(row, RATE);
  const ok = isCompleteListing(shaped);
  if (ok) complete++; else incomplete++;
  if (COMMIT) {
    const priceUsd = shaped.usd ?? null;
    const changed = row.is_complete !== ok || numOrNull(row.price_usd) !== numOrNull(priceUsd);
    if (changed) updates.push({ id: row.id, is_complete: ok, price_usd: priceUsd });
  }
}
console.log(`[recompute] active buildings: ${all.length.toLocaleString()} | complete: ${complete.toLocaleString()} | incomplete: ${incomplete.toLocaleString()}`);

if (!COMMIT) { console.log('[recompute] dry-run — nothing written. Add --commit to persist.'); process.exit(0); }

// 3) per-row PATCH (UPDATE only — no INSERT, so NOT NULL columns are untouched),
// via a small concurrency pool. Only the changed rows are written.
console.log(`[recompute] writing ${updates.length.toLocaleString()} changed rows (conc=${CONC})…`);
let done = 0, failed = 0, idx = 0;
async function worker() {
  while (idx < updates.length) {
    const u = updates[idx++];
    try {
      const r = await fetch(`${URL}/rest/v1/properties?id=eq.${u.id}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ is_complete: u.is_complete, price_usd: u.price_usd }),
      });
      if (!r.ok) { failed++; if (failed <= 5) console.error('  [patch]', r.status, (await r.text()).slice(0, 120)); }
      else done++;
    } catch (e) { failed++; }
    if ((done + failed) % 2000 === 0) console.log(`  …${done + failed}/${updates.length}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`[recompute] done — wrote ${done}, failed ${failed}. Complete set: ${complete.toLocaleString()}.`);
