// Local stand-in for the Resend API — captures every email instead of sending it, so an
// end-to-end run can read the exact HTML a user would get without mailing anyone.
//
//   node scripts/fake-resend.mjs [port]
//
// Point a portal at it with RESEND_BASE_URL=http://localhost:<port> (+ any RESEND_API_KEY;
// the Resend SDK reads RESEND_BASE_URL). GET /captured → every email so far (newest
// last, attachments left out); DELETE /captured → clear. GET /emails/<id> → its status
// (Resend's "Retrieve email": last_event, 'delivered' by default); POST
// /captured/<id>/event { "last_event": "bounced" } → set it.
import http from 'node:http';

const port = Number(process.argv[2] || 54332);
const captured = [];

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const path = new URL(req.url, `http://localhost:${port}`).pathname;
  if (req.method === 'POST' && path === '/emails') {
    const body = raw ? JSON.parse(raw) : {};
    const id = `fake_${captured.length + 1}_${Date.now()}`;
    const { attachments, ...rest } = body;
    captured.push({ id, at: new Date().toISOString(), ...rest, attachments: (attachments || []).length });
    return send(res, 200, { id });
  }
  if (path === '/captured' && req.method === 'GET') return send(res, 200, captured);
  if (path === '/captured' && req.method === 'DELETE') { captured.length = 0; return send(res, 200, { ok: true }); }
  const one = path.match(/^\/emails\/([^/]+)$/);
  if (one && req.method === 'GET') {
    const m = captured.find((x) => x.id === decodeURIComponent(one[1]));
    return m ? send(res, 200, { object: 'email', id: m.id, to: m.to, subject: m.subject, created_at: m.at, last_event: m.last_event || 'delivered' }) : send(res, 404, { message: 'not found' });
  }
  const ev = path.match(/^\/captured\/([^/]+)\/event$/);
  if (ev && req.method === 'POST') {
    const m = captured.find((x) => x.id === decodeURIComponent(ev[1]));
    if (!m) return send(res, 404, { message: 'not found' });
    m.last_event = (raw ? JSON.parse(raw) : {}).last_event || 'delivered';
    return send(res, 200, { ok: true, id: m.id, last_event: m.last_event });
  }
  return send(res, 404, { message: 'not found' });
}).listen(port, () => console.log(`fake-resend listening on http://localhost:${port}`));
