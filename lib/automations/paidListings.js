// Paid listings — the hourly part (lib/paidListings.js has the rules):
//   1. "Ends soon": `remindDaysBefore` days before a paid listing's time is up, one email
//      with a link to extend it (30 days for US$5 by default).
//   2. "Ended": when the time is up the listing goes off the site (status 'expired') and
//      one email offers to extend it — paying brings it straight back.
//   3. "A plan for agents": once per person, the first time they hit the paywall (a
//      listing saved as 'payment_pending', or paid) — leads into the pro plan later.
// Runs only while the paywall is ON. Every email is sent once (email_log dedupe keys
// paid-ending:<id>:<end>, paid-ended:<id>:<end>, agent-plan:<user>). Owners whose account
// is closed / blocked get no email (the listing still ends).
// DB + delivery injected — tests/paidListingsCron.test.mjs.
import { sendOnce } from './sendOnce.js';
import { paidConfig, paidInfo, usd, PAID_LISTINGS_ID } from '../paidListings.js';
import { typeLabel } from '../propertyTypeOptions.js';
import { isDeletedEmail } from '../accountDeletion.js';

export const PAID_AUTOMATION_ID = PAID_LISTINGS_ID;
const enc = encodeURIComponent;
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || '';
const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);
const DAY = 86400000;

export function listingTitle(p = {}) {
  const type = typeLabel(p.property_type, 'es') || p.property_type || 'Propiedad';
  const mode = p.listing_type === 'rent' ? 'en alquiler' : p.listing_type === 'sale' ? 'en venta' : '';
  const where = [p.neighborhood, p.city].filter(Boolean).join(', ');
  return `${[type, mode].filter(Boolean).join(' ')}${where ? ` · ${where}` : ''}`;
}

async function loadUsers(db, ids) {
  const out = new Map();
  for (const part of chunks([...new Set(ids.map(String))], 100)) {
    const rows = await db.select('users', `select=id,email,full_name,active,blocked,suspended&id=${inList(part)}`).catch(() => []);
    for (const u of rows) out.set(String(u.id), u);
  }
  return out;
}

export async function runPaidListings({ db, automation, templates = [], now = new Date(), deliver, frame, siteUrl, emailOverride = '', formatDate = (s) => String(s).slice(0, 10) }) {
  const cfg = paidConfig(automation);
  const out = { reminded: 0, ended: 0, agentEmails: 0, failed: 0 };
  if (!automation || !cfg.enabled) return { ...out, skippedReason: 'off' };
  const tpl = (id) => templates.find((t) => String(t.id) === String(id)) || null;
  const site = String(siteUrl || '').replace(/\/$/, '');

  // Paid listings = every listing with a succeeded listing payment.
  const pays = await db.select('payments', 'select=property_id&kind=in.(listing,listing_extend)&status=eq.succeeded&property_id=not.is.null&limit=20000');
  const ids = [...new Set(pays.map((p) => String(p.property_id)))];
  const props = [];
  for (const part of chunks(ids, 100)) {
    props.push(...await db.select('properties', `select=id,created_by,status,admin_status,raw_data,property_type,listing_type,neighborhood,city&id=${inList(part)}`));
  }
  const users = await loadUsers(db, props.map((p) => p.created_by).filter(Boolean));

  for (const p of props) {
    const info = paidInfo(p);
    if (!info || info.state !== 'active' || !info.until) continue;
    const end = new Date(info.until);
    const u = users.get(String(p.created_by));
    const to = emailOverride || (closed(u) ? null : u.email);
    const vars = {
      name: firstName(u?.full_name), property_title: listingTitle(p), property_url: `${site}/propiedad/${enc(p.id)}`,
      listing_until: formatDate(info.until), days_left: String(Math.max(0, Math.ceil((end - now) / DAY))),
      extend_url: `${site}/cuenta/publicaciones?extend=${enc(p.id)}`, price: usd(cfg.extendCents), free_days: String(cfg.extendDays),
      my_listings_url: `${site}/cuenta/publicaciones`, business_url: `${site}/empresas`, free_limit: String(cfg.freePerMonth),
    };

    if (end <= now) {
      // Time's up → off the site (a listing still being checked / rejected keeps its state).
      const live = p.status === 'published' || p.admin_status === 'active';
      await db.update('properties', `id=eq.${enc(p.id)}`, {
        ...(live ? { status: 'expired', admin_status: 'inactive' } : {}),
        raw_data: { ...(p.raw_data || {}), paid_listing: { ...info, state: 'expired', ended_at: now.toISOString() } },
      }, { returning: 'minimal' });
      out.ended++;
      if (to) {
        const r = await sendOnce({ db, automationId: PAID_AUTOMATION_ID, dedupeKey: `paid-ended:${p.id}:${info.until}`, tpl: tpl(cfg.endedTemplateId), vars: { ...vars, days_left: '0' }, to, frame, deliver });
        if (r === 'failed') out.failed++;
      }
      continue;
    }
    if (end - now <= cfg.remindDaysBefore * DAY && p.status === 'published' && to) {
      const r = await sendOnce({ db, automationId: PAID_AUTOMATION_ID, dedupeKey: `paid-ending:${p.id}:${info.until}`, tpl: tpl(cfg.endingTemplateId), vars, to, frame, deliver });
      if (r === 'sent') out.reminded++;
      if (r === 'failed') out.failed++;
    }
  }

  // "We have a plan for agents" — people who hit the paywall since it was switched on.
  const since = cfg.enabledAt ? `&created_at=gte.${enc(cfg.enabledAt)}` : '';
  const [pending, paid] = await Promise.all([
    db.select('properties', `select=created_by&status=eq.payment_pending&origin=eq.user${since}&limit=5000`).catch(() => []),
    db.select('payments', `select=user_id&kind=eq.listing&status=eq.succeeded${since}&limit=5000`).catch(() => []),
  ]);
  const hit = [...new Set([...pending.map((r) => r.created_by), ...paid.map((r) => r.user_id)].filter(Boolean).map(String))];
  const agentTpl = tpl(cfg.agentTemplateId);
  if (hit.length && agentTpl) {
    const people = await loadUsers(db, hit);
    for (const uid of hit) {
      const u = people.get(uid);
      const to = emailOverride || (closed(u) ? null : u.email);
      if (!to) continue;
      const r = await sendOnce({ db, automationId: PAID_AUTOMATION_ID, dedupeKey: `agent-plan:${uid}`, tpl: agentTpl, to, frame, deliver, vars: {
        name: firstName(u?.full_name), free_limit: String(cfg.freePerMonth), price: usd(Math.round((cfg.listCents * (100 - cfg.discountPct)) / 100)),
        business_url: `${site}/empresas`, my_listings_url: `${site}/cuenta/publicaciones`, publish_url: `${site}/publicar`,
      } });
      if (r === 'sent') out.agentEmails++;
      if (r === 'failed') out.failed++;
    }
  }
  return out;
}
