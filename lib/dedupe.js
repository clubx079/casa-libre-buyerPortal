// Pure zone-taxonomy + dedupe-fingerprint helpers for user-published listings,
// kept in sync with the admin ingest pipeline (casa-libre-adminPortal/lib/ingest.js)
// so a user listing carries the same zone_canonical + dedupe_key as a scraped one.
// This lets the scraper dedupe DEFER to a user's own listing (theirs is authoritative).
const strip = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const CANONICAL = {
  'asuncion': 'Asunción', 'luque': 'Luque', 'san lorenzo': 'San Lorenzo', 'fernando de la mora': 'Fernando de la Mora',
  'lambare': 'Lambaré', 'capiata': 'Capiatá', 'nemby': 'Ñemby', 'mariano roque alonso': 'Mariano Roque Alonso',
  'villa elisa': 'Villa Elisa', 'limpio': 'Limpio', 'itaugua': 'Itauguá', 'aregua': 'Areguá', 'ypacarai': 'Ypacaraí',
  'san antonio': 'San Antonio', 'villeta': 'Villeta', 'guarambare': 'Guarambaré', 'ita': 'Itá', 'ciudad del este': 'Ciudad del Este',
  'encarnacion': 'Encarnación', 'pedro juan caballero': 'Pedro Juan Caballero', 'coronel oviedo': 'Coronel Oviedo',
  'caaguazu': 'Caaguazú', 'villarrica': 'Villarrica', 'pilar': 'Pilar', 'concepcion': 'Concepción', 'caacupe': 'Caacupé',
  'san bernardino': 'San Bernardino', 'villa morra': 'Villa Morra', 'las mercedes': 'Las Mercedes', 'recoleta': 'Recoleta',
  'carmelitas': 'Carmelitas', 'manora': 'Manorá', 'ykua sati': 'Ykua Satí', 'mburicao': 'Mburicaó', 'sajonia': 'Sajonia',
  'barrio jara': 'Barrio Jara', 'san vicente': 'San Vicente', 'santisima trinidad': 'Santísima Trinidad', 'trinidad': 'Trinidad',
  'molas lopez': 'Molas López', 'los laureles': 'Los Laureles', 'herrera': 'Herrera', 'mariscal lopez': 'Mariscal López',
  'santo domingo': 'Santo Domingo', 'san roque': 'San Roque', 'catedral': 'Catedral', 'ciudad nueva': 'Ciudad Nueva',
  'tacumbu': 'Tacumbú', 'obrero': 'Obrero', 'san pablo': 'San Pablo', 'madame lynch': 'Madame Lynch', 'jara': 'Barrio Jara',
  'ita enramada': 'Itá Enramada',
};
const CANON_TOKENS = Object.keys(CANONICAL).sort((a, b) => b.length - a.length);
const LAND_RE = /lote|terreno|campo|fracci|parcela/i;
const isLandType = (t) => t != null && LAND_RE.test(String(t));

// Resolve a canonical zone from a listing's neighborhood/city/address.
export function zoneCanonical(row) {
  const hay = strip(`${row.neighborhood || ''} ${row.city || ''} ${row.address || ''}`);
  for (const tok of CANON_TOKENS) {
    if (new RegExp(`(^|[^a-z])${tok.replace(/ /g, '[ ]')}([^a-z]|$)`).test(hay)) return CANONICAL[tok];
  }
  return row.city || null;
}

// Fuzzy fingerprint: zone | land|bldg | area-bucket | price-bucket | beds.
// Type is only land vs building (matches the pipeline — the same unit can be
// labelled Casa or Condominio, so the specific type must not split the key).
export function dedupeKey(row, zc) {
  const zone = strip(zc || row.city || row.neighborhood);
  const type = isLandType(row.property_type) ? 'land' : 'bldg';
  const area = Number(row.covered_area) || Number(row.floor_area) || Number(row.land_area) || null;
  const price = Number(row.price) || null;
  const beds = row.bedrooms != null ? Number(row.bedrooms) : null;
  if (!zone || !price || (area == null && beds == null)) return null;
  const areaBucket = area != null ? Math.round(area / 10) * 10 : 'x';
  const priceBucket = Math.round(price / (price >= 100000 ? 5000 : 500));
  const bedKey = beds != null ? beds : 'x';
  return [zone, type, areaBucket, priceBucket, bedKey].join('|');
}
