// Answers the SÍ / BAJA buttons of the formula campaign templates (lib/waKeywords.js), from the
// Relay webhook (app/api/relay/webhook). The reply goes out inside the 24 h window the tap just
// opened (a free-form message, no template). SÍ: the /publicar link with UTM tags, the chat
// tagged "SÍ" + marked unread (a person follows up), and on the batch's recipient row
// meta.keyword = 'si'. BAJA: Relay already opted the contact out; we confirm it, once.
// Best effort: any failure just leaves the reply to the team.
import 'server-only';
import { select, update } from '@/lib/db';
import { toE164 } from '@/lib/whatsappPhone';
import { COUNTRY } from '@/lib/country';
import { isYes, isBaja, yesReply, BAJA_REPLY, formulaContext } from '@/lib/waKeywords';

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

// → what was done: 'yes_sent' | 'yes_already' | 'baja_sent' | 'baja_already' | null (not ours)
export async function answerKeyword(phone, text) {
  if (!key() || !(isYes(text) || isBaja(text))) return null;
  const num = digits(phone);
  const conv = await relay(`/conversations/${num}/messages?limit=30`);
  if (!conv.ok) return null;
  const msgs = conv.data?.data || [];
  const ctx = formulaContext(msgs);
  if (!ctx) return null;   // not a reply to one of the formula templates → the team answers
  const to = `+${num}`;

  if (isBaja(text)) {
    const t = Date.parse(ctx.sentAt);
    const done = msgs.some((m) => m?.direction === 'outbound' && String(m?.text || '') === BAJA_REPLY && Date.parse(m?.timestamps?.created || 0) >= t);
    if (done) return 'baja_already';
    await relay('/messages/text', { method: 'POST', json: { to, text: BAJA_REPLY, metadata: { source: 'keyword_baja', template: ctx.template } } });
    return 'baja_sent';
  }

  if (ctx.alreadyAnswered) return 'yes_already';
  const e164 = toE164(phone, COUNTRY.phonePrefix) || to;
  const camp = await campaignRow(e164).catch(() => null);
  const sent = await relay('/messages/text', { method: 'POST', json: { to, text: yesReply(ctx.audience, { batch: camp?.slug }), metadata: { source: 'keyword_si', template: ctx.template } } });
  if (!sent.ok) return null;
  // the team sees it: tag "SÍ" + unread (Inbox → Unread)
  await relay(`/conversations/${num}`, { method: 'PATCH', json: { add_tags: ['SÍ', 'cl-unread'] } }).catch(() => {});
  if (camp?.row) {
    const m = meta(camp.row);
    if (!m.keyword) await update('email_log', `id=eq.${encodeURIComponent(camp.row.id)}`, { error: JSON.stringify({ ...m, keyword: 'si', keyword_at: new Date().toISOString(), replied_at: m.replied_at || new Date().toISOString() }) }, { returning: 'minimal' }).catch(() => {});
  }
  return 'yes_sent';
}
