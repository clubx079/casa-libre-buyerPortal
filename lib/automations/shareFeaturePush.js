// "New: Share button" APP NOTIFICATION — the push companion of the share-feature email
// (lib/automations/shareFeature.js), sent once per person, from the same hourly cron and only
// while that automation is on. No new app screens: it opens screens the app already has
// (app lib/pushRoutes.js) — My listings for people with a listing (that's where the Share
// button is), the home screen for everyone else.
//
//   • Who: app users with a phone registered for notifications (push_tokens.enabled), account
//     open, not a test / team account (lib/internalAccounts.js + Admin "Mark as test"), not
//     opted out of WhatsApp/marketing. People who switched "news" off in the app are skipped by
//     sendPush itself.
//   • Once: push_log dedupe key 'sharefeature-push:<user>'.
//   • Night: nothing is sent (quiet — same 09:00–19:00 window as the email).
//   • Language: the user's language when we know it (langOf), else Spanish. (The app does not
//     report its language to the server yet, so today that is Spanish for everyone.)
//   • Switch: automation settings free_tiers[0].push — false turns the push off (default on).
// Pure + dependency-injected (tests/shareFeaturePush.test.mjs).
import { isDeletedEmail } from '../accountDeletion.js';
import { isInternalAccount } from '../internalAccounts.js';
import { SHARE_FEATURE_ID, shareFeatureConfig } from '../shareFeature.js';

export const SHARE_PUSH_KIND = 'share_feature';
export const sharePushKey = (userId) => `sharefeature-push:${userId}`;

export const SHARE_PUSH_TEXT = {
  es: {
    owner: { title: 'Nuevo: botón Compartir 📤', body: 'Ahora podés compartir tu propiedad por WhatsApp, Instagram y Facebook con un toque, desde Mis publicaciones.' },
    other: { title: 'Nuevo en Casa-Libre: botón Compartir 📤', body: 'Ahora podés compartir cualquier propiedad por WhatsApp, Instagram y Facebook con un toque.' },
  },
  en: {
    owner: { title: 'New: Share button 📤', body: 'You can now share your property on WhatsApp, Instagram and Facebook with one tap, from My listings.' },
    other: { title: 'New on Casa-Libre: Share button 📤', body: 'You can now share any property on WhatsApp, Instagram and Facebook with one tap.' },
  },
  pt: {
    owner: { title: 'Novo: botão Compartilhar 📤', body: 'Agora você pode compartilhar seu imóvel no WhatsApp, Instagram e Facebook com um toque, em Meus anúncios.' },
    other: { title: 'Novo na Casa-Libre: botão Compartilhar 📤', body: 'Agora você pode compartilhar qualquer imóvel no WhatsApp, Instagram e Facebook com um toque.' },
  },
};

// → { title, body, url } for one person
export function sharePushMessage(lang, hasListing) {
  const t = (SHARE_PUSH_TEXT[lang] || SHARE_PUSH_TEXT.es)[hasListing ? 'owner' : 'other'];
  return { ...t, url: hasListing ? '/my-listings' : '/(tabs)' };
}

export const sharePushEnabled = (row) => {
  const s = (Array.isArray(row?.free_tiers) ? row.free_tiers[0] : row?.free_tiers) || {};
  return s.push !== false;
};

const q = (v) => encodeURIComponent(String(v));
const inList = (ids) => `in.(${ids.map((x) => `"${String(x).replace(/"/g, '')}"`).join(',')})`;
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const closed = (u) => !u || u.active === false || !!u.blocked || !!u.suspended || !u.email || isDeletedEmail(u.email);

// deps: { db, automation, send(db, opts) (lib/push.js sendPush), quiet, markedTestEmails() → Set,
//         langOf(user) → 'es'|'en'|'pt'|null, testAudience (email prefix, local testing only), limit }
export async function runShareFeaturePush(deps) {
  const { db, automation, send, quiet = false, markedTestEmails = async () => new Set(), langOf = () => null, testAudience = '', limit = 300 } = deps;
  const out = { phones: 0, users: 0, sent: 0, failed: 0, already: 0, excluded: 0, owners: 0, others: 0 };
  const cfg = shareFeatureConfig(automation);
  if (!cfg.exists) return { ...out, skippedReason: 'not_set_up' };
  if (!cfg.enabled) return { ...out, skippedReason: 'disabled' };
  if (!sharePushEnabled(automation)) return { ...out, skippedReason: 'push_off' };
  if (quiet) return { ...out, skippedReason: 'quiet_hours' };

  const tokens = await db.select('push_tokens', 'select=user_id&enabled=eq.true&user_id=not.is.null&limit=20000');
  out.phones = tokens.length;
  const ids = [...new Set(tokens.map((t) => String(t.user_id)))];
  if (!ids.length) return out;

  const [sentRows, marked] = await Promise.all([
    db.select('push_log', `select=user_id&kind=eq.${SHARE_PUSH_KIND}&status=eq.ok&limit=20000`).catch(() => []),
    markedTestEmails().catch(() => new Set()),
  ]);
  const got = new Set(sentRows.map((r) => String(r.user_id)));
  const users = [];
  const owners = new Set();
  for (const part of chunks(ids, 150)) {
    users.push(...await db.select('users', `select=id,email,phone,full_name,active,blocked,suspended,whatsapp_opted_out_at&id=${inList(part)}`));
    for (const p of await db.select('properties', `select=created_by&origin=eq.user&status=eq.published&created_by=${inList(part)}`).catch(() => [])) owners.add(String(p.created_by));
  }
  const audience = String(testAudience || '').trim().toLowerCase();
  for (const u of users) {
    if (audience && !String(u.email || '').toLowerCase().startsWith(audience)) continue;
    const id = String(u.id);
    if (closed(u) || isInternalAccount(u, marked) || u.whatsapp_opted_out_at) { out.excluded++; continue; }
    if (got.has(id)) { out.already++; continue; }
    if (out.sent + out.failed >= limit) break;
    out.users++;
    const own = owners.has(id);
    const m = sharePushMessage(langOf(u), own);
    const r = await send(db, { userIds: [id], title: m.title, body: m.body, channel: 'news', kind: SHARE_PUSH_KIND, data: { url: m.url }, dedupeKey: sharePushKey(id) });
    if (r?.duplicate) { out.already++; continue; }
    if (r?.sent) { out.sent++; own ? out.owners++ : out.others++; } else out.failed++;
  }
  return out;
}

export { SHARE_FEATURE_ID };
