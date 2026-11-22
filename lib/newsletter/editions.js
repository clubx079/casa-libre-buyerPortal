// The newsletter's editions (Omar, Nov 22: "/newsletter opens the latest; visitors can go back to
// the previous ones, each with its own articles and success stories"). Newest first.
// /newsletter = EDITIONS[0]; /newsletter/<date> = that edition. Each edition's numbers are measured
// for ITS date (the 30 days before it, lib/newsletter/insights.js `until`), so they really differ.
// issues = lib/newsletter/content.js ISSUES slugs, in page order; stories = STORIES slugs.
export const EDITIONS = [
  { date: '2026-11-22', issues: ['que-buscan-los-compradores', 'fotos', 'historia-comision'], stories: ['martin-comision', 'ramon-perfil', 'valeria-equipo'] },
  { date: '2026-11-21', issues: ['zonas-mas-buscadas', 'alquileres'], stories: ['lorena-alquiler', 'pablo-encarnacion'] },
  { date: '2026-11-20', issues: ['publicaciones-directas', 'historia-inmobiliaria'], stories: ['diego-cartera', 'jorge-cde'] },
  { date: '2026-11-19', issues: ['tu-cuenta-esta-lista', 'experiencia-estados-unidos'], stories: ['ana-primera-venta', 'carla-terreno'] },
  { date: '2026-11-18', issues: ['que-buscan-los-compradores', 'zonas-mas-buscadas'], stories: ['sofia-proyecto', 'rodrigo-local'] },
];

export const latestEdition = () => EDITIONS[0];
export const editionByDate = (date) => EDITIONS.find((e) => e.date === String(date || '')) || null;
// neighbours: older = the previous edition, newer = the next one (null at the ends)
export function editionNav(date) {
  const i = EDITIONS.findIndex((e) => e.date === date);
  return { older: i >= 0 ? EDITIONS[i + 1] || null : null, newer: i > 0 ? EDITIONS[i - 1] : null, number: i >= 0 ? EDITIONS.length - i : null };
}
// the end of an edition's day, the moment its numbers are measured up to (UTC)
export const editionUntil = (date) => `${date}T23:59:59Z`;
export const editionHref = (e) => (e === EDITIONS[0] ? '/newsletter' : `/newsletter/${e.date}`);
