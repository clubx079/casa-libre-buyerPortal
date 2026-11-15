// Human-readable, translated property-type labels. Source types are messy
// (Spanish, mixed case, per-source strings, numeric codes), so match by keyword
// and map to a canonical label in the requested language. Pure — usable anywhere.

// Order matters: more specific patterns first. `key` is the coarse filter-bucket
// (see MarketplaceClient's type filter) that this DB label rolls up into.
const RULES = [
  [/loteamiento|\blote\b|lotes/i, { es: 'Loteamiento', en: 'Land subdivision', pt: 'Loteamento' }, 'terreno'],
  [/terreno|parcela|fracci/i, { es: 'Terreno', en: 'Land', pt: 'Terreno' }, 'terreno'],
  [/campo|estancia|chacra|granja/i, { es: 'Campo', en: 'Farm / Ranch', pt: 'Sítio / Fazenda' }, 'campo'],
  [/d[uú]plex/i, { es: 'Dúplex', en: 'Duplex', pt: 'Duplex' }, 'duplex'],
  [/casa|residencia|residencial|chalet|vivienda|\bhouse\b/i, { es: 'Casa', en: 'House', pt: 'Casa' }, 'casa'],
  [/departamento|depto|monoambiente|penthouse|apartment|pozo/i, { es: 'Departamento', en: 'Apartment', pt: 'Apartamento' }, 'depto'],
  [/condominio|barrio\s*cerrado/i, { es: 'Condominio', en: 'Condominium', pt: 'Condomínio' }, 'condominio'],
  [/oficina|office/i, { es: 'Oficina', en: 'Office', pt: 'Sala comercial' }, 'oficina'],
  [/dep[oó]sito|galp[oó]n|warehouse/i, { es: 'Depósito', en: 'Warehouse', pt: 'Galpão' }, 'deposito'],
  [/local|comercial|commercial/i, { es: 'Local comercial', en: 'Commercial', pt: 'Ponto comercial' }, 'comercial'],
  [/edificio|building/i, { es: 'Edificio', en: 'Building', pt: 'Prédio' }, 'edificio'],
  [/inmueble.?productivo/i, { es: 'Inmueble productivo', en: 'Income property', pt: 'Imóvel para renda' }, 'otro'],
  [/hotel/i, { es: 'Hotel', en: 'Hotel', pt: 'Hotel' }, 'otro'],
  [/propiedad|inmueble|property/i, { es: 'Propiedad', en: 'Property', pt: 'Imóvel' }, 'otro'],
];

// Returns a translated label, or null for meaningless values (bare numeric codes).
export function typeLabel(raw, lang) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  for (const [re, lab] of RULES) if (re.test(s)) return lab[lang] || lab.es;
  if (/^\d+$/.test(s)) return null; // source-internal numeric code -> hide
  // Unknown but human — clean it up (e.g. "casa-en-condominio" already matched above)
  const cleaned = s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Returns the coarse filter-bucket key for a raw DB type string: one of
// casa/depto/duplex/terreno/comercial/oficina/deposito/edificio/condominio/campo,
// or 'otro' for anything unmatched (incl. inmueble productivo, hotel, propiedad).
// Used by the marketplace type filter (typeOf) so the bucket rules live in one place.
export function typeKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'otro';
  for (const [re, , key] of RULES) if (re.test(s)) return key;
  return 'otro';
}
