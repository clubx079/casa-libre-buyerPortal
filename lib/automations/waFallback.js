// "WhatsApp first, email if it doesn't arrive." Relay accepts a WhatsApp message at once,
// but Meta can report it undeliverable a few seconds later (e.g. 131026: the number is not
// on WhatsApp — a seller who mistyped their phone). By then sendOnce had already answered
// 'sent', so the person got nothing. Now:
//   - when an automation WhatsApp goes out, what its EMAIL version needs is kept (template
//     id, values, address, dedupe key) under the Relay message id;
//   - the Relay webhook: message.failed → that email is sent once (sendEmailFallback);
//     delivered / read → the entry is dropped.
// Kept in the `automations` row 'wa_fallbacks' (free_tiers[0].pending — no table of its
// own, no DB change; same pattern as 'app_versions'). Entries older than 48 h are dropped.
// Meta does not charge for an undelivered message, so the failed WhatsApp costs nothing.
export const FALLBACK_ID = 'wa_fallbacks';
export const KEEP_HOURS = 48;
const MAX = 500;

const pendingOf = (row) => {
  const s = row && Array.isArray(row.free_tiers) && row.free_tiers[0] && typeof row.free_tiers[0] === 'object' ? row.free_tiers[0] : {};
  return Array.isArray(s.pending) ? s.pending.filter((p) => p && p.relayId) : [];
};
const fresh = (list, now) => list.filter((p) => now - Date.parse(p.at) < KEEP_HOURS * 3600 * 1000);

async function read(db) {
  const [row] = await db.select('automations', `select=id,free_tiers&id=eq.${FALLBACK_ID}&limit=1`).catch(() => []);
  return { exists: !!row, pending: pendingOf(row) };
}

async function write(db, exists, pending) {
  const patch = { enabled: false, free_tiers: [{ pending: pending.slice(-MAX) }], updated_at: new Date().toISOString() };
  if (exists) await db.update('automations', `id=eq.${FALLBACK_ID}`, patch, { returning: 'minimal' });
  else await db.insert('automations', [{ id: FALLBACK_ID, wait_days: 0, ...patch }], { returning: 'minimal' });
}

// entry: { relayId, automationId, runId, dedupeKey (the email's), templateId, vars, to }
export async function keepFallback(db, entry, now = Date.now()) {
  if (!entry?.relayId || !entry.templateId || !entry.to) return false;
  const { exists, pending } = await read(db);
  const next = fresh(pending, now).filter((p) => p.relayId !== entry.relayId);
  next.push({ ...entry, at: new Date(now).toISOString() });
  await write(db, exists, next);
  return true;
}

// The entry for a Relay message, removed from the list (→ null when there is none).
export async function takeFallback(db, relayId, now = Date.now()) {
  const { exists, pending } = await read(db);
  const hit = pending.find((p) => p.relayId === relayId) || null;
  if (!exists || (!hit && pending.length === fresh(pending, now).length)) return hit;
  await write(db, exists, fresh(pending, now).filter((p) => p.relayId !== relayId));
  return hit && now - Date.parse(hit.at) < KEEP_HOURS * 3600 * 1000 ? hit : null;
}
