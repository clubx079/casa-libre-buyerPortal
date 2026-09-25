// Local stand-in for AiroBase PostgREST (in-memory) — for end-to-end testing the
// automation + admin pages WITHOUT touching any real database.
//
//   node scripts/dev-postgrest.mjs [port] [seed.json]
//
// Point a portal at it with AIROBASE_URL=http://localhost:<port> (+ any secret key).
// seed.json = { "<table>": [rows…], … }. State lives in memory until you stop it.
// Uses the same engine as the unit tests (tests/support/fakePostgrest.mjs).
import http from 'node:http';
import fs from 'node:fs';
import { createStore, AUTOMATION_SCHEMA } from '../tests/support/fakePostgrest.mjs';

const port = Number(process.argv[2] || 54321);
const store = createStore(AUTOMATION_SCHEMA);
if (process.argv[3]) {
  const seed = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  for (const [table, rows] of Object.entries(seed)) store.seed(table, rows);
}

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (!m) return send(res, 404, { message: 'not found' });
  const table = m[1];
  const query = url.search.slice(1);
  const prefer = String(req.headers.prefer || '');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : null;
  try {
    if (req.method === 'GET') {
      if (prefer.includes('count=exact')) {
        const { rows, count } = await store.selectWithCount(table, query);
        return send(res, 200, rows, { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${count}` });
      }
      return send(res, 200, await store.select(table, query));
    }
    if (req.method === 'POST') {
      const rows = await store.insert(table, body);
      return prefer.includes('return=minimal') ? send(res, 201) : send(res, 201, rows);
    }
    if (req.method === 'PATCH') {
      const rows = await store.update(table, query, body);
      return prefer.includes('return=minimal') ? send(res, 204) : send(res, 200, rows);
    }
    if (req.method === 'DELETE') { await store.remove(table, query); return send(res, 204); }
    return send(res, 405, { message: 'method not allowed' });
  } catch (e) {
    return send(res, e.status || 400, { message: e.message, code: e.code || null });
  }
}).listen(port, () => console.log(`dev-postgrest listening on http://localhost:${port}`));
