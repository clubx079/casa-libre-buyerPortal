// DRY RUN of the first-listing automation against a live country DB: reads are real,
// every write and every email is only RECORDED and printed — nothing is changed or sent.
//   node scripts/dryrun-first-listing.mjs --enabled-at=2026-09-27T14:00:00Z --wait-days=0 [--country=PY]
// Uses the admin portal's .env.local (AIROBASE_URL_<CC> / AIROBASE_SECRET_KEY_<CC>).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFirstListing } from '../lib/automations/firstListing.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a, true]; }));
const cc = String(args.country || 'PY').toUpperCase();
const env = {};
for (const line of fs.readFileSync(path.join(here, '..', '..', 'casa-libre-adminPortal', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env[`AIROBASE_URL_${cc}`], KEY = env[`AIROBASE_SECRET_KEY_${cc}`];
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const writes = [], mails = [];
const db = {
  async select(table, query = '') {
    const r = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: H });
    if (!r.ok) throw new Error(`${table} ${r.status} ${await r.text()}`);
    return r.json();
  },
  async insert(table, rows) { writes.push(['INSERT', table, rows]); return rows.map((x, i) => ({ id: `dry-${writes.length}-${i}`, ...x })); },
  async update(table, filter, patch) { writes.push(['UPDATE', table, filter, patch]); return [{}]; },
  async remove(table, filter) { writes.push(['DELETE', table, filter]); return null; },
};

const [automation] = await db.select('automations', 'select=*&id=eq.first_listing_free_home');
const overrides = { enabled: true };
if (args['enabled-at']) overrides.enabled_at = args['enabled-at'];
if (args['wait-days'] != null) overrides.wait_days = Number(args['wait-days']);
if (args['remind-days'] != null) overrides.remind_days_before = Number(args['remind-days']);
if (args['first-tier'] != null) overrides.first_tier_count = Number(args['first-tier']);
if (args['later-days'] != null) overrides.later_free_days = Number(args['later-days']);
const templates = await db.select('email_templates', 'select=*');
const result = await runFirstListing({
  db, automation: { ...automation, ...overrides }, templates, now: new Date(),
  deliver: async (m) => { mails.push(m); return { ok: true, id: 'dry' }; },
  grant: async (pid, days, now) => { writes.push(['GRANT home display', pid, `${days} days`]); return new Date(now.getTime() + days * 86400000).toISOString(); },
  frame: { brand: 'Casa Libre' }, siteUrl: 'https://casa-libre.com.py', extendUrl: () => 'https://casa-libre.com.py/api/promo/extend?t=…', formatDate: (s) => s.slice(0, 10),
});
console.log('settings used:', JSON.stringify({ ...automation, ...overrides, gift_template_id: undefined, reminder_template_id: undefined }));
console.log('result:', JSON.stringify(result));
console.log(`\nWOULD WRITE (${writes.length}):`);
for (const w of writes) console.log('  ', JSON.stringify(w).slice(0, 300));
console.log(`\nWOULD EMAIL (${mails.length}):`);
for (const m of mails) console.log('   to:', m.to, '| subject:', m.subject);
