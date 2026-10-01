// Automatic push notifications for listing OWNERS — the app's "Tus publicaciones"
// channel. Website-only: the app just receives them and opens the screen in
// data.url (app: lib/pushRoutes.js), so new kinds here need no app update.
//
//   pushContactToOwner  INSTANT — a buyer tapped WhatsApp / call / copy number on a
//                       listing (app/api/contact-track). Once per listing per day.
//   runOwnerPushes      HOURLY, daytime only (9:00–20:59 local) — from
//                       /api/cron/automations:
//                         views     a views milestone the views automation just
//                                   emailed about (email_log, last 48 h)
//                         promo     a highlight / home display ending within 24 h
//                         drafts    a draft untouched for 1–7 days (one reminder)
//                       At most ONE push per owner per run; the rest go next hour.
//
// Pure: takes the db helpers and a `send` (lib/push.js sendPush bound to the db),
// which already skips owners who switched the channel off and never sends the same
// dedupeKey twice (push_log). Tests: tests/ownerPushes.test.mjs.

import { VIEWS_AUTOMATION_ID } from './automations/viewsMilestone.js';

const TZ = { py: 'America/Asuncion', bo: 'America/La_Paz', uy: 'America/Montevideo', ve: 'America/Caracas' };
const H = 3600e3;
const D = 24 * H;
const enc = (v) => encodeURIComponent(String(v));
const iso = (t) => new Date(t).toISOString();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missingTable = (e) => !!e && (e.status === 404 || e.code === 'PGRST205' || e.code === '42P01');
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
const titleOf = (p) => [cap(p?.property_type || p?.ptype), p?.neighborhood || p?.city].filter(Boolean).join(' · ') || 'tu propiedad';
const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;

export function localHour(now, countryCode = 'py') {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ[countryCode] || TZ.py, hour: 'numeric', hourCycle: 'h23' }).format(now));
  } catch {
    return now.getUTCHours();
  }
}
export const isDaytime = (now, countryCode) => { const h = localHour(now, countryCode); return h >= 9 && h < 21; };

export async function pushContactToOwner(db, send, { propertyId, buyerUserId = null, now = new Date() } = {}) {
  if (!propertyId || !UUID.test(String(propertyId))) return { skipped: 'no_property' };
  const [p] = await db.select('properties', `select=id,created_by,property_type,neighborhood,city&id=eq.${enc(propertyId)}&limit=1`);
  if (!p?.created_by) return { skipped: 'no_owner' };
  if (buyerUserId && String(buyerUserId) === String(p.created_by)) return { skipped: 'own_listing' };
  return send({
    userIds: [p.created_by], channel: 'listings', kind: 'contact',
    title: 'Un interesado en tu propiedad',
    body: `Alguien quiere contactarte por ${titleOf(p)}. Revisá tu WhatsApp y tus llamadas.`,
    data: { url: '/my-listings' },
    dedupeKey: `push:contact:${p.id}:${iso(now).slice(0, 10)}`,
  });
}

export async function runOwnerPushes(db, send, { now = new Date(), countryCode = 'py', limit = 300 } = {}) {
  if (!isDaytime(now, countryCode)) return { skipped: 'night' };
  const out = { views: 0, promo: 0, drafts: 0, errors: 0 };
  const pushed = new Set();   // owners who already got one this run

  const tryOne = async (type, owner, msg) => {
    if (!owner || pushed.has(String(owner))) return;
    try {
      const r = await send({ ...msg, userIds: [owner], channel: 'listings', kind: type });
      if (r?.sent > 0) { pushed.add(String(owner)); out[type]++; }
    } catch { out.errors++; }
  };
  const section = async (fn) => { try { await fn(); } catch (e) { if (!missingTable(e)) out.errors++; } };
  const ownersOf = async (ids) => {
    if (!ids.length) return new Map();
    const rows = await db.select('properties', `select=id,created_by,property_type,neighborhood,city&id=${inList(ids)}`);
    return new Map(rows.map((r) => [String(r.id), r]));
  };

  // Highlight / home display ending within 24 h (paid or the free first-listing gift).
  await section(async () => {
    const rows = await db.select('properties', [
      'select=id,created_by,property_type,neighborhood,city,promotion_expires_at',
      'promotion_plan=not.is.null', 'created_by=not.is.null',
      `promotion_expires_at=gt.${enc(iso(now))}`, `promotion_expires_at=lte.${enc(iso(now.getTime() + D))}`,
      `limit=${limit}`,
    ].join('&'));
    for (const p of rows) {
      await tryOne('promo', p.created_by, {
        title: 'Tu destacado termina mañana',
        body: `El destacado de ${titleOf(p)} termina mañana. Renovalo desde Mis publicaciones para seguir arriba.`,
        data: { url: '/my-listings' },
        dedupeKey: `push:promo-end:${p.id}:${String(p.promotion_expires_at).slice(0, 10)}`,
      });
    }
  });

  // Views milestones the views automation EMAILED in the last 48 h (its email_log
  // rows, key views:<listing>:<number>). Not listing_view_milestones: that table
  // also holds "baselines" — listings first seen already past a number, never emailed.
  await section(async () => {
    const logs = await db.select('email_log',
      `select=dedupe_key,created_at&automation_id=eq.${VIEWS_AUTOMATION_ID}&status=eq.sent&created_at=gte.${enc(iso(now.getTime() - 2 * D))}&limit=${limit}`);
    const hits = logs.map((l) => String(l.dedupe_key || '').match(/^views:([0-9a-f-]{36}):(\d+)$/i)).filter(Boolean)
      .map((m) => ({ property_id: m[1], n: Number(m[2]) }));
    const props = await ownersOf([...new Set(hits.map((h) => h.property_id))]);
    for (const { property_id, n } of hits) {
      const p = props.get(String(property_id));
      if (!p?.created_by) continue;
      await tryOne('views', p.created_by, {
        title: 'Tu publicación está sumando visitas',
        body: `${titleOf(p)} ya superó las ${n.toLocaleString('es-PY')} visitas en Casa Libre.`,
        data: { url: `/property/${p.id}` },
        dedupeKey: `push:views:${p.id}:${n}`,
      });
    }
  });

  // Drafts untouched for 1–7 days — one reminder per draft.
  await section(async () => {
    const rows = await db.select('listing_drafts', [
      'select=id,user_id,data,updated_at',
      `updated_at=lte.${enc(iso(now.getTime() - D))}`, `updated_at=gte.${enc(iso(now.getTime() - 7 * D))}`,
      'order=updated_at.desc', `limit=${limit}`,
    ].join('&'));
    for (const d of rows) {
      await tryOne('drafts', d.user_id, {
        title: 'Tu publicación quedó a medio terminar',
        body: `Te falta poco para publicar ${titleOf(d.data || {})}. Terminala desde Mis publicaciones.`,
        data: { url: '/my-listings' },
        dedupeKey: `push:draft:${d.id}`,
      });
    }
  });

  return out;
}
