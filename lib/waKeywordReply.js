// Answers the SÍ / CARTERA / PROYECTO / BAJA buttons of the formula campaign templates
// (lib/waKeywords.js), from the Relay webhook (app/api/relay/webhook). The reply goes out inside
// the 24 h window the tap just opened (a free-form message, no template). SÍ / CARTERA / PROYECTO:
// the reply with the tracked link, the chat tagged with the word + marked unread (a person follows
// up), on the batch's recipient row meta.keyword = the word; CARTERA and PROYECTO also email the
// team at once (a person migrates the portfolio / follows up the project). BAJA: Relay already
// opted the contact out; we confirm it, once. Best effort: any failure just leaves the reply to the team.
import 'server-only';
import { select, update } from '@/lib/db';
import { toE164 } from '@/lib/whatsappPhone';
import { COUNTRY } from '@/lib/country';
import { keywordOf, keywordReply, BAJA_REPLY, KEYWORD_TAG, formulaContext, recipientRef, isPlanYes, planReply, planContext } from '@/lib/waKeywords';
import { sendRenderedEmail } from '@/lib/email';

const base = () => String(process.env.RELAY_BASE_URL || 'https://relay.airosofts.com/v1').replace(/\/+$/, '');
const key = () => String(process.env.RELAY_API_KEY || '').trim();
const digits = (p) => String(p || '').replace(/\D/g, '');
const meta = (row) => { try { return JSON.parse(row?.error || '{}') || {}; } catch { return {}; } };

async function relay(path, { method = 'GET', json } = {}) {
  const r = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key()}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

// this number's latest campaign recipient row (the batch it got) → { row, slug } | null
async function campaignRow(e164) {
  const [row] = await select('email_log', `select=id,run_id,error&automation_id=eq.wa_campaign&channel=eq.whatsapp&to_phone=eq.${encodeURIComponent(e164)}&order=created_at.desc&limit=1`).catch(() => []);
  if (!row) return null;
  const [camp] = row.run_id ? await select('email_log', `select=id,error&id=eq.${encodeURIComponent(row.run_id)}&limit=1`).catch(() => []) : [];
  return { row, slug: meta(camp).slug || '' };
}

// The team hears about CARTERA / PROYECTO at once: these need a person (Roland).
const ALERT_TO = () => String(process.env.KEYWORD_ALERT_EMAIL || process.env.SCAN_ALERT_EMAIL || process.env.ADMIN_EMAIL || 'omar@airosofts.com').split(',').map((s) => s.trim()).filter(Boolean);
async function alertTeam(keyword, to, name, template) {
  const what = keyword === 'cartera' ? 'wants to migrate their portfolio (CARTERA)' : 'has a project to publish (PROYECTO)';
  const who = name ? `${name} (${to})` : to;
  const subject = `WhatsApp: ${who} ${what}`;
  const text = `${who} tapped ${KEYWORD_TAG[keyword]} on the campaign template ${template}.\n\nThe automatic reply asked them ${keyword === 'cartera' ? 'how many properties they have and where they list today' : 'the project name, location and number of units'}; their answer lands in the Inbox tagged ${KEYWORD_TAG[keyword]}.\n\nA person should write to them today.`;
  for (const rcpt of ALERT_TO()) await sendRenderedEmail({ to: rcpt, subject, html: `<p>${text.replace(/\n/g, '<br>')}</p>`, text }).catch(() => {});
}

// "Sí, avisame" on cl_plan_agentes_v2 → confirm once + tag 'plan-agentes' (the interest is
// recorded on the chat; the Admin Manager counts it). → 'plan_sent' | 'plan_already' | null
export async function answerPlanInterest(phone, text, name = '') {
  if (!key() || !isPlanYes(text)) return null;
  const num = digits(phone);
  const conv = await relay(`/conversations/${num}/messages?limit=20`);
  if (!conv.ok) return null;
  const ctx = planContext(conv.data?.data || []);
  if (!ctx) return null;
  await relay(`/conversations/${num}`, { method: 'PATCH', json: { add_tags: ['plan-agentes'] } }).catch(() => {});
  if (ctx.answered) return 'plan_already';
  const sent = await relay('/messages/text', { method: 'POST', json: { to: `+${num}`, text: planReply(name), metadata: { source: 'plan_interest', template: ctx.template } } });
  return sent.ok ? 'plan_sent' : null;
}

// → what was done: '<keyword>_sent' | '<keyword>_already' | null (not ours)
export async function answerKeyword(phone, text) {
  const keyword = keywordOf(text);
  if (!key() || !keyword) return null;
  const num = digits(phone);
  const conv = await relay(`/conversations/${num}/messages?limit=30`);
  if (!conv.ok) return null;
  const msgs = conv.data?.data || [];
  const ctx = formulaContext(msgs);
  if (!ctx) return null;   // not a reply to one of the formula templates → the team answers
  const to = `+${num}`;

  const e164 = toE164(phone, COUNTRY.phonePrefix) || to;
  const camp = await campaignRow(e164).catch(() => null);
  const mark = async (keyword) => {   // on the person's row in the batch: replied + which word
    if (!camp?.row) return;
    const m = meta(camp.row);
    if (m.keyword === keyword) return;
    const now = new Date().toISOString();
    await update('email_log', `id=eq.${encodeURIComponent(camp.row.id)}`, { error: JSON.stringify({ ...m, keyword, keyword_at: now, replied_at: m.replied_at || now }) }, { returning: 'minimal' }).catch(() => {});
  };

  if (keyword === 'baja') {
    await mark('baja');
    const t = Date.parse(ctx.sentAt);
    const done = msgs.some((m) => m?.direction === 'outbound' && String(m?.text || '') === BAJA_REPLY && Date.parse(m?.timestamps?.created || 0) >= t);
    if (done) return 'baja_already';
    await relay('/messages/text', { method: 'POST', json: { to, text: BAJA_REPLY, metadata: { source: 'keyword_baja', template: ctx.template } } });
    return 'baja_sent';
  }

  if (ctx.answered.has(keyword)) return `${keyword}_already`;
  // the person's code: their recipient key in the batch (lead:<id> / user:<id>), else the phone
  const ref = recipientRef(meta(camp?.row).key || e164);
  const sent = await relay('/messages/text', { method: 'POST', json: { to, text: keywordReply(keyword, ctx.audience, ref), metadata: { source: `keyword_${keyword}`, template: ctx.template, ref } } });
  if (!sent.ok) return null;
  // the team sees it: the word as a tag + unread (Inbox → Unread)
  await relay(`/conversations/${num}`, { method: 'PATCH', json: { add_tags: [KEYWORD_TAG[keyword], 'cl-unread'] } }).catch(() => {});
  await mark(keyword);
  if (keyword === 'cartera' || keyword === 'proyecto') await alertTeam(keyword, to, null, ctx.template).catch(() => {});
  return `${keyword}_sent`;
}
