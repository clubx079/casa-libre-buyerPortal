// Buyer-facing zoning categories — shared by every city that has zoning.
export const CATEGORIES = [
  { id: 'baja', es: 'Baja altura · hasta 4 pisos (zona de casas)', en: 'Low-rise · up to 4 floors (houses)' },
  { id: 'media', es: 'Media · 5–6 pisos', en: 'Mid-rise · 5–6 floors' },
  { id: 'alta', es: 'Alta · 7+ pisos / edificios', en: 'High-rise · 7+ floors / towers' },
  { id: 'otro', es: 'Otro uso (industrial, parque…)', en: 'Other use (industrial, park…)' },
];
const IDS = new Set(CATEGORIES.map((c) => c.id));

export const categoryLabel = (id, lang = 'es') => (CATEGORIES.find((c) => c.id === id) || {})[lang === 'en' ? 'en' : 'es'] || '';
export const zoningFilterPart = (height) => (IDS.has(height) ? `zoning_category=eq.${height}` : null);
export const ZONING_SOURCE_LABEL = { asuncion: 'Plan Regulador de Asunción (Ord. 163/18)' };

// Off until migration 007 is applied — selecting a missing column breaks PostgREST.
export const zoningEnabled = () => process.env.ZONING_ENABLED === '1';
export const ZONING_COLUMNS = 'zoning_code,zoning_category,zoning_max_floors,zoning_source';

export function zoningFromRow(r, enabled = zoningEnabled()) {
  if (!enabled || !r?.zoning_category) return null;
  return { code: r.zoning_code || null, category: r.zoning_category, maxFloors: r.zoning_max_floors ?? null, source: r.zoning_source || null };
}
