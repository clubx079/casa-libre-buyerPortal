// Demo data for looking at the referral program locally — SANDBOX database only, through
// the real local website (sign-up by email code via the fake Resend, the /ref link, the
// hourly engine). Test users are tagged ref-demo-…@example.com.
//
//   node scripts/seed-referrals-demo.mjs          create (idempotent: removes old demo rows first)
//   node scripts/seed-referrals-demo.mjs remove   remove the demo rows
// Needs: website on :3016, fake Resend on :54332, the program switched on (admin or e2e).
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const SANDBOX_HOST = '7c73a09c7a1c4793b081.db.airosofts.com';
const WEB = 'http://localhost:3016';
const MAIL = 'http://localhost:54332';
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const DB = String(env.AIROBASE_URL || '').replace(/\/$/, '');
if (new URL(DB).hostname !== SANDBOX_HOST) { console.error('REFUSED: not the sandbox database'); process.exit(9); }
console.log(`database host: ${new URL(DB).hostname}`);
const TAG = 'ref-demo';
const DAY = 86400000;
export const DEMO_PASSWORD = 'Demo-Referidos-2026';
const H = { apikey: env.AIROBASE_SECRET_KEY, Authorization: `Bearer ${env.AIROBASE_SECRET_KEY}`, 'Content-Type': 'application/json' };
const q = encodeURIComponent;
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...H, ...(prefer ? { Prefer: prefer } : {}) };
  if (!body) delete headers['Content-Type'];   // PostgREST refuses an empty JSON body
  const r = await fetch(`${DB}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

async function remove() {
  const users = await rest(`users?select=id&email=like.${q(`${TAG}-%`)}`);
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const inl = `in.(${ids.join(',')})`;
    const props = await rest(`properties?select=id&created_by=${inl}`);
    if (props.length) {
      const pin = `in.(${props.map((p) => p.id).join(',')})`;
      await rest(`property_images?property_id=${pin}`, { method: 'DELETE' }).catch(() => {});
      await rest(`automation_runs?property_id=${pin}`, { method: 'DELETE' }).catch(() => {});
      await rest(`properties?id=${pin}`, { method: 'DELETE' });
    }
    for (const r of await rest(`email_log?select=id&automation_id=eq.referrals&template_key=eq.ref_reward&run_id=${inl}`)) {
      await rest(`email_log?automation_id=eq.referrals&dedupe_key=like.${q(`ref-%:${r.id}%`)}`, { method: 'DELETE' });
    }
    await rest(`email_log?automation_id=eq.referrals&run_id=${inl}`, { method: 'DELETE' });
    await rest(`automation_runs?user_id=${inl}`, { method: 'DELETE' }).catch(() => {});
  }
  await rest(`email_log?to_email=like.${q(`${TAG}-%`)}`, { method: 'DELETE' });
  await rest(`otp_codes?identifier=like.${q(`${TAG}-%`)}`, { method: 'DELETE' }).catch(() => {});
  await rest(`users?email=like.${q(`${TAG}-%`)}`, { method: 'DELETE' });
  console.log(`removed ${ids.length} demo users and their rows`);
}
await remove();
if (process.argv[2] === 'remove') process.exit(0);

const PHOTOS = [
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&q=70',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900&q=70',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=70',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=70',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=70',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=70',
];
const sig = (k) => ({ device_id: `demo-${k}-${crypto.randomUUID().slice(0, 8)}`, fp: `fp${k}${crypto.randomBytes(4).toString('hex')}`, ip: `10.20.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` });
const cookiesOf = (res) => (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);

async function user(key, name, extra = {}) {
  const [u] = await rest('users', { method: 'POST', prefer: 'return=representation', body: { email: `${TAG}-${key}@example.com`, full_name: name, verified: true, active: true, auth_provider: 'password', password_hash: await bcrypt.hash(DEMO_PASSWORD, 10), ...extra } });
  return u;
}
let photo = 0;
async function listing(u, { type = 'casa', hood = 'Villa Morra', price = 185000, status = 'published', s = sig('x'), phone = '0981 600 000', beds = 3, area = 160, rent = false } = {}) {
  const img = PHOTOS[photo++ % PHOTOS.length];
  const [p] = await rest('properties', { method: 'POST', prefer: 'return=representation', body: {
    slug: `${type}-${hood.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomUUID().slice(0, 6)}`, property_type: type, listing_type: rent ? 'rent' : 'sale', price, currency: 'USD', price_usd: price,
    price_period: rent ? 'monthly' : null, address: hood, neighborhood: hood, city: 'Asunción', province: 'Central', country: 'Paraguay', covered_area: area, bedrooms: beds, bathrooms: 2,
    description: `${type === 'departamento' ? 'Departamento' : 'Casa'} luminosa en ${hood}, cerca de comercios y transporte. Publicación de demostración (sandbox).`,
    contact_name: u.full_name, contact_phone: phone, status, admin_status: status === 'published' ? 'active' : 'inactive', property_status: 'available', is_complete: true, origin: 'user',
    seller_type: 'owner', is_delisted: false, created_by: u.id, posted_by: u.id, latitude: -25.29 + Math.random() * 0.02, longitude: -57.58 + Math.random() * 0.02,
    feature_image_url: img, raw_data: { published_via: 'demo-seed', user_email: u.email, signals: s },
  } });
  await rest('property_images', { method: 'POST', prefer: 'return=minimal', body: [{ property_id: p.id, source_url: img, storage_url: img, is_feature: true, position: 0 }] }).catch(() => {});
  return p;
}
const sessionFor = (u) => {
  const p = Buffer.from(JSON.stringify({ uid: u.id, email: u.email, name: u.full_name, exp: Date.now() + 3600000 })).toString('base64url');
  return `cl_session=${p}.${crypto.createHmac('sha256', env.SESSION_SECRET).update(p).digest('base64url')}`;
};
async function codeOf(u) { return (await fetch(`${WEB}/api/account/referrals`, { headers: { Cookie: sessionFor(u) } }).then((r) => r.json())).code; }
async function clicks(code, n) { for (let i = 0; i < n; i++) await fetch(`${WEB}/ref/${code}`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (demo)' } }); }
async function joinVia(code, key, name, daysAgoClick = 3) {
  const cookie = `cl_ref=${encodeURIComponent(JSON.stringify({ c: code, t: Date.now() - daysAgoClick * DAY }))}`;
  const email = `${TAG}-${key}@example.com`;
  await fetch(`${WEB}/api/auth/code/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, fullName: name }) });
  const m = (await fetch(`${MAIL}/captured`).then((r) => r.json())).reverse().find((x) => (Array.isArray(x.to) ? x.to : [x.to]).includes(email));
  const res = await fetch(`${WEB}/api/auth/code/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ email, code: String(m?.subject || '').match(/\d{6}/)?.[0], fullName: name }) });
  const j = await res.json();
  if (!j.ok) throw new Error(`sign-up ${key}: ${JSON.stringify(j)}`);
  await new Promise((r) => setTimeout(r, 800));
  return { id: j.user.id, email, full_name: name };
}
const cron = () => fetch(`${WEB}/api/cron/automations`, { method: 'POST', headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }).then((r) => r.json());

// Referrers
const carolinaSig = sig('caro');
const carolina = await user('carolina', 'Carolina Benítez', { phone: '+595981600101', phone_verified_at: new Date(Date.now() - 40 * DAY).toISOString(), created_at: new Date(Date.now() - 70 * DAY).toISOString() });
await listing(carolina, { type: 'casa', hood: 'Villa Morra', price: 245000, s: carolinaSig, phone: '0981 600 101' });
await listing(carolina, { type: 'departamento', hood: 'Carmelitas', price: 1200, rent: true, beds: 2, area: 85, s: carolinaSig, phone: '0981 600 101' });
const martin = await user('martin', 'Martín Ortiz', { phone: '+595982700202', created_at: new Date(Date.now() - 45 * DAY).toISOString() });
await listing(martin, { type: 'casa', hood: 'Lambaré', price: 98000, s: sig('mart'), phone: '0982 700 202' });
for (const [k, n] of [['elena', 'Elena Cáceres'], ['ruben', 'Rubén Giménez'], ['silvia', 'Silvia Torres']]) await user(k, n, { created_at: new Date(Date.now() - 20 * DAY).toISOString() });

const cCode = await codeOf(carolina);
const mCode = await codeOf(martin);
await clicks(cCode, 14);
await clicks(mCode, 6);

// Carolina's invited people
for (const [k, n, hood, type, price] of [['maria', 'María González', 'Recoleta', 'casa', 168000], ['jorge', 'Jorge Acosta', 'Las Mercedes', 'departamento', 132000], ['lucia', 'Lucía Ramírez', 'Mburucuyá', 'casa', 210000]]) {
  const u = await joinVia(cCode, k, n, 4);
  await listing(u, { type, hood, price, s: sig(k), phone: `0983 ${Math.floor(100 + Math.random() * 800)} ${Math.floor(100 + Math.random() * 800)}` });
}
const diego = await joinVia(cCode, 'diego', 'Diego Fernández', 2);
await listing(diego, { hood: 'Sajonia', status: 'scanning', s: sig('dieg') });
await joinVia(cCode, 'sofia', 'Sofía Martínez', 1);
const caro2 = await joinVia(cCode, 'caro2', 'Caro B.', 1);
await listing(caro2, { hood: 'Villa Morra', price: 99000, s: carolinaSig, phone: '0981 600 101' });   // Carolina's own device + WhatsApp → not counted
// Martín's
const pablo = await joinVia(mCode, 'pablo', 'Pablo Duarte', 6);
await listing(pablo, { hood: 'San Vicente', price: 76000, s: sig('pabl') });
const ana = await joinVia(mCode, 'ana', 'Ana Villalba', 2);
await listing(ana, { hood: 'Trinidad', status: 'duplicate_review', s: sig('anav') });

const res = await cron();
console.log('engine run:', JSON.stringify(res.referrals));
// every demo account can sign in with the demo password (the invited ones signed up by code)
await rest(`users?email=like.${q(`${TAG}-%`)}&password_hash=is.null`, { method: 'PATCH', body: { password_hash: await bcrypt.hash(DEMO_PASSWORD, 10) } });
console.log(`\nDemo ready. Website logins (password ${DEMO_PASSWORD}):`);
console.log(`  ${carolina.email}  (3 qualified referrals → home-page reward)`);
console.log(`  ${martin.email}    (1 qualified, 1 held duplicate)`);
console.log(`  ${TAG}-maria@example.com  (a new member who signed up through Carolina's link)`);
