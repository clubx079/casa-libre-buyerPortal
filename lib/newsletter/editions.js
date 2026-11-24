// The newsletter's editions (Omar, Nov 22: "/newsletter opens the latest; visitors can go back to
// the previous ones, each with its own articles and success stories"). Newest first.
// /newsletter = the newest; /newsletter/<date> = that edition. Each edition's numbers are measured
// for ITS date (the 30 days before it, lib/newsletter/insights.js `until`), so they really differ.
//
// Two kinds, merged newest first (mergeEditions):
//   • the hand-made ones below (EDITIONS): issues = lib/newsletter/content.js ISSUES slugs, in page
//     order; stories = STORIES slugs;
//   • the weekly ones written automatically since 2026-11-25 (admin lib/newsletterEditionRun.js),
//     stored in newsletter_editions (migration 026, status 'published'): issues and stories are the
//     full objects, in the same shapes (lib/newsletter/editionStore.js loads them).
// Pure — tests/newsletterEditions.test.mjs.
export const EDITIONS = [
  { date: '2026-11-22', issues: ['que-buscan-los-compradores', 'fotos', 'historia-comision'], stories: ['martin-comision', 'ramon-perfil', 'valeria-equipo', 'elena-departamento', 'federico-inversor', 'beatriz-casa-luque', 'ernesto-local-asuncion', 'lidia-quinta-aregua', 'raul-casa-mra', 'karina-inmobiliaria-cde', 'cesar-deposito-luque', 'carolina-casa-sanlorenzo'] },
  { date: '2026-11-21', issues: ['zonas-mas-buscadas', 'alquileres'], stories: ['lorena-alquiler', 'pablo-encarnacion', 'camila-estudiantes', 'julia-casa-familia', 'hugo-depto-recoleta', 'natalia-inmobiliaria-luque', 'mateo-casa-alquiler-luque', 'susana-depto-alquiler-cde', 'daniel-casa-sanber', 'monica-casa-alquiler-enc', 'walter-depto-alquiler-asu', 'lorenzo-agente-fdm'] },
  { date: '2026-11-20', issues: ['publicaciones-directas', 'historia-inmobiliaria'], stories: ['diego-cartera', 'jorge-cde', 'gabriela-inmobiliaria-enc', 'ricardo-agente-nuevo', 'silvia-alquiler-sanlorenzo', 'tomas-duplex-fdm', 'patricia-terreno-encarnacion', 'franco-agente-encarnacion', 'laura-habitacion', 'pedro-depto-carmelitas', 'estela-terreno-aregua', 'gerardo-local-cde'] },
  { date: '2026-11-19', issues: ['tu-cuenta-esta-lista', 'experiencia-estados-unidos'], stories: ['ana-primera-venta', 'carla-terreno', 'marta-duplex', 'oscar-terreno-cde', 'andres-agente-asuncion', 'veronica-monoambiente', 'sergio-oficina', 'miriam-terreno-luque', 'ivan-agente-luque', 'ana-maria-agente', 'liliana-inmobiliaria-lambare', 'ramiro-duplex-alquiler'] },
  { date: '2026-11-18', issues: ['que-buscan-los-compradores', 'zonas-mas-buscadas'], stories: ['sofia-proyecto', 'rodrigo-local', 'luis-quinta', 'martin-galpon', 'rosa-terreno-capiata', 'gustavo-agente-cde', 'claudia-equipo-asuncion', 'alberto-salon', 'noemi-terreno-ita', 'jose-terreno-cde-km', 'celeste-depto-venta-enc', 'victor-agente-mra'] },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// A newsletter_editions row → an edition, or null when it isn't complete (never half-shown).
export function storedToEdition(row) {
  if (!row || row.status !== 'published') return null;
  const date = String(row.date || '').slice(0, 10);
  if (!DATE.test(date)) return null;
  const issues = (Array.isArray(row.issues) ? row.issues : []).filter((i) => isObj(i) && i.slug && i.subject && Array.isArray(i.body) && i.body.length);
  const stories = (Array.isArray(row.stories) ? row.stories : []).filter((s) => isObj(s) && s.slug && isObj(s.title) && isObj(s.who) && isObj(s.metric));
  if (!issues.length || !stories.length) return null;
  return { date, week: row.week || null, issues, stories, stored: true };
}

// stored rows + the hand-made editions → newest first, one per date (the stored one wins a tie).
export function mergeEditions(rows = [], statics = EDITIONS) {
  const byDate = new Map();
  for (const e of statics) byDate.set(e.date, e);
  for (const r of rows) { const e = storedToEdition(r); if (e) byDate.set(e.date, e); }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export const latestEdition = (list = EDITIONS) => list[0] || null;
export const editionByDate = (date, list = EDITIONS) => list.find((e) => e.date === String(date || '')) || null;
// neighbours: older = the previous edition, newer = the next one (null at the ends)
export function editionNav(date, list = EDITIONS) {
  const i = list.findIndex((e) => e.date === date);
  return { older: i >= 0 ? list[i + 1] || null : null, newer: i > 0 ? list[i - 1] : null, number: i >= 0 ? list.length - i : null };
}
// the end of an edition's day, the moment its numbers are measured up to (UTC)
export const editionUntil = (date) => `${date}T23:59:59Z`;
export const editionHref = (e, list = EDITIONS) => (e && list[0] && e.date === list[0].date ? '/newsletter' : `/newsletter/${e.date}`);
// The stored edition of an ISO week (the weekly email uses it), or null.
export const editionOfWeek = (week, list = []) => list.find((e) => e.stored && e.week === week) || null;
