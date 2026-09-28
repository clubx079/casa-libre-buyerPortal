// Pre-render Asunción's zoning (Plan Regulador, layer 4) into standard XYZ map tiles
// in Casa Libre colours, so the website and the app never wait on the city's slow
// ArcGIS server at runtime (~2.5 s per picture there; a tile from our proxy is ~50 ms).
//
//   node scripts/build-zoning-tiles.mjs            # generate to <out> (zooms 11–17)
//   node scripts/build-zoning-tiles.mjs --upload   # …then upload to B2 under zoning/asuncion/<VERSION>/
//   options: --zooms=11-17  --out=<dir>  --concurrency=4
//
// Output per tile set (all | baja | media | alta): <set>/<z>/<x>/<y>.png, empty tiles
// skipped, plus index.json = { version, bounds, minZoom, maxZoom, sets: { set: ["z/x/y", …] } }
// so a client only requests tiles that exist. Served by /api/media/zoning/asuncion/<VERSION>/…
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const VERSION = 'v1';
const [ZMIN, ZMAX] = String(args.zooms || '11-17').split('-').map(Number);
const OUT = args.out || path.join(process.env.TEMP || '/tmp', 'casa-libre-zoning-tiles');
const CONC = Number(args.concurrency) || 4;

// Same city box as the app/website overlays, and the same rules table as lib/zoning/asuncionRules.js.
const BOUNDS = { s: -25.375, n: -25.205, w: -57.685, e: -57.515 };
const GROUPS = [
  { key: 'baja', color: [0x4f, 0x9d, 0x7a], codes: ['AR1A', 'AR1B'] },
  { key: 'media', color: [0xe0, 0xa3, 0x3a], codes: ['AR2A', 'AR2B', 'AR2B MOD', 'AR3A', 'AR3A_1'] },
  { key: 'alta', color: [0xc4, 0x51, 0x3a], codes: ['AR3B', 'CENTRAL', 'EJE VILLA MORRA', 'FM1A', 'FM1B', 'FM2', 'FM3', 'EH', 'AT', 'ZUC'] },
];
const SETS = ['all', ...GROUPS.map((g) => g.key)];
const EXPORT = 'https://www.asuncion.gov.py/arcgis/rest/services/Mapa_Web/PlanRegulador/MapServer/export';
const R = 6378137, PI_R = Math.PI * R, TILE = 256, CHUNK = 5;          // 5×5 tiles = 1280 px ≤ server max 1400

const merc = (lat, lng) => [lng * Math.PI / 180 * R, Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R];
const tileSize = (z) => (2 * PI_R) / 2 ** z;
const tileX = (mx, z) => Math.floor((mx + PI_R) / tileSize(z));
const tileY = (my, z) => Math.floor((PI_R - my) / tileSize(z));
const tileBox = (x, y, n, z) => { const s = tileSize(z); const xmin = -PI_R + x * s, ymax = PI_R - y * s; return [xmin, ymax - n * s, xmin + n * s, ymax]; };

