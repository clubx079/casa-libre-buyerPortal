// Inserts the "Promote the referral program" automation into ONE country database:
//   · the email template  key 'referral-promo'   (lib/referrals/promo.js PROMO_TEMPLATE, Spanish)
//   · the automation row  id  'referral_promo'   (OFF — an admin switches it on in Automations)
// Idempotent and never overwrites: a template or row that already exists is left exactly as
// it is ("already there"). Prints hosts only, never keys. Nothing is written without --apply.
//
//   node scripts/seed-referral-promo.mjs <country> [--apply] [--env <file>]
//     country  sandbox | py | bo | uy | ve | sv
//     --env    a .env file holding AIROBASE_URL_<CC> + AIROBASE_SECRET_KEY_<CC> (e.g. the admin
//              portal's .env.local). Variables already set in the shell win over the file.
//     sandbox  reads AIROBASE_URL / AIROBASE_SECRET_KEY from this repo's .env.local and refuses
//              any host other than the sandbox.
//   Without --apply: a dry run — shows what it would insert.
import fs from 'node:fs';
import { PROMO_ID, PROMO_TEMPLATE, PROMO_DEFAULTS } from '../lib/referrals/promo.js';

const SANDBOX_HOST = '7c73a09c7a1c4793b081.db.airosofts.com';
const COUNTRIES = ['sandbox', 'py', 'bo', 'uy', 've', 'sv'];
const args = process.argv.slice(2);
const cc = String(args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--env') || '').toLowerCase();
const apply = args.includes('--apply');
const envFile = args.includes('--env') ? args[args.indexOf('--env') + 1] : null;
if (!COUNTRIES.includes(cc)) { console.error(`usage: node scripts/seed-referral-promo.mjs <${COUNTRIES.join('|')}> [--apply] [--env <file>]`); process.exit(2); }

const readEnv = (file) => Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, '')]));
let url; let key;
if (cc === 'sandbox') {
  const env = readEnv(new URL('../.env.local', import.meta.url));
  url = env.AIROBASE_URL; key = env.AIROBASE_SECRET_KEY;
} else {
  const file = envFile ? readEnv(envFile) : {};
  const U = `AIROBASE_URL_${cc.toUpperCase()}`; const K = `AIROBASE_SECRET_KEY_${cc.toUpperCase()}`;
  url = process.env[U] || file[U]; key = process.env[K] || file[K];
  if (!url || !key) { console.error(`Missing ${U} / ${K} (shell or --env file).`); process.exit(2); }
}
const base = String(url || '').replace(/\/(rest\/v1\/?)?$/, '').replace(/\/$/, '');
const host = (() => { try { return new URL(base).hostname; } catch { return ''; } })();
if (!host || !key) { console.error('No database URL / key.'); process.exit(2); }
if (cc === 'sandbox' && host !== SANDBOX_HOST) { console.error(`REFUSED: ${host} is not the sandbox (${SANDBOX_HOST}).`); process.exit(9); }
if (cc !== 'sandbox' && host === SANDBOX_HOST) console.log('note: this is the sandbox host');
console.log(`${cc.toUpperCase()} database: ${host}${apply ? '' : '   (dry run — add --apply to write)'}`);

const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...H, ...(prefer ? { Prefer: prefer } : {}) };
  if (!body) delete headers['Content-Type'];
  const r = await fetch(`${base}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

// 1. The email template (by key).
let [tpl] = await rest(`email_templates?select=id,key,name,is_active&key=eq.${encodeURIComponent(PROMO_TEMPLATE.key)}&limit=1`);
if (tpl) console.log(`template '${PROMO_TEMPLATE.key}': already there (${tpl.is_active === false ? 'switched off' : 'active'}) — left as it is`);
else if (!apply) console.log(`template '${PROMO_TEMPLATE.key}': would insert “${PROMO_TEMPLATE.subject}”`);
else {
  [tpl] = await rest('email_templates', { method: 'POST', prefer: 'return=representation', body: [{ ...PROMO_TEMPLATE, is_active: true }] });
  console.log(`template '${PROMO_TEMPLATE.key}': inserted`);
}

// 2. The automation row (OFF; settings = the defaults; the template picked).
const [row] = await rest(`automations?select=id,enabled,template_id&id=eq.${PROMO_ID}&limit=1`);
const settings = { ...PROMO_DEFAULTS };
if (row) console.log(`automation '${PROMO_ID}': already there (${row.enabled ? 'ON' : 'off'}${row.template_id ? '' : ', no template picked'}) — left as it is`);
else if (!apply) console.log(`automation '${PROMO_ID}': would insert (off; ${JSON.stringify(settings)})`);
else {
  await rest('automations', { method: 'POST', prefer: 'return=minimal', body: [{ id: PROMO_ID, enabled: false, template_id: tpl?.id || null, free_tiers: [settings], updated_at: new Date().toISOString() }] });
  console.log(`automation '${PROMO_ID}': inserted (off)`);
}

// For information: the promo only sends while the referral program is on here.
const [ref] = await rest('automations?select=id,enabled&id=eq.referrals&limit=1');
console.log(`referral program here: ${ref ? (ref.enabled ? 'ON' : 'set up, off') : 'not set up yet (admin → Referrals → save)'}`);
