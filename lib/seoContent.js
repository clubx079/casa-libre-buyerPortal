// Self-updating page content for the SEO matrix pages (pure — tests/seoVariants.test.mjs):
//   statsLine   the intro's live numbers (count, typical price, range, newest listing)
//   faqFor      an FAQ built from the data ("¿Cuánto cuesta alquilar un departamento en X?" → live range),
//               mirrored into FAQPage structured data by the page
//   fillGuide   guide placeholders ({{count:/path}}, {{median:/path}}, {{range:/path}}, {{min:…}},
//               {{max:…}}, {{newest:…}}, {{month}}) → live values
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const monthEs = (d = new Date()) => `${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
export const dateEs = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };

// ctx: { op: 'venta'|'alquiler', sing, plural, opLabel ('en alquiler'), place, stats, money: (usd) → string }
export function statsLine({ op, plural, opLabel, place, stats, money }) {
  if (!stats?.count) return null;
  const per = op === 'alquiler' ? ' por mes' : '';
  const bits = [`Hoy hay ${stats.count} ${plural} ${opLabel} en ${place}`];
  if (stats.median) bits.push(`el precio típico es ${money(stats.median)}${per}`);
  if (stats.min && stats.max && stats.max > stats.min) bits.push(`van de ${money(stats.min)} a ${money(stats.max)}`);
  let s = bits.join('; ') + '.';
  if (stats.newest) s += ` La publicación más nueva es del ${dateEs(stats.newest)}.`;
  return s;
}

export function faqFor({ op, sing, plural, opLabel, place, stats, money, variantLabel, variantSing }) {
  if (!stats?.count) return [];
  const verb = op === 'alquiler' ? 'alquilar' : 'comprar';
  const per = op === 'alquiler' ? ' por mes' : '';
  const out = [];
  if (stats.median) {
    out.push({
      q: `¿Cuánto cuesta ${verb} un ${sing}${variantLabel ? ` ${variantSing || variantLabel}` : ''} en ${place}?`,
      a: `En Casa Libre, el precio típico de ${plural} ${opLabel}${variantLabel ? ` ${variantLabel}` : ''} en ${place} es ${money(stats.median)}${per}${stats.min && stats.max && stats.max > stats.min ? `, con opciones desde ${money(stats.min)} hasta ${money(stats.max)}` : ''}. Datos de ${stats.count} ${stats.count === 1 ? 'publicación' : 'publicaciones'} activas, actualizados cada día.`,
    });
  }
  out.push({ q: `¿Cuántos ${plural} ${opLabel}${variantLabel ? ` ${variantLabel}` : ''} hay en ${place}?`, a: `Hoy hay ${stats.count} publicados en Casa Libre, de inmobiliarias y de dueños particulares${stats.newest ? `; el más reciente se publicó el ${dateEs(stats.newest)}` : ''}.` });
  out.push({ q: `¿Cómo contacto al dueño o a la inmobiliaria?`, a: 'Desde cada aviso, directo por WhatsApp. Buscar es gratis, en la web o en la app para iPhone y Android.' });
  return out;
}

const TOKEN = /\{\{\s*(count|median|min|max|range|newest)\s*:\s*([^}\s]+)\s*\}\}|\{\{\s*month\s*\}\}/g;

// Every page path a guide's placeholders need.
export function placeholderPaths(guide) {
  const paths = new Set();
  const scan = (s) => { for (const m of String(s || '').matchAll(TOKEN)) if (m[2]) paths.add(m[2]); };
  scan(guide.title); scan(guide.h1); scan(guide.description); scan(guide.answer);
  for (const s of guide.sections || []) { scan(s.h2); (s.paras || []).forEach(scan); }
  for (const f of guide.faq || []) { scan(f.q); scan(f.a); }
  return [...paths];
}

// statsByPath: { [path]: stats }; money: (usd) → string; month: 'noviembre de 2026'
export function fillText(s, statsByPath, money, month) {
  return String(s ?? '').replace(TOKEN, (all, kind, path) => {
    if (!kind) return month;
    const st = statsByPath[path];
    if (!st || !st.count) return kind === 'count' ? '0' : '—';
    if (kind === 'count') return String(st.count);
    if (kind === 'newest') return st.newest ? dateEs(st.newest) : '—';
    if (kind === 'range') return st.min && st.max ? `${money(st.min)} a ${money(st.max)}` : '—';
    return st[kind] ? money(st[kind]) : '—';
  });
}

export function fillGuide(guide, statsByPath, money, month) {
  const f = (s) => fillText(s, statsByPath, money, month);
  return {
    ...guide,
    title: f(guide.title), h1: f(guide.h1), description: f(guide.description), answer: f(guide.answer),
    sections: (guide.sections || []).map((s) => ({ h2: f(s.h2), paras: (s.paras || []).map(f) })),
    faq: (guide.faq || []).map((x) => ({ q: f(x.q), a: f(x.a) })),
  };
}
