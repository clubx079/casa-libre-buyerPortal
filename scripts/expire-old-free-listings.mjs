// Backfill for "free listings end too" (2026-11-17, lib/paidListings.js freeUntil):
// finds LIVE FREE user listings (source_id null, no paid window) already older than the
// admin's `free_days` (Paid listings settings) and ends them the same way the hourly job
// does (lib/automations/paidListings.js expireFreeListings): status 'expired' +
// admin_status 'inactive' (off the site, NEVER deleted) + raw_data.free_listing, and the
// "ended — extend it" email once each (email_log dedupe free-ended:<id>:<end>, the same key
// the cron uses, so the cron never sends it again). Owners with a closed account get no
// email; their listing still ends. Publish date = properties.created_at.
//
// DRY RUN by default — read-only: prints per country how many would end + ids and age.
//   node scripts/expire-old-free-listings.mjs                         # this site's .env.local (one DB)
//   node scripts/expire-old-free-listings.mjs --env=<file> --countries=py,bo,uy,ve,sv
//        (multi-country: AIROBASE_URL_<CC> + AIROBASE_SECRET_KEY_<CC> in that file)
//   --no-ids         counts + oldest age only
//   --apply          really end them + send the emails (RESEND_API_KEY / RESEND_FROM from the env file)
//   --yes-production required with --apply on any DB that is not the SANDBOX
//   --email-override=<addr>  every email to this address (default: AUTOMATION_EMAIL_OVERRIDE from the env file)
//   --site=<url>     link base in the emails (default APP_PUBLIC_URL)
import fs from 'node:fs';
import path from 'node:path';
import { paidConfig, freeOverdue, freeUntil, PAID_LISTINGS_ID } from '../lib/paidListings.js';
import { expireFreeListings, loadFreeCandidates, makeMailVars } from '../lib/automations/paidListings.js';

const SANDBOX_HOST = '7c73a09c7a1c4793b081';
const DAY = 86400000;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const envFile = path.resolve(String(args.env || '.env.local'));
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const APPLY = !!args.apply;
const targets = args.countries
  ? String(args.countries).split(',').map((c) => c.trim().toUpperCase()).filter(Boolean).map((cc) => ({ cc, url: env[`AIROBASE_URL_${cc}`], key: env[`AIROBASE_SECRET_KEY_${cc}`] }))
  : [{ cc: String(env.COUNTRY || '—').toUpperCase(), url: env.AIROBASE_URL, key: env.AIROBASE_SECRET_KEY }];

function makeDb(url, key, writable) {
  const base = `${String(url).replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')}/rest/v1`;
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const req = async (method, table, query, body, prefer) => {
    if (method !== 'GET' && !writable) throw new Error(`DRY RUN: refused ${method} ${table}`);
    const r = await fetch(`${base}/${table}${query ? `?${query}` : ''}`, { method, headers: { apikey: H.apikey, Authorization: H.Authorization, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (!r.ok) { const e = new Error(`${method} ${table} ${r.status} ${text.slice(0, 200)}`); e.status = r.status; try { e.code = JSON.parse(text).code; } catch {} throw e; }
    return text ? JSON.parse(text) : null;
  };
  return {
    select: (t, q) => req('GET', t, q),
    insert: (t, rows) => req('POST', t, '', rows, 'return=representation'),
    update: (t, q, patch, o = {}) => req('PATCH', t, q, patch, o.returning === 'minimal' ? 'return=minimal' : 'return=representation'),
    remove: (t, q) => req('DELETE', t, q, null, 'return=minimal'),
  };
}

// Resend, the same sender as the site (no app-badge images in this plain send).
async function deliver({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'email_not_configured' };
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM || 'Casa Libre <notifications@casa-libre.com>', to, subject, html, text }) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j.id || null } : { ok: false, error: j.message || `resend ${r.status}` };
}

const now = new Date();
let refused = false;
for (const t of targets) {
  if (!t.url || !t.key) { console.log(`\n[${t.cc}] no URL/key in ${envFile} — skipped`); continue; }
  const sandbox = t.url.includes(SANDBOX_HOST);
  const label = `${t.cc}${sandbox ? ' (SANDBOX)' : ' (PRODUCTION)'}`;
  if (APPLY && !sandbox && !args['yes-production']) { console.log(`\n[${label}] --apply on production needs --yes-production — skipped`); refused = true; continue; }
  const db = makeDb(t.url, t.key, APPLY);
  const [row] = await db.select('automations', `select=*&id=eq.${PAID_LISTINGS_ID}&limit=1`).catch(() => []);
  // the admin's numbers (free_days …); with the paywall OFF the cron ends nothing, but the
  // dry run still shows what WOULD end once it is switched on
  const cfg = paidConfig(row ? { ...row, enabled: true } : { enabled: true });
  const overdue = freeOverdue(await loadFreeCandidates(db, cfg, now, { remind: false }), cfg, now);
  const ages = overdue.map((p) => ({ id: p.id, age: Math.floor((now - Date.parse(p.created_at)) / DAY), until: freeUntil(p, cfg) }));
  const oldest = ages.reduce((m, a) => Math.max(m, a.age), 0);
  console.log(`\n[${label}] paywall ${row?.enabled ? 'ON' : row ? 'OFF' : 'NOT SET UP'} · free_days=${cfg.days} · live free user listings older than ${cfg.days} days: ${overdue.length}${overdue.length ? ` · oldest ${oldest} days` : ''}`);
  if (!args['no-ids']) for (const a of ages) console.log(`   ${a.id}  ${a.age} days  (ended ${a.until.slice(0, 10)})`);
  if (!APPLY) continue;
  if (!row?.enabled) { console.log('   paywall is OFF here — nothing applied (renewing would be impossible)'); continue; }

  const templates = await db.select('email_templates', 'select=*');
  const tpl = (id) => templates.find((x) => String(x.id) === String(id)) || null;
  const site = String(args.site || env.APP_PUBLIC_URL || '').replace(/\/$/, '');
  const r = await expireFreeListings({
    db, cfg: paidConfig(row), now, tpl, rows: overdue, remind: false, deliver,
    mailVars: makeMailVars({ site, cfg, now, formatDate: (s) => { try { return new Date(s).toLocaleDateString('es', { day: 'numeric', month: 'long' }); } catch { return String(s).slice(0, 10); } } }),
    frame: { brand: 'Casa Libre' }, emailOverride: String(args['email-override'] || env.AUTOMATION_EMAIL_OVERRIDE || ''),
  });
  console.log(`   APPLIED: ended ${r.ended}, emails failed ${r.failed}`);
}
console.log(APPLY ? '\nDone.' : '\nDRY RUN — nothing was changed or sent. Add --apply to end them.');
if (refused) process.exitCode = 2;
