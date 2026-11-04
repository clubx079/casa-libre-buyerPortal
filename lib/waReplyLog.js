// Every button tap / reply word and every opt-out on WhatsApp → one row in the person's history
// (email_log, automation 'wa_reply', channel 'event' — never counted as a message we sent).
// The admin shows it on the person's timeline and the Inbox assistant / Open issues read it:
//   template_key  si | baja | cartera | proyecto | plan | optout | contact_optout
//   subject       "Tapped SÍ" / "Opted out: replied BAJA" / … (English, for the team)
//   error (JSON)  { keyword, text, how, message_id }
// Pure parts tested in tests/waReplyLog.test.mjs.
export const REPLY_ID = 'wa_reply';
const LABEL = {
  si: 'Tapped SÍ',
  cartera: 'Tapped CARTERA (has a portfolio)',
  proyecto: 'Tapped PROYECTO (has a project)',
  baja: 'Opted out: replied BAJA',
  plan: 'Said yes to the agents plan',
  optout: 'Opted out: asked to stop the messages',
  contact_optout: 'Opted out: turned off / blocked our WhatsApp',
};
export const replyLabel = (k, text = '') => (k === 'optout' && text ? `Opted out: replied “${String(text).trim().slice(0, 40)}”` : LABEL[k] || `Replied ${String(k).toUpperCase()}`);

// answerKeyword / answerPlanInterest result ('si_sent', 'baja_already', 'plan_sent' …) → keyword
export function keywordOf(result) {
  const k = String(result || '').split('_')[0].toLowerCase();
  return ['si', 'baja', 'cartera', 'proyecto', 'plan'].includes(k) ? k : null;
}

// → the email_log row
export function replyRow({ phone, email = null, keyword, text = '', how = 'button', messageId = null, now = new Date() }) {
  const minute = now.toISOString().slice(0, 16);
  return {
    automation_id: REPLY_ID,
    channel: 'event',
    status: 'sent',
    to_phone: phone,
    to_email: email,
    template_key: keyword,
    subject: replyLabel(keyword, text),
    error: JSON.stringify({ keyword, text: String(text || '').slice(0, 200), how, message_id: messageId || null }),
    dedupe_key: `wa_reply:${messageId || `${phone}:${keyword}:${minute}`}`,
  };
}

// Writes it (best effort: a failed write never breaks the webhook). users = the accounts with this number.
export async function logReply(db, { phone, users = [], keyword, text, how, messageId }) {
  if (!phone || !keyword) return false;
  const email = users.find((u) => u?.email)?.email || null;
  return db.insert('email_log', [replyRow({ phone, email, keyword, text, how, messageId })], { returning: 'minimal' }).then(() => true).catch(() => false);
}
