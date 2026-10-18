// Send one templated message EXACTLY once, shared by every automation.
// Claims `dedupeKey` in email_log (unique) BEFORE sending, so a retry, crash or
// overlapping cron tick can never send it twice. A failed send frees the claim so
// the next tick retries it.
// By email, by WhatsApp or both — the automation row's channel (admin → Automations,
// migration 017; lib/automations/whatsappSend.js). 'whatsapp' falls back to email when
// the person can't get it on WhatsApp (no number, no consent, a value missing).
//   → 'sent' | 'duplicate' | 'failed' | 'no_template' | 'no_email'
import { renderTemplate } from '../emailTemplateRender.js';
import { whatsappPlan, sendWhatsAppOnce } from './whatsappSend.js';

const isDup = (e) => e?.status === 409 || e?.code === '23505';
const done = (r) => r === 'sent' || r === 'duplicate';

export async function sendOnce(args) {
  const { db, automationId, tpl, to } = args;
  if (!tpl || tpl.is_active === false) return 'no_template';
  if (!to) return 'no_email';
  const plan = await whatsappPlan(db, automationId, tpl).catch(() => ({ channel: 'email' }));
  if (plan.channel === 'email') return sendEmailOnce(args);

  const wa = await sendWhatsAppOnce({ ...args, waName: plan.waName }).catch(() => 'failed');
  if (plan.channel === 'whatsapp' && done(wa)) return wa;
  const email = await sendEmailOnce(args);   // 'both', or WhatsApp couldn't reach them
  return wa === 'sent' || email === 'sent' ? 'sent' : email;
}

async function sendEmailOnce({ db, automationId, runId = null, dedupeKey, tpl, vars, to, frame, deliver, onError }) {
  const msg = renderTemplate(tpl, vars, frame);
  let log;
  try {
    [log] = await db.insert('email_log', [{ automation_id: automationId, run_id: runId, template_id: tpl.id, template_key: tpl.key || null, to_email: to, subject: msg.subject, status: 'sending', dedupe_key: dedupeKey }]);
  } catch (e) {
    if (isDup(e)) return 'duplicate';
    throw e;
  }
  const res = await deliver({ to, subject: msg.subject, html: msg.html, text: msg.text }).catch((e) => ({ ok: false, error: e?.message || 'send_failed' }));
  if (!res?.ok) {
    await db.remove('email_log', `id=eq.${encodeURIComponent(log.id)}`);
    if (onError) await onError(String(res?.error || 'send_failed').slice(0, 300));
    return 'failed';
  }
  await db.update('email_log', `id=eq.${encodeURIComponent(log.id)}`, { status: 'sent', resend_id: res.id || null }, { returning: 'minimal' });
  return 'sent';
}
