// Send one templated email EXACTLY once, shared by every automation.
// Claims `dedupeKey` in email_log (unique) BEFORE sending, so a retry, crash or
// overlapping cron tick can never send it twice. A failed send frees the claim so
// the next tick retries it.
//   → 'sent' | 'duplicate' | 'failed' | 'no_template' | 'no_email'
import { renderTemplate } from '../emailTemplateRender.js';

const isDup = (e) => e?.status === 409 || e?.code === '23505';

export async function sendOnce({ db, automationId, runId = null, dedupeKey, tpl, vars, to, frame, deliver, onError }) {
  if (!tpl || tpl.is_active === false) return 'no_template';
  if (!to) return 'no_email';
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
