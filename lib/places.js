// Places for the search box: every barrio, city and departamento the listings feed knows,
// with how many listings each has, and the predictive suggestions shown while typing
// ("Las Mercedes — Barrio, Asunción" vs "Las Mercedes — Barrio, San Lorenzo").
//
// Ported from the mobile app (same logic). Pure, so `npm test` runs it (tests/places.test.mjs).
// The website builds the index on the server (lib/placeIndex.js) and ships a compact copy
// to the browser (compactIndex / hydrateIndex below) for the suggestions.
//
// The feed's place fields are messy, so the index cleans them first:
//  • In Asunción most listings carry the BARRIO in `city` and "Asunción" in `province`
//    (city "Recoleta", province "Asunción"): province = the capital → city = the capital,
//    barrio = neighborhood || city.
//  • Spellings of one place are merged on a sound-alike key: "Ycuá Satí" = "Ykua Sati",
//    "Villamorra" = "Villa Morra", "Ciudad Del Este" = "Ciudad del Este", "Mcal." = "Mariscal",
//    "Barrio Jara" = "Jara".
//  • A barrio equal to its city or departamento ("Central" in Carapeguá) is no barrio.
//  • A listing with no barrio (or no city) gets one from its address when an address part
//    is a barrio of its city (or a known city): "Arguello…, Recoleta, Asunción, Paraguay".
import { foldText, ptAlias } from './searchAliases.js';

export const KIND_LABELS = {
  es: { barrio: 'Barrio', city: 'Ciudad', dept: 'Departamento', capital: 'Capital' },
  en: { barrio: 'Neighborhood', city: 'City', dept: 'Department', capital: 'Capital' },
  pt: { barrio: 'Bairro', city: 'Cidade', dept: 'Departamento', capital: 'Capital' },
};

// Asunción's barrios, for listings that name the barrio as their city but have no
// province. Names that are also towns elsewhere (Bella Vista, Trinidad, San Antonio…)
// only count when the address says Asunción.
export const ASUNCION_BARRIOS = [
  'Banco San Miguel', 'Bañado Cara Cara', 'Bella Vista', 'Bernardino Caballero', 'Botánico', 'Cañada del Ybyray',
  'Carlos Antonio López', 'Carmelitas', 'Catedral', 'Ciudad Nueva', 'Doctor Francia', 'General Díaz', 'Herrera',
  'Hipódromo', 'Itá Enramada', 'Itá Pytã Punta', 'Jara', 'Jukyty', 'La Encarnación', 'Las Lomas', 'Las Mercedes',
  'Loma Pytã', 'Los Laureles', 'Madame Lynch', 'Manorá', 'Mariscal Estigarribia', 'Mariscal López', 'Mbocayaty',
  'Mburicaó', 'Mburucuyá', 'Nazareth', 'Ñu Guazú', 'Obrero', 'Panambí Reta', 'Panambí Verá', 'Pettirossi', 'Pinozá',
  'Recoleta', 'Republicano', 'Ricardo Brugada', 'Roberto L. Pettit', 'Sajonia', 'Salvador del Mundo', 'San Antonio',
  'San Blas', 'San Cayetano', 'San Cristóbal', 'San Jorge', 'San Pablo', 'San Roque', 'San Vicente', 'Santa Ana',
  'Santa Librada', 'Santa María', 'Santa Rosa', 'Santísima Trinidad', 'Santo Domingo', 'Tablada Nueva', 'Tacumbú',
  'Tembetary', 'Terminal', 'Villa Aurelia', 'Villa Morra', 'Viñas Cué', 'Virgen de Fátima', 'Virgen de la Asunción',
  'Virgen del Huerto', 'Vista Alegre', 'Ycuá Satí', 'Ytay', 'Zeballos Cué',
];
const AMBIGUOUS_BARRIOS = ['Bella Vista', 'Trinidad', 'San Antonio', 'Santa Rosa', 'San Pablo', 'San Blas', 'Santa Ana', 'Obrero', 'Terminal', 'San Jorge', 'Santa María', 'Nazareth', 'San Roque', 'San Vicente', 'Catedral'];

