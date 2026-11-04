// The WhatsApp half of an automation send (lib/automations/sendOnce.js).
// Each automation row says how it sends — channel 'email' | 'whatsapp' | 'both' — and
// which approved Relay template stands in for each of its email templates
// (wa_templates: { "<email template id>": "cl_visitas" }), set on the admin's
// Automations page. Migration 017. Nothing here runs while a row says 'email'.
//
// Who gets it: the user whose email the automation writes to, at their number (E.164),
// only with consent (lib/whatsappTemplates.js waAllowed). Logged in email_log with
// channel 'whatsapp' and dedupe key "<email key>:wa", so a retry never sends twice.
// Env: RELAY_API_KEY (+ RELAY_BASE_URL); WHATSAPP_TEST_TO sends every automation
// WhatsApp to that one number instead (local testing).
import { WA_TEMPLATES, WA_COUNTRIES, WA_LANGUAGE, waVariables, waAllowed, channelOf } from '../whatsappTemplates.js';
import { toE164 } from '../whatsappPhone.js';
import { COUNTRY } from '../country.js';
import { keepFallback } from './waFallback.js';

const isDup = (e) => e?.status === 409 || e?.code === '23505';
const relayKey = () => String(process.env.RELAY_API_KEY || '').trim();
const relayBase = () => String(process.env.RELAY_BASE_URL || 'https://relay.airosofts.com/v1').replace(/\/+$/, '');

