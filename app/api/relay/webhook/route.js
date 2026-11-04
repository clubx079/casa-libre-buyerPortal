// POST /api/relay/webhook — events from Relay (relay.airosofts.com → Developers & API →
// Webhooks), signed with HMAC-SHA256 (Relay-Signature: t=…,v1=…; secret
// RELAY_WEBHOOK_SECRET = the endpoint's whsec_…).
//   message.sent / delivered / read / failed → the automation's email_log row (by
//     relay_message_id) moves forward: sent → delivered → read (never backwards;
//     events can arrive late or twice).
//     A failed one that has an email version waiting (lib/automations/waFallback.js) → that
//     email is sent once; delivered / read → the waiting email is dropped.
//   contact.opted_out, or a reply like "No recibir más" / STOP / BAJA → that person's
//     WhatsApp consent is withdrawn (users.whatsapp_opted_out_at) — no more automation
//     WhatsApps (lib/whatsappTemplates.js waAllowed).
//   message.inbound "SÍ" / "CARTERA" / "PROYECTO" / "BAJA" answering a formula campaign template
//     (the quick-reply buttons) → the instant reply with the tracked link + the chat tagged for a
//     person (CARTERA / PROYECTO also email the team); BAJA = the confirmation (lib/waKeywordReply.js).
// Always answers 2xx quickly for events it doesn't use.
import { NextResponse } from 'next/server';
import { select, update } from '@/lib/db';
import { toE164 } from '@/lib/whatsappPhone';
import { COUNTRY } from '@/lib/country';
import { verifyRelaySignature } from '@/lib/relaySignature';
import * as db from '@/lib/db';
import { takeFallback } from '@/lib/automations/waFallback';
import { sendEmailFallback } from '@/lib/automations/sendOnce';
import { templateFrame, sendRenderedEmail } from '@/lib/email';
import { answerKeyword, answerPlanInterest } from '@/lib/waKeywordReply';
import { logReply, keywordOf } from '@/lib/waReplyLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RANK = { sending: 0, sent: 1, delivered: 2, read: 3 };
const OPT_OUT = /^\s*(no recibir m[aá]s|no me interesa|stop|baja|parar|cancelar)\s*[.!]*\s*$/i;

// the accounts with this WhatsApp number. users.phone is free text (spaces, dashes, a leading
// 0): find the rows ending in the same last 3 digits, then keep only the ones that are really it.
async function usersByPhone(e164) {
  if (!e164) return [];
  const rows = await select('users', `select=id,email,phone&phone=like.${encodeURIComponent(`%${e164.slice(-3)}`)}&limit=2000`).catch(() => []);
  return rows.filter((u) => toE164(u.phone, COUNTRY.phonePrefix) === e164);
}
async function optOut(phone) {
  const e164 = toE164(phone, COUNTRY.phonePrefix);
  if (!e164) return 0;
  const ids = (await usersByPhone(e164)).map((u) => u.id);
  for (const id of ids) {
    await update('users', `id=eq.${encodeURIComponent(id)}`, { whatsapp_opted_out_at: new Date().toISOString(), whatsapp_opt_in_at: null }, { returning: 'minimal' }).catch(() => {});
  }
  return ids.length;
}

export async function POST(req) {
  const raw = await req.text();
  if (!verifyRelaySignature(raw, req.headers.get('relay-signature'), process.env.RELAY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }
  let evt;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const type = String(evt?.type || '');
  const d = evt?.data || {};

  if (/^message\.(sent|delivered|read|failed)$/.test(type) && d.id) {
    const status = type.split('.')[1];
    const [row] = await select('email_log', `select=id,status&relay_message_id=eq.${encodeURIComponent(d.id)}&limit=1`).catch(() => []);
    let updated = false;
    if (row) {
      const forward = status === 'failed' ? row.status !== 'read' : (RANK[status] ?? 0) > (RANK[row.status] ?? 0);
      if (forward) {
        // delivered / read need migration 018 (email_log status check); without it the
        // row keeps 'sent' and this says so.
        updated = await update('email_log', `id=eq.${encodeURIComponent(row.id)}`, { status, ...(status === 'failed' ? { error: String(d.error?.code || d.error?.message || 'failed').slice(0, 300) } : {}) }, { returning: 'minimal' })
          .then(() => true).catch(() => false);
      }
    }
    // WhatsApp didn't arrive → the email version; it arrived → nothing more to send.
    let fallback = null;
    if (row && status === 'failed' && updated) {
      const entry = await takeFallback(db, d.id).catch(() => null);
      if (entry) {
        const [tpl] = await select('email_templates', `select=*&id=eq.${encodeURIComponent(entry.templateId)}&limit=1`).catch(() => []);
        fallback = tpl && tpl.is_active !== false
          ? await sendEmailFallback({ db, entry, tpl, frame: templateFrame(), deliver: sendRenderedEmail }).catch(() => 'failed')
          : 'no_template';
      }
    } else if (row && (status === 'delivered' || status === 'read')) {
      await takeFallback(db, d.id).catch(() => null);
    }
    return NextResponse.json({ ok: true, found: !!row, updated, ...(fallback ? { emailFallback: fallback } : {}) });
  }
  if (type === 'contact.opted_out') {
    const ph = toE164(d.phone || d.contact?.phone, COUNTRY.phonePrefix);
    await logReply(db, { phone: ph, users: await usersByPhone(ph), keyword: 'contact_optout', how: 'relay', messageId: evt.id || null });
    return NextResponse.json({ ok: true, optedOut: await optOut(d.phone || d.contact?.phone) });
  }
  if (type === 'message.inbound') {
    const text = String(d.text || d.button?.text || d.interactive?.title || '');
    const keyword = (await answerKeyword(d.from || d.phone, text).catch(() => null)) || (await answerPlanInterest(d.from || d.phone, text, d.contact?.name || d.name || '').catch(() => null));
    // every tap / reply word and every opt-out goes into the person's history (lib/waReplyLog.js)
    const kw = keywordOf(keyword) || (OPT_OUT.test(text) ? 'optout' : null);
    if (kw) {
      const ph = toE164(d.from || d.phone, COUNTRY.phonePrefix);
      await logReply(db, { phone: ph, users: await usersByPhone(ph), keyword: kw, text, how: d.button || d.interactive || String(d.type || '') === 'button' ? 'button' : 'typed', messageId: d.id || null });
    }
    if (OPT_OUT.test(text)) return NextResponse.json({ ok: true, optedOut: await optOut(d.from || d.phone), ...(keyword ? { keyword } : {}) });
    if (keyword) return NextResponse.json({ ok: true, keyword });
  }
  return NextResponse.json({ ok: true, ignored: type });
}