// ── Names ─────────────────────────────────────────────────────────────────────
const ABBR = [
  [/(^|[\s(])mcal\.?(?=\s|$)\s*/gi, '$1Mariscal '], [/(^|[\s(])gral\.?(?=\s|$)\s*/gi, '$1General '],
  [/(^|[\s(])sta\.?(?=\s|$)\s*/gi, '$1Santa '], [/(^|[\s(])sto\.?(?=\s|$)\s*/gi, '$1Santo '],
  [/(^|[\s(])mme\.?(?=\s|$)\s*/gi, '$1Madame '], [/(^|[\s(])dr\.?(?=\s|$)\s*/gi, '$1Doctor '],
  [/(^|[\s(])pdte\.?(?=\s|$)\s*/gi, '$1Presidente '], [/(^|[\s(])tte\.?(?=\s|$)\s*/gi, '$1Teniente '],
  [/(^|[\s(])cnel\.?(?=\s|$)\s*/gi, '$1Coronel '],
];
const BARRIO_PREFIX = /^(?:barrio|b°|bº|bo\.)\s+/i;
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);

const clean = (s) => String(s ?? '').replace(/&#8211;|&ndash;/g, '-').replace(/\s+/g, ' ').trim();
export function expandAbbr(s) { let t = clean(s); for (const [re, to] of ABBR) t = t.replace(re, to); return t.replace(/\s+/g, ' ').trim(); }

// "CIUDAD DEL ESTE" / "ciudad Del este" → "Ciudad del Este".
export function titleCase(s) {
  return clean(s).toLowerCase().split(' ').map((w, i) => {
    if (i > 0 && PARTICLES.has(w)) return w;
    return w.replace(/^(\(?)(\p{L})/u, (m, p, c) => p + c.toUpperCase());
  }).join(' ');
}

// The parenthesised part ("Las Lomas (Carmelitas)" → "carmelitas") is kept as an alias.
const splitParen = (s) => {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(s);
  return m ? [m[1], m[2]] : [s, ''];
};

// Folded and without the "Barrio" prefix: "Barrio Jara" → "jara".
const memo = (fn, max = 20000) => { const c = new Map(); return (s) => { const k = String(s ?? ''); let v = c.get(k); if (v === undefined) { if (c.size > max) c.clear(); v = fn(k); c.set(k, v); } return v; }; };
export const placeFold = memo((s) => foldText(expandAbbr(s)).replace(BARRIO_PREFIX, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim());

// Sound-alike key (Spanish / Guaraní spellings): c/k/q, y/i, v/b, z/s, ll, h and double letters.
export const soundKey = memo((s) => {
  let t = placeFold(splitParen(clean(s))[0]).replace(/ñ/g, 'n').replace(/\s+/g, '');
  t = t.replace(/ch/g, 'x').replace(/h/g, '').replace(/qu/g, 'k').replace(/c(?=[ei])/g, 's').replace(/c/g, 'k')
    .replace(/z/g, 's').replace(/v/g, 'b').replace(/w/g, 'u').replace(/ll/g, 'i').replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1');
  return t;
});

const hasMarks = (s) => /[^\u0000-\u007f]/.test(s);
// Best display name among the spellings seen: the most used spelling (accents ignored),
// written with its accents when any listing has them ("Asuncion" ×38 + "Asunción" ×395 →
// "Asunción"; "Luque" ×219 beats one "Lúke").
function bestName(variants) {
  const groups = new Map();
  for (const [name, n] of variants) {
    const k = foldText(name);
    const g = groups.get(k) || { n: 0, names: [] };
    g.n += n; g.names.push([name, n]); groups.set(k, g);
  }
  // Ties: the spelling with more words ("Villa Morra" over "Villamorra").
  let top = null;
  for (const [k, g] of groups) { g.w = k.split(' ').length; if (!top || g.n > top.n || (g.n === top.n && g.w > top.w)) top = g; }
  if (!top) return '';
  let best = null;
  for (const [name, n] of top.names) { const sc = (hasMarks(name) ? 1e6 : 0) + n; if (!best || sc > best[1]) best = [name, sc]; }
  return best[0];
}
const displayOf = (raw) => titleCase(expandAbbr(splitParen(clean(raw))[0]));

// ── The index ─────────────────────────────────────────────────────────────────
function bump(map, key, v) { map.set(key, (map.get(key) || 0) + v); }
const blank = (s) => { const t = clean(s); return /^(null|undefined|-|n\/a)$/i.test(t) ? '' : t; };
const addressParts = (a) => clean(a).split(/\s*(?:,|\s-\s|\s–\s)\s*/).filter(Boolean);

const capitalKeys = (capital) => (capital
  ? new Set([soundKey(capital), soundKey('distrito capital'), soundKey('capital'), soundKey('gran ' + capital)])
  : new Set());

// The listing's own fields, cleaned: { city, hood, prov } ('' when unknown).
function rawPlace(l, ctx) {
  let city = blank(l.city), hood = blank(l.neighborhood), prov = blank(l.province);
  // "Las Mercedes, Asunción" in the city field → barrio + city.
  if (city.includes(',')) {
    const parts = city.split(',').map(clean).filter(Boolean);
    city = parts[parts.length - 1] || '';
    if (!hood && parts.length > 1) hood = parts[0];
  }
  // A list of landmarks is no barrio name ("Shopping Mariscal, Shopping Villa Morra, …").
  if (hood.includes(',') || hood.split(' ').length > 5 || hood.length > 40) hood = '';
  if (ctx.capital) {
    const { capKeys, capBarrios, outside } = ctx;
    const ck = soundKey(city);
    const provIsCap = !!prov && capKeys.has(soundKey(prov));
    const isCap = capKeys.has(ck);
    if (city && !isCap && !outside.has(ck)) {
      const addrCap = () => addressParts(l.address).some((x) => capKeys.has(soundKey(x)));
      const listed = capBarrios.has(ck) && (!capBarrios.get(ck) || addrCap());
      if (provIsCap || (!prov && listed)) {
        if (!hood || soundKey(hood) === ck || capKeys.has(soundKey(hood))) hood = city;
        city = ctx.capital;
      }
    }
    if (!city && provIsCap) city = ctx.capital;
    if (city && capKeys.has(soundKey(city))) { city = ctx.capital; prov = ''; }
  }
  if (hood && city) {
    // "Recoleta Asunción" → "Recoleta".
    const fc = ' ' + foldText(city), fh = foldText(hood);
    const rest = fh.endsWith(fc) ? fh.slice(0, fh.length - fc.length).trim() : '';
    if (rest && !PARTICLES.has(rest.split(' ').pop())) hood = hood.slice(0, rest.length).trim();
  }
  if (hood && (soundKey(hood) === soundKey(city) || (prov && soundKey(hood) === soundKey(prov)))) hood = '';
  return { city, hood, prov };
}

function newPlace(kind, id) {
  return { id, kind, name: '', city: '', cityId: null, dept: '', capital: false, ids: new Set(), pts: [], _v: new Map(), _r: new Map(), _n: new Map(), _d: new Map() };
}

// listings → { places: [], byId: Map(id → place), placeOf(listing) → { city, barrio, dept } }.
// place = { id, kind: 'barrio'|'city'|'dept', name, city, dept, capital, count, ids: Set,
//           pts: [[lat,lng]…], names: [{ n: folded name, k: sound key, alias }] }
export function buildPlaceIndex(listings, { capital = '', capitalBarrios = [] } = {}) {
  const capKeys = capitalKeys(capital);
  const capBarrios = new Map(capitalBarrios.map((b) => [soundKey(b), AMBIGUOUS_BARRIOS.includes(b)]));
  // Cities filed mostly under another province are real towns, never barrios (Lambaré,
  // San Lorenzo), even when a listing or two files them under Asunción.
  const outside = new Set();
  if (capital) {
    const tally = new Map();   // city key → [outside, inside]
    for (const l of listings || []) {
      const prov = blank(l && l.province), city = blank(l && l.city);
      if (!prov || !city || city.includes(',')) continue;
      const k = soundKey(city), t = tally.get(k) || [0, 0];
      t[capKeys.has(soundKey(prov)) ? 1 : 0]++;
      tally.set(k, t);
    }
    for (const [k, [o, i]] of tally) if (o >= i && !capKeys.has(k)) outside.add(k);
  }
  const ctx = { capital, capKeys, capBarrios, outside };
  const byId = new Map();
  const of = new Map();   // listing id → { city, barrio, dept } place ids
  const get = (kind, id) => { let p = byId.get(id); if (!p) { p = newPlace(kind, id); byId.set(id, p); } return p; };

  const rows = [];
  for (const l of listings || []) if (l && l.id != null) rows.push([l, rawPlace(l, ctx)]);

  // Known cities and their barrios, to read a missing city / barrio from the address.
  const cityKeys = new Set(), barriosOf = new Map();
  for (const [, r] of rows) {
    if (!r.city) continue;
    const ck = soundKey(r.city); cityKeys.add(ck);
    if (r.hood) { let m = barriosOf.get(ck); if (!m) barriosOf.set(ck, (m = new Map())); m.set(soundKey(r.hood), r.hood); }
  }
  for (const [l, r] of rows) {
    if (r.city && r.hood) continue;
    const segs = addressParts(l.address);
    if (!r.city) {
      for (let i = segs.length - 1; i >= 0; i--) if (cityKeys.has(soundKey(segs[i]))) { r.city = segs[i]; break; }
      if (r.city && capKeys.has(soundKey(r.city))) r.city = capital;
    }
    if (r.city && !r.hood) {
      const known = barriosOf.get(soundKey(r.city));
      const hit = known && segs.find((x) => known.has(soundKey(x)));
      if (hit) r.hood = hit;
    }
  }

  for (const [l, r] of rows) {
    const lat = Number(l.lat), lng = Number(l.lng);
    // [lat, lng, listing id]: the id rides along so the server can tell which listings
    // sit outside the area's box (lib/marketplace.js placeParts); geometry reads [0], [1].
    const coord = l.lat != null && l.lng != null && Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng, l.id] : null;
    const add = (p, raw) => {
      p.ids.add(l.id);
      if (coord) p.pts.push(coord);
      bump(p._v, displayOf(raw), 1);
      bump(p._r, clean(raw), 1);
      const [main, paren] = splitParen(clean(raw));
      p._n.set(placeFold(main), false);
      if (paren && !p._n.has(placeFold(paren))) p._n.set(placeFold(paren), true);
    };
    const mine = {};
    let deptP = null;
    if (r.prov) { deptP = get('dept', 'd:' + soundKey(r.prov)); add(deptP, r.prov); mine.dept = deptP.id; }
    if (r.city) {
      const ck = soundKey(r.city);
      const cp = get('city', 'c:' + ck); add(cp, r.city); mine.city = cp.id;
      if (deptP) bump(cp._d, deptP.id, 1);
      if (r.hood) {
        const bp = get('barrio', 'b:' + ck + '/' + soundKey(r.hood)); add(bp, r.hood); mine.barrio = bp.id;
        bp.cityId = cp.id;
      }
    }
    of.set(l.id, mine);
  }

  for (const p of byId.values()) p.name = bestName(p._v);
  const capP = capital ? byId.get('c:' + soundKey(capital)) : null;
  for (const p of byId.values()) {
    if (p.kind !== 'city') continue;
    let top = null;
    for (const [d, n] of p._d) if (!capKeys.has(d.slice(2)) && (!top || n > top[1])) top = [d, n];
    p.capital = p === capP;
    p.dept = p.capital || !top ? '' : byId.get(top[0]).name;
  }
  for (const p of byId.values()) {
    if (p.kind === 'barrio') { const c = byId.get(p.cityId); p.city = c ? c.name : ''; p.dept = c ? c.dept : ''; }
    p._n.set(placeFold(p.name), false);
    p.names = [...p._n].filter(([n]) => n).map(([n, alias]) => ({ n, k: soundKey(n), alias }));
    p.key = soundKey(p.name);
    p.count = p.ids.size;
    // The spellings as stored, most used first (the server matches the DB columns on them).
    p.raw = [...p._r].sort((a, b) => b[1] - a[1]).map(([r]) => r);
    delete p._r; delete p._v; delete p._n; delete p._d;
  }
  // The capital is no departamento of its own: its listings are the city's.
  if (capital) for (const k of capKeys) byId.delete('d:' + k);
  // A barrio named like a city ("Lambare" filed under Asunción) with only a listing or two
  // is a data slip, not a barrio: it would only shadow the city in the suggestions.
  const cityKeySet = new Set([...byId.values()].filter((p) => p.kind === 'city').map((p) => p.key));
  for (const p of [...byId.values()]) if (p.kind === 'barrio' && p.count < 3 && cityKeySet.has(p.key)) byId.delete(p.id);
  const places = [...byId.values()].filter((p) => p.name);
  return { places, byId: new Map(places.map((p) => [p.id, p])), placeOf: (l) => (l ? of.get(l.id) || null : null) };
}

// ── Matching ──────────────────────────────────────────────────────────────────
// Damerau–Levenshtein distance (an adjacent swap counts once), for short strings.
export function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

// The typed text, folded like the names ("Assunção" → "asuncion", "B° Jara" → "jara").
export const queryFold = (q) => placeFold(ptAlias(String(q ?? '').replace(/,/g, ' ')));

// How well one folded name matches the typed text:
// 100 the same, 95 sounds the same ("ykua sati"), 90 starts with it, 80 a later word starts
// with it ("mercedes"), 72 sounds like its start, 50–60 a typo or two in its first letters
// ("luqe", "recoletta"), 0 no match.
export function nameScore(name, qf, qk = soundKey(qf), nk = soundKey(name)) {
  if (!qf || !name) return 0;
  if (name === qf) return 100;
  if (qk.length >= 3 && nk === qk) return 95;
  if (name.startsWith(qf)) return 90;
  if (name.includes(' ' + qf)) return 80;
  if (qk.length >= 3 && nk.startsWith(qk)) return 72;
  if (qf.length >= 4 && name[0] === qf[0]) {
    const allowed = qf.length >= 8 ? 2 : 1;
    let best = Infinity;
    for (let L = qf.length - 1; L <= qf.length + 1; L++) {
      if (L < 3 || L > name.length) continue;
      best = Math.min(best, editDistance(qf, name.slice(0, L)));
    }
    if (best <= allowed) return 60 - best * 10;
  }
  return 0;
}

// "mercedes asuncion", "las mercedes, ciudad del este": the first words name the place,
// the rest its city / departamento. 85 when the first words are the place's whole name
// (or its last words: "mercedes" for Las Mercedes), 70 when they only start it.
function contextScore(p, toks) {
  if (toks.length < 2) return { score: 0, exact: false };
  const ctx = [...placeFold(p.city).split(' '), ...placeFold(p.dept).split(' ')].filter(Boolean);
  if (!ctx.length) return { score: 0, exact: false };
  let best = { score: 0, exact: false };
  for (let i = 1; i < toks.length; i++) {
    const head = toks.slice(0, i).join(' '), tail = toks.slice(i);
    if (!tail.every((t) => ctx.some((w) => w.startsWith(t)))) continue;
    for (const x of p.names) {
      const whole = x.n === head || x.n.endsWith(' ' + head) || (head.length >= 3 && x.k === soundKey(head));
      const starts = x.n.startsWith(head) || x.n.includes(' ' + head);
      if (whole && best.score < 85) best = { score: 85, exact: true };
      else if (starts && best.score < 70) best = { score: 70, exact: false };
    }
  }
  return best;
}

const KIND_BOOST = { city: 4, dept: 2, barrio: 0 };

// The best places for the typed text, best first: [{ place, score, exact }]. `exact` = the
// text names this place outright (same name, same sound, or name + its city).
export function suggestPlaces(index, q, limit = 8) {
  const qf = queryFold(q);
  if (!index || qf.length < 2) return [];
  const qk = soundKey(qf), toks = qf.split(' ').filter(Boolean);
  const out = [];
  let top = 0;
  for (const p of index.places) {
    let base = 0;
    for (const x of p.names) base = Math.max(base, nameScore(x.n, qf, qk, x.k) - (x.alias ? 3 : 0));
    const ctx = contextScore(p, toks);
    if (ctx.score > base) base = ctx.score;
    if (base <= 0) continue;
    if (base > top) top = base;
    out.push({ place: p, base, score: base + KIND_BOOST[p.kind] + Math.min(6, Math.log2(p.count + 1)), exact: base >= 92 || ctx.exact });
  }
  // A clear hit hides the guesses: "barrio jara" shows Barrio Jara, not "Paraguarí".
  const kept = top >= 90 ? out.filter((x) => x.base >= 70) : out;
  kept.sort((a, b) => b.score - a.score || b.place.count - a.place.count || a.place.name.localeCompare(b.place.name));
  return kept.slice(0, limit).map(({ place, score, exact }) => ({ place, score, exact }));
}

// The place a submitted search clearly names (its name, or name + city), else null. When
// several places carry that name, the one with most listings, if it clearly dominates
// ("las mercedes" → Asunción's, 58 vs 3); a name shared evenly ("centro", in eight
// towns) stays a text search over all of them.
export function exactPlace(index, q) {
  const hits = suggestPlaces(index, q, 50).filter((x) => x.exact).map((x) => x.place);
  if (!hits.length) return null;
  hits.sort((a, b) => b.count - a.count);
  const others = hits.slice(1).reduce((s, p) => s + p.count, 0);
  return hits[0].count >= 3 * others ? hits[0] : null;
}

// "Barrio, Asunción" / "Ciudad, Central" / "Ciudad, Capital" / "Departamento".
export function placeSubtitle(p, lang = 'es') {
  const k = KIND_LABELS[lang] || KIND_LABELS.es;
  if (!p) return '';
  if (p.kind === 'barrio') return p.city ? `${k.barrio}, ${p.city}` : k.barrio;
  if (p.kind === 'city') return p.capital ? `${k.city}, ${k.capital}` : p.dept ? `${k.city}, ${p.dept}` : k.city;
  return k.dept;
}

// Where the typed text sits in a name, for bold: [start, end] or null.
export function matchRange(name, q) {
  const n = foldText(name), qf = foldText(q).replace(/\s+/g, ' ');
  if (!qf || n.length !== String(name).trim().length) return null;
  if (n.startsWith(qf)) return [0, qf.length];
  const i = n.indexOf(' ' + qf);
  return i >= 0 ? [i + 1, i + 1 + qf.length] : null;
}

// Recent searches, newest first, no repeats: item = { type: 'place', id, name, sub } | { type: 'text', q }.
export function addRecent(list, item, max = 6) {
  const key = (x) => (x.type === 'place' ? 'p:' + x.id : 't:' + foldText(x.q));
  if (!item || (item.type === 'text' && !String(item.q || '').trim())) return list || [];
  const k = key(item);
  return [item, ...(list || []).filter((x) => x && key(x) !== k)].slice(0, max);
}

// ── Browser copy ──────────────────────────────────────────────────────────────
// The index without listing ids / coordinates, for the suggestions in the browser:
// [{ id, kind, name, city, dept, capital, count, names: [[folded, alias?1:0]…], b: [n,s,e,w] }].
// `boundsOf(place)` gives the box to fit the map to (lib/areaGeom.js searchBounds).
export function compactIndex(index, boundsOf) {
  const r5 = (v) => Math.round(v * 1e5) / 1e5;
  return (index ? index.places : []).map((p) => {
    const b = boundsOf ? boundsOf(p) : null;
    const o = { id: p.id, kind: p.kind, name: p.name, count: p.count, names: p.names.map((x) => (x.alias ? [x.n, 1] : [x.n])) };
    if (p.city) o.city = p.city;
    if (p.dept) o.dept = p.dept;
    if (p.capital) o.capital = 1;
    if (b) o.b = [r5(b.n), r5(b.s), r5(b.e), r5(b.w)];
    return o;
  });
}

// compactIndex() output → { places, byId } that suggestPlaces / exactPlace read.
export function hydrateIndex(list) {
  const places = (Array.isArray(list) ? list : []).filter((p) => p && p.id && p.name).map((p) => ({
    id: p.id, kind: p.kind, name: p.name, city: p.city || '', dept: p.dept || '', capital: !!p.capital, count: p.count || 0,
    names: (p.names || []).map(([n, a]) => ({ n, k: soundKey(n), alias: !!a })),
    key: soundKey(p.name),
    bounds: Array.isArray(p.b) ? { n: p.b[0], s: p.b[1], e: p.b[2], w: p.b[3] } : null,
  }));
  return { places, byId: new Map(places.map((p) => [p.id, p])) };
}