// Automation rows, read once per minute (a cron tick sends many emails).
const rows = new Map();
async function automationRow(db, id) {
  const hit = rows.get(id);
  if (hit && Date.now() - hit.at < 60 * 1000) return hit.row;
  // A DB without migration 017 answers "unknown column": remember that too (→ email),
  // so each email doesn't ask again.
  const [row] = await db.select('automations', `select=id,channel,wa_templates&id=eq.${encodeURIComponent(id)}&limit=1`).catch(() => [null]);
  rows.set(id, { at: Date.now(), row: row || null });
  return row || null;
}
// Relay's live template list (name → { category, status }), read every 10 minutes.
// Meta decides the category (it moved several of ours to Marketing); the code map is only
// the fallback. The status tells when a template's _v2 has been approved.
let live = null;
async function liveTemplates() {
  if (!live || Date.now() - live.at > 10 * 60 * 1000) {
    try {
      const r = await fetch(`${relayBase()}/templates?status=all`, { headers: { Authorization: `Bearer ${relayKey()}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const j = await r.json();
      if (r.ok && Array.isArray(j.data)) {
        const map = new Map();
        for (const t of j.data) {
          if (t?.language && t.language !== WA_LANGUAGE) continue;
          map.set(t.name, { category: String(t.category || '').toLowerCase(), status: String(t.status || '').toUpperCase() });
        }
        live = { at: Date.now(), map };
      }
    } catch { /* keep the old list / the fallback */ }
  }
  return live?.map || new Map();
}
const categoryOf = (name, map) => map.get(name)?.category || WA_TEMPLATES[name]?.category || 'marketing';

// The template an automation slot picked (X) is upgraded to X_v2 once Meta APPROVED X_v2 and
// this code knows how to fill it (WA_TEMPLATES). Until then X keeps going out. Pure.
export function preferV2(name, map) {
  const v2 = `${name}_v2`;
  if (!name || String(name).endsWith('_v2') || !WA_TEMPLATES[v2]) return name;
  return map?.get(v2)?.status === 'APPROVED' ? v2 : name;
}
export const _resetWhatsappCache = () => { rows.clear(); live = null; };

// → { channel, waName, noFallback } — channel falls back to 'email' when WhatsApp can't be used
// for this email (no template picked for it, unknown template, other country, no key).
export async function whatsappPlan(db, automationId, tpl) {
  if (!automationId || !tpl?.id) return { channel: 'email', waName: null };
  const row = await automationRow(db, automationId).catch(() => null);
  const channel = channelOf(row);
  if (channel === 'email') return { channel, waName: null };
  const waName = row?.wa_templates?.[tpl.id] || null;
  const usable = waName && WA_TEMPLATES[waName] && WA_COUNTRIES.includes(COUNTRY.code) && relayKey();
  // wa_templates.__no_fallback: "WhatsApp" means WhatsApp only — no email for people it
  // can't reach (admin: untick "send the email instead").
  if (!usable) return { channel: 'email', waName: null };
  const repeat = Number(row?.wa_templates?.__repeat_days);
  return { channel, waName, noFallback: row?.wa_templates?.__no_fallback === true, repeatDays: Number.isInteger(repeat) && repeat > 0 ? repeat : null };
}

// "WhatsApp first, then email": has this automation already sent this person a WhatsApp
// (in the last `repeatDays` days, or ever)? Looked up in email_log (WhatsApp rows: channel
// 'whatsapp'). A failed lookup counts as "yes" → email (never a surprise extra WhatsApp).
export async function sentWhatsAppBefore(db, automationId, to, repeatDays = null, now = Date.now()) {
  const email = String(to || '').trim().toLowerCase();
  if (!email) return true;
  const since = repeatDays ? `&created_at=gte.${encodeURIComponent(new Date(now - repeatDays * 86400000).toISOString())}` : '';
  try {
    const rows = await db.select('email_log', `select=id&automation_id=eq.${encodeURIComponent(automationId)}&channel=eq.whatsapp&status=in.(sending,sent,delivered,read)&to_email=eq.${encodeURIComponent(email)}${since}&limit=1`);
    return rows.length > 0;
  } catch { return true; }
}

async function relayTemplate({ to, template, variables, idempotencyKey, metadata }) {
  const r = await fetch(`${relayBase()}/messages/template`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${relayKey()}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ to, template, language: WA_LANGUAGE, variables, metadata }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: j?.error?.code || `relay_${r.status}` };
  return { ok: true, id: j.id || null };
}

// → 'sent' | 'duplicate' | 'failed' | 'skipped'
// fallback: true → if Meta later reports it undeliverable, the email version is sent
// (lib/automations/waFallback.js, Relay webhook).
export async function sendWhatsAppOnce({ db, automationId, runId = null, dedupeKey, tpl, vars, to, waName: picked, onError, fallback = false }) {
  const map = await liveTemplates();
  // X_v2 when approved; if this email's vars can't fill X_v2 (e.g. no pay_url), X as before.
  let waName = preferV2(picked, map);
  let variables = waVariables(waName, vars);
  if (!variables && waName !== picked) { waName = picked; variables = waVariables(waName, vars); }
  const category = categoryOf(waName, map);
  const testTo = String(process.env.WHATSAPP_TEST_TO || '').trim();
  let user = null;
  if (!testTo) {
    const email = String(to || '').trim().toLowerCase();
    if (!email) return 'skipped';
    [user] = await db.select('users', `select=id,email,phone,phone_verified_at,whatsapp_opt_in_at,whatsapp_opted_out_at&email=eq.${encodeURIComponent(email)}&limit=1`).catch(() => []);
    if (!waAllowed(user, category)) return 'skipped';
  }
  const phone = toE164(testTo || user?.phone, COUNTRY.phonePrefix);
  if (!phone) return 'skipped';
  if (!variables) return 'skipped';

  const key = `${dedupeKey}:wa`;
  let log;
  try {
    [log] = await db.insert('email_log', [{
      automation_id: automationId, run_id: runId, template_id: tpl.id, template_key: waName, channel: 'whatsapp',
      to_email: user?.email || String(to || ''), to_phone: phone, subject: `WhatsApp · ${waName}`, status: 'sending', dedupe_key: key,
    }]);
  } catch (e) {
    if (isDup(e)) return 'duplicate';
    return 'skipped';   // migration 017 missing on this DB → email only
  }
  const res = await relayTemplate({ to: phone, template: waName, variables, idempotencyKey: key, metadata: { automation: String(automationId), log_id: String(log.id) } })
    .catch((e) => ({ ok: false, error: e?.message || 'relay_failed' }));
  if (!res.ok) {
    await db.remove('email_log', `id=eq.${encodeURIComponent(log.id)}`).catch(() => {});
    if (onError) await onError(`whatsapp: ${String(res.error).slice(0, 280)}`);
    return 'failed';
  }
  await db.update('email_log', `id=eq.${encodeURIComponent(log.id)}`, { status: 'sent', relay_message_id: res.id }, { returning: 'minimal' }).catch(() => {});
  if (fallback && res.id && tpl?.id) {
    await keepFallback(db, { relayId: res.id, automationId, runId, dedupeKey, templateId: tpl.id, vars, to: String(to || '') }).catch(() => {});
  }
  return 'sent';
}
