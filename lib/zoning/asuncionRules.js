// Asunción zone code → max floors + category (Ordenanza 163/18; Central/AT per 161/2024).
// Floors include the "+1 nivel" the ordinance grants AR1-B, AR2-A/B and AR3-A/B.
// Central/mixed strips have formula heights (up to ~10 levels) → alta, no fixed number.
const RULES = {
  AR1A: [3, 'baja', 'Residencial de baja densidad (AR1-A)'],
  AR1B: [4, 'baja', 'Residencial de baja densidad (AR1-B)'],
  AR2A: [5, 'media', 'Residencial de media densidad (AR2-A)'],
  AR2B: [6, 'media', 'Residencial de media densidad (AR2-B)'],
  'AR2B MOD': [6, 'media', 'Residencial de media densidad (AR2-B)'],
  AR3A: [6, 'media', 'Residencial de alta densidad (AR3-A)'],
  AR3A_1: [6, 'media', 'Residencial de alta densidad (AR3-A)'],
  AR3B: [8, 'alta', 'Residencial de alta densidad (AR3-B)'],
  CENTRAL: [null, 'alta', 'Área central'],
  'EJE VILLA MORRA': [null, 'alta', 'Eje Villa Morra'],
  FM1A: [null, 'alta', 'Franja mixta 1-A'],
  FM1B: [null, 'alta', 'Franja mixta 1-B'],
  FM2: [null, 'alta', 'Franja mixta 2'],
  FM3: [null, 'alta', 'Franja mixta 3'],
  EH: [null, 'alta', 'Eje habitacional'],
  AT: [null, 'alta', 'Área de transición'],
  ZUC: [null, 'alta', 'Zona urbana concertada'],
  AI1: [null, 'otro', 'Área industrial 1'],
  AI2: [null, 'otro', 'Área industrial 2'],
  AI3: [null, 'otro', 'Área industrial 3'],
  AP: [null, 'otro', 'Área portuaria'],
  AUE: [null, 'otro', 'Área de uso específico'],
  CEM: [null, 'otro', 'Cementerio'],
  P: [null, 'otro', 'Parque'],
  ZE: [null, 'otro', 'Zona especial'],
};

// Zone codes in one category — lets the map draw each category in its own colour.
export const codesFor = (category) => Object.keys(RULES).filter((k) => RULES[k][1] === category);

export function zoneRule(code) {
  const k = String(code || '').trim().toUpperCase();
  const r = RULES[k];
  if (!r) return { code: k || null, category: 'otro', maxFloors: null, label: k || 'Sin zona' };
  return { code: k, category: r[1], maxFloors: r[0], label: r[2] };
}
