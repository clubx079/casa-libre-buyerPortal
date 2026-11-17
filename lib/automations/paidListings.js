// Paid listings — the hourly part (lib/paidListings.js has the rules):
//   1. "Ends soon": `remindDaysBefore` days before a paid listing's time is up, one email
//      with a link to extend it (30 days for US$5 by default).
//   2. "Ended": when the time is up the listing goes off the site (status 'expired') and
//      one email offers to extend it — paying brings it straight back.
//   2b. FREE listings (2026-11-17): a free user listing also ends `days` after it was
//      published (lib/paidListings.js freeUntil) — same "ends soon" / "ended" emails, same
//      'expired' status (off the site, never deleted); renewing it is the paid extension.
//   3. "A plan for agents": once per person, the first time they hit the paywall (a
//      listing saved as 'payment_pending', or paid) — leads into the pro plan later.
// Runs only while the paywall is ON. Every email is sent once (email_log dedupe keys
// paid-ending:<id>:<end>, paid-ended:<id>:<end>, free-ending:<id>:<end>, free-ended:<id>:<end>,
// agent-plan:<user>). Owners whose account
// is closed / blocked get no email (the listing still ends).
// DB + delivery injected — tests/paidListingsCron.test.mjs.
import { sendOnce } from './sendOnce.js';
import { paidConfig, paidInfo, usd, PAID_LISTINGS_ID, freeUntil, freeListingAction } from '../paidListings.js';
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

// The same variables for paid and free listings (the templates fit both: "your listing is on
// Casa Libre until …, extend it {{free_days}} days for {{price}}").
export const makeMailVars = ({ site, cfg, now = new Date(), formatDate = (s) => String(s).slice(0, 10) }) => (p, u, until, end) => ({
  name: firstName(u?.full_name), property_title: listingTitle(p), property_url: `${site}/propiedad/${enc(p.id)}`,
  listing_until: formatDate(until), days_left: String(Math.max(0, Math.ceil((end - now) / DAY))),
  extend_url: `${site}/cuenta/publicaciones?extend=${enc(p.id)}`, price: usd(cfg.extendCents), free_days: String(cfg.extendDays),
  my_listings_url: `${site}/cuenta/publicaciones`, business_url: `${site}/empresas`, free_limit: String(cfg.freePerMonth),
});

export async function runPaidListings({ db, automation, templates = [], now = new Date(), deliver, frame, siteUrl, emailOverride = '', formatDate = (s) => String(s).slice(0, 10) }) {
  const cfg = paidConfig(automation);
  const out = { reminded: 0, ended: 0, freeReminded: 0, freeEnded: 0, agentEmails: 0, failed: 0 };
  if (!automation || !cfg.enabled) return { ...out, skippedReason: 'off' };
  const tpl = (id) => templates.find((t) => String(t.id) === String(id)) || null;
  const site = String(siteUrl || '').replace(/\/$/, '');
  const mailVars = makeMailVars({ site, cfg, now, formatDate });

  // Paid listings = every listing with a succeeded listing payment.
  const pays = await db.select('payments', 'select=property_id&kind=in.(listing,listing_extend)&status=eq.succeeded&property_id=not.is.null&limit=20000');
  // + listings whose payment-pending gift was claimed (lib/automations/paymentFollowup.js): they
  // have a paid window but no payment row, and must end like the others.
  // (AiroBase has no JSON-path filters → live user listings are read and checked here.)
  const userLive = await db.select('properties', 'select=id,raw_data&source_id=is.null&created_by=not.is.null&status=eq.published&limit=20000').catch(() => []);
  const gifted = userLive.filter((p) => paidInfo(p)?.gift?.claimed_at && paidInfo(p)?.until);
  const ids = [...new Set([...pays.map((p) => String(p.property_id)), ...gifted.map((p) => String(p.id))])];
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
    const vars = mailVars(p, u, info.until, end);

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

  // FREE listings: same end, same emails (lib/paidListings.js freeListingAction).
  const free = await expireFreeListings({ db, cfg, now, tpl, mailVars, frame, deliver, emailOverride });
  out.freeReminded = free.reminded; out.freeEnded = free.ended; out.failed += free.failed;

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

// Live FREE user listings old enough to be inside the "ends soon" window or past their end.
// Paged; paid ones (raw_data.paid_listing.until) are left to the loop above.
export async function loadFreeCandidates(db, cfg, now = new Date(), { remind = true } = {}) {
  const cutoff = new Date(now.getTime() - (cfg.days - (remind ? cfg.remindDaysBefore : 0)) * DAY).toISOString();
  const rows = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const page = await db.select('properties', `select=id,created_by,created_at,status,admin_status,source_id,raw_data,property_type,listing_type,neighborhood,city&source_id=is.null&created_by=not.is.null&status=eq.published&created_at=lte.${enc(cutoff)}&order=created_at.asc&limit=1000&offset=${offset}`);
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows.filter((p) => !paidInfo(p)?.until);
}

// End one FREE listing the way the hourly job does: off the site (status 'expired',
// admin_status 'inactive' — never deleted) + raw_data.free_listing = { state, until, ended_at }.
export async function endFreeListing(db, p, until, now = new Date()) {
  await db.update('properties', `id=eq.${enc(p.id)}&status=eq.published`, {
    status: 'expired', admin_status: 'inactive',
    raw_data: { ...(p.raw_data || {}), free_listing: { state: 'expired', until, ended_at: now.toISOString() } },
  }, { returning: 'minimal' });
}

// The FREE-listing part of the hourly job (also used by scripts/expire-old-free-listings.mjs
// with { remind: false } — only the ones already past their end).
export async function expireFreeListings({ db, cfg, now = new Date(), tpl, mailVars, frame, deliver, emailOverride = '', remind = true, rows = null }) {
  const out = { reminded: 0, ended: 0, failed: 0, endedIds: [] };
  const list = rows || await loadFreeCandidates(db, cfg, now, { remind });
  const users = await loadUsers(db, list.map((p) => p.created_by).filter(Boolean));
  for (const p of list) {
    const action = freeListingAction(p, cfg, now);
    if (!action || (action === 'remind' && !remind)) continue;
    const until = freeUntil(p, cfg);
    const u = users.get(String(p.created_by));
    const to = emailOverride || (closed(u) ? null : u.email);   // closed account → no email, the listing still ends
    const vars = mailVars(p, u, until, new Date(until));
    if (action === 'end') {
      await endFreeListing(db, p, until, now);
      out.ended++; out.endedIds.push(p.id);
      if (to) {
        const r = await sendOnce({ db, automationId: PAID_AUTOMATION_ID, dedupeKey: `free-ended:${p.id}:${until}`, tpl: tpl(cfg.endedTemplateId), vars: { ...vars, days_left: '0' }, to, frame, deliver });
        if (r === 'failed') out.failed++;
      }
      continue;
    }
    if (to) {
      const r = await sendOnce({ db, automationId: PAID_AUTOMATION_ID, dedupeKey: `free-ending:${p.id}:${until}`, tpl: tpl(cfg.endingTemplateId), vars, to, frame, deliver });
      if (r === 'sent') out.reminded++;
      if (r === 'failed') out.failed++;
    }
  }
  return out;
}
