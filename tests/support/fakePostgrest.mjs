// In-memory stand-in for AiroBase PostgREST — the subset of the query API the
// automation code uses. Powers the unit tests AND the local end-to-end server
// (scripts/dev-postgrest.mjs), so nothing ever touches a live database.
//
// Supported: select=<cols> (joins ignored), filters <col>=<op>.<value> with ops
// eq, neq, gt, gte, lt, lte, is (null|true|false), not.is.null, in.(a,b),
// order=<col>.<asc|desc>, limit, offset; unique constraints → 409 / code 23505.
import crypto from 'node:crypto';

const decode = (s) => decodeURIComponent(String(s).replace(/\+/g, ' '));
const unq = (s) => s.replace(/^"(.*)"$/, '$1');

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const da = Date.parse(a), db = Date.parse(b);
  if (typeof a === 'string' && typeof b === 'string' && !Number.isNaN(da) && !Number.isNaN(db) && /\d{4}-\d{2}-\d{2}/.test(a) && /\d{4}-\d{2}-\d{2}/.test(b)) return da - db;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) - Number(b);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function matches(row, col, expr) {
  const v = row[col];
  let neg = false;
  if (expr.startsWith('not.')) { neg = true; expr = expr.slice(4); }
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot), val = expr.slice(dot + 1);
  let ok;
  switch (op) {
    case 'eq': ok = String(v) === val; break;
    case 'neq': ok = String(v) !== val; break;
    case 'gt': ok = v != null && cmp(v, val) > 0; break;
    case 'gte': ok = v != null && cmp(v, val) >= 0; break;
    case 'lt': ok = v != null && cmp(v, val) < 0; break;
    case 'lte': ok = v != null && cmp(v, val) <= 0; break;
    case 'is': ok = val === 'null' ? v == null : String(v) === val; break;
    case 'in': ok = val.replace(/^\(|\)$/g, '').split(',').map((x) => unq(x.trim())).includes(String(v)); break;
    default: throw new Error(`fakePostgrest: unsupported op ${op}`);
  }
  return neg ? !ok : ok;
}

export function createStore({ unique = {}, defaults = {} } = {}) {
  const tables = {};
  const t = (name) => (tables[name] ||= []);
  const withDefaults = (table, row) => ({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...(defaults[table] || {}),
    ...row,
  });

  function parse(query) {
    const out = { filters: [], order: null, limit: null, offset: 0, cols: null };
    for (const part of String(query || '').split('&').filter(Boolean)) {
      const i = part.indexOf('=');
      const k = decode(part.slice(0, i)), v = decode(part.slice(i + 1));
      if (k === 'select') out.cols = v;
      else if (k === 'order') out.order = v;
      else if (k === 'limit') out.limit = Number(v);
      else if (k === 'offset') out.offset = Number(v);
      else if (k === 'on_conflict') {}
      else out.filters.push([k, v]);
    }
    return out;
  }
  const filterRows = (table, filters) => t(table).filter((r) => filters.every(([c, e]) => matches(r, c, e)));
  function project(row, cols) {
    if (!cols || cols.trim() === '*') return { ...row };
    const out = {};
    for (const c of cols.split(',').map((x) => x.trim()).filter((x) => x && !x.includes('('))) out[c] = row[c];
    return out;
  }
  function conflict(table, row, ignore) {
    for (const key of unique[table] || []) {
      const cols = key.split(',');
      if (cols.some((c) => row[c] == null)) continue;
      if (t(table).some((r) => r !== ignore && cols.every((c) => String(r[c]) === String(row[c])))) {
        const e = new Error(`duplicate key value violates unique constraint (${key})`);
        e.status = 409; e.code = '23505';
        throw e;
      }
    }
  }

  const api = {
    tables,
    seed(table, rows) { for (const r of rows) t(table).push(withDefaults(table, r)); return api; },
    async select(table, query = '') {
      const q = parse(query);
      let rows = filterRows(table, q.filters);
      if (q.order) {
        const [col, dir] = q.order.split('.');
        rows = [...rows].sort((a, b) => (dir === 'desc' ? -1 : 1) * cmp(a[col], b[col]));
      }
      rows = rows.slice(q.offset, q.limit != null ? q.offset + q.limit : undefined);
      return rows.map((r) => project(r, q.cols));
    },
    async selectWithCount(table, query = '') {
      const q = parse(query);
      const count = filterRows(table, q.filters).length;
      return { rows: await api.select(table, query), count };
    },
    async insert(table, rows) {
      const list = Array.isArray(rows) ? rows : [rows];
      const made = [];
      for (const r of list) { const row = withDefaults(table, r); conflict(table, row); t(table).push(row); made.push(row); }
      return made.map((r) => ({ ...r }));
    },
    async update(table, filter, patch) {
      const rows = filterRows(table, parse(filter).filters);
      for (const r of rows) { const next = { ...r, ...patch }; conflict(table, next, r); Object.assign(r, patch); }
      return rows.map((r) => ({ ...r }));
    },
    async remove(table, filter) {
      const kill = new Set(filterRows(table, parse(filter).filters));
      tables[table] = t(table).filter((r) => !kill.has(r));
      return null;
    },
  };
  return api;
}

// The unique constraints / defaults from migrations/005_automations.sql.
export const AUTOMATION_SCHEMA = {
  unique: {
    email_templates: ['key'],
    automation_runs: ['automation_id,user_id'],
    email_log: ['dedupe_key'],
  },
  defaults: {
    email_templates: { is_active: true },
  },
};
