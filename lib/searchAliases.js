// Portuguese spellings → the Spanish names the listings use. Brazilian visitors
// type "Assunção", "Encarnação", "Cidade do Leste"… while the data says Asunción,
// Encarnación, Ciudad del Este. Applied to the search text before accentRegex
// (lib/marketplace.js), on lower-case, accent-free text, whole words only.
// Pure (no imports) so the tests load it directly.
export const foldText = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// [Portuguese (folded), Spanish (folded)] — most specific first.
export const PT_ALIASES = [
  ['assuncao', 'asuncion'],
  ['asuncao', 'asuncion'],
  ['assuncion', 'asuncion'],
  ['encarnacao', 'encarnacion'],
  ['concepcao', 'concepcion'],
  ['cidade do leste', 'ciudad del este'],
  ['cidade de leste', 'ciudad del este'],
  ['cidade del este', 'ciudad del este'],
  ['salto do guaira', 'salto del guaira'],
  ['sao lourenco', 'san lorenzo'],
  ['lourenco', 'lorenzo'],
  ['sao', 'san'],
  ['vila', 'villa'],
  ['apartamentos', 'departamento'],
  ['apartamento', 'departamento'],
];
const RULES = PT_ALIASES.map(([pt, es]) => [new RegExp(`(^|[^a-z0-9])${pt.replace(/ /g, ' +')}(?=$|[^a-z0-9])`, 'g'), es]);

export function ptAlias(v) {
  let t = foldText(v);
  for (const [re, es] of RULES) t = t.replace(re, (m, pre) => pre + es);
  // Any other "-ção" word: Portuguese -cao ↔ Spanish -cion (e.g. "Constituição" → "constitucion").
  t = t.replace(/([a-z]{3,})cao(?=$|[^a-z0-9])/g, '$1cion');
  return t;
}