async function fetchGroup(bbox, w, h, group, attempt = 1) {
  const defs = `4:zona_reg IN (${group.codes.map((c) => `'${c}'`).join(',')})`;
  const qs = new URLSearchParams({ bbox: bbox.join(','), bboxSR: '3857', imageSR: '3857', size: `${w},${h}`, layers: 'show:4', transparent: 'true', format: 'png32', f: 'image', layerDefs: defs });
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(`${EXPORT}?${qs}`, { signal: ctrl.signal, headers: { 'User-Agent': 'CasaLibre/1.0 (+https://casa-libre.com.py)' } });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('image')) throw new Error(`http ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (attempt >= 4) throw e;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
    return fetchGroup(bbox, w, h, group, attempt + 1);
  } finally { clearTimeout(timer); }
}

// City PNG → raw alpha (the shapes); we ignore the city's colours entirely.
async function alphaOf(png, w, h) {
  const { data, info } = await sharp(png).ensureAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const a = Buffer.alloc(w * h);
  for (let i = 0, p = 3; i < w * h; i++, p += info.channels) a[i] = data[p];
  return a;
}

// Paint groups (in order) into an RGBA buffer: colour = ours, alpha = the city's antialiased edge.
function paint(w, h, layers) {
  const out = Buffer.alloc(w * h * 4);
  for (const { color, alpha } of layers) {
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const a = alpha[i]; if (!a || a <= out[p + 3]) continue;
      out[p] = color[0]; out[p + 1] = color[1]; out[p + 2] = color[2]; out[p + 3] = a;
    }
  }
  return out;
}

async function writeTiles(set, z, x0, y0, cols, rows, rgba, w, index) {
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    const tile = Buffer.alloc(TILE * TILE * 4);
    let any = false;
    for (let r = 0; r < TILE; r++) {
      const src = ((ty * TILE + r) * w + tx * TILE) * 4;
      rgba.copy(tile, r * TILE * 4, src, src + TILE * 4);
    }
    for (let p = 3; p < tile.length; p += 4) if (tile[p]) { any = true; break; }
    if (!any) continue;
    const key = `${z}/${x0 + tx}/${y0 + ty}`;
    const file = path.join(OUT, set, `${key}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await sharp(tile, { raw: { width: TILE, height: TILE, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toFile(file);
    index.sets[set].push(key);
  }
}

async function generate() {
  fs.mkdirSync(OUT, { recursive: true });
  const index = { version: VERSION, bounds: BOUNDS, minZoom: ZMIN, maxZoom: ZMAX, tileSize: TILE, sets: Object.fromEntries(SETS.map((s) => [s, []])) };
  const [wx0, wy0] = merc(BOUNDS.s, BOUNDS.w), [wx1, wy1] = merc(BOUNDS.n, BOUNDS.e);
  let done = 0, total = 0, t0 = Date.now();
  const jobs = [];
  for (let z = ZMIN; z <= ZMAX; z++) {
    const xa = tileX(wx0, z), xb = tileX(wx1, z), ya = tileY(wy1, z), yb = tileY(wy0, z);
    for (let y = ya; y <= yb; y += CHUNK) for (let x = xa; x <= xb; x += CHUNK) {
      const cols = Math.min(CHUNK, xb - x + 1), rows = Math.min(CHUNK, yb - y + 1);
      jobs.push({ z, x, y, cols, rows });
    }
  }
  total = jobs.length;
  console.log(`zooms ${ZMIN}-${ZMAX}: ${total} chunks × ${GROUPS.length} city requests → ${OUT}`);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const j = jobs[next++];
      const w = j.cols * TILE, h = j.rows * TILE, bbox = tileBox(j.x, j.y, j.cols, j.z);
      // rows may be fewer than cols → ymin must use rows
      bbox[1] = bbox[3] - j.rows * tileSize(j.z);
      const alphas = await Promise.all(GROUPS.map((g) => fetchGroup(bbox, w, h, g).then((png) => alphaOf(png, w, h))));
      const layers = GROUPS.map((g, i) => ({ color: g.color, alpha: alphas[i] }));
      await writeTiles('all', j.z, j.x, j.y, j.cols, j.rows, paint(w, h, layers), w, index);
      for (let i = 0; i < GROUPS.length; i++) await writeTiles(GROUPS[i].key, j.z, j.x, j.y, j.cols, j.rows, paint(w, h, [layers[i]]), w, index);
      done++;
      if (done % 10 === 0 || done === total) console.log(`  ${done}/${total} chunks (z${j.z})  ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  for (const s of SETS) index.sets[s].sort();
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  console.log(`done: ${SETS.map((s) => `${s}=${index.sets[s].length}`).join(' ')} tiles in ${Math.round((Date.now() - t0) / 1000)}s`);
}

async function upload() {
  const env = {};
  for (const line of fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const s3 = new S3Client({ endpoint: env.B2_S3_ENDPOINT, region: env.B2_REGION || 'us-east-005', credentials: { accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APP_KEY }, forcePathStyle: true });
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } };
  walk(OUT);
  console.log(`uploading ${files.length} files to b2://${env.B2_BUCKET}/zoning/asuncion/${VERSION}/`);
  let i = 0, done = 0, bytes = 0;
  async function worker() {
    while (i < files.length) {
      const f = files[i++];
      const rel = path.relative(OUT, f).split(path.sep).join('/');
      const body = fs.readFileSync(f); bytes += body.length;
      await s3.send(new PutObjectCommand({ Bucket: env.B2_BUCKET, Key: `zoning/asuncion/${VERSION}/${rel}`, Body: body, ContentType: rel.endsWith('.json') ? 'application/json' : 'image/png' }));
      done++;
      if (done % 200 === 0 || done === files.length) console.log(`  ${done}/${files.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`uploaded ${done} files, ${(bytes / 1048576).toFixed(1)} MB`);
}

if (args.upload) await upload(); else await generate();
