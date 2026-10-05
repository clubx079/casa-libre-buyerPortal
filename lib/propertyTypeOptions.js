// The property types people can pick — ONE list for the marketplace "Type" filter
// (desktop + mobile web), both "List a property" forms (SellFlow popup, /publicar)
// and the publish API, so what you can publish is exactly what you can filter by.
//   key — what the filter and the forms send (and drafts store)
//   db  — what a published listing stores in properties.property_type
//   kw  — how the marketplace filter matches stored property_type values (user and
//         scraped listings alike; case-insensitive "contains")
// (lib/propertyType.js is different: it turns scraped free-text types into labels.)

export const PROPERTY_TYPES = [
  { key: 'casa',       es: 'Casa',            en: 'House',      db: 'Casa',            kw: ['casa', 'house'] },
  { key: 'depto',      es: 'Departamento',    en: 'Apartment',  db: 'Departamento',    kw: ['departamento', 'depto', 'apartment', 'flat'] },
  { key: 'duplex',     es: 'Dúplex',          en: 'Duplex',     db: 'Dúplex',          kw: ['duplex', 'dúplex'] },
  { key: 'terreno',    es: 'Terreno',         en: 'Lot',        db: 'Terreno',         kw: ['terreno', 'lote', 'fracci', 'parcela'] },
  { key: 'comercial',  es: 'Local comercial', en: 'Commercial', db: 'Local comercial', kw: ['comercial', 'local', 'commercial', 'tienda'] },
  { key: 'oficina',    es: 'Oficina',         en: 'Office',     db: 'Oficina',         kw: ['oficina', 'office'] },
  { key: 'deposito',   es: 'Depósito',        en: 'Warehouse',  db: 'Depósito',        kw: ['deposito', 'depósito', 'warehouse', 'galp'] },
  { key: 'edificio',   es: 'Edificio',        en: 'Building',   db: 'Edificio',        kw: ['edificio', 'building'] },
  { key: 'condominio', es: 'Condominio',      en: 'Condo',      db: 'Condominio',      kw: ['condominio', 'condo'] },
  { key: 'campo',      es: 'Campo',           en: 'Rural land', db: 'Campo',           kw: ['campo', 'estancia', 'chacra', 'rural'] },
  { key: 'otro',       es: 'Otro',            en: 'Other',      db: 'Otro',            kw: ['otro', 'other'] },
];

// Older forms, saved drafts and the mobile app send 'departamento'.
const ALIASES = { departamento: 'depto' };
const LAND = new Set(['terreno', 'campo']);
const LARGE = new Set(['comercial', 'oficina', 'deposito', 'edificio']);

export function normalizeTypeKey(v) {
  const k = String(v == null ? '' : v).trim().toLowerCase();
  const key = ALIASES[k] || k;
  return PROPERTY_TYPES.some((t) => t.key === key) ? key : '';
}
const byKey = (v) => PROPERTY_TYPES.find((t) => t.key === normalizeTypeKey(v)) || null;

export const typeOptions = (lang) => PROPERTY_TYPES.map((t) => [t.key, lang === 'en' ? t.en : t.es]);
export const typeLabel = (v, lang) => { const t = byKey(v); return t ? (lang === 'en' ? t.en : t.es) : ''; };
export const dbType = (v) => byKey(v)?.db || null;
export const typeKeywords = (v) => byKey(v)?.kw || [];
export const isLandType = (v) => LAND.has(normalizeTypeKey(v));

// Plausible size in m² (catches typos): land has no limit; buildings, warehouses,
// offices and commercial spaces can be large.
export function areaRange(v) {
  const k = normalizeTypeKey(v);
  if (LAND.has(k)) return null;
  return LARGE.has(k) ? [5, 50000] : [5, 2000];
}
