// "Account deleted" automation — the moment someone deletes their account (app or
// website, POST /api/account/delete) they get a kind goodbye email with a button to tell
// us why (/feedback). The address is read BEFORE the account is erased; the email_log row
// is then anonymized like the rest of their history (lib/accountDeletion.js), so we keep
// "a goodbye was sent" without keeping who it was.
// The email can be edited in admin → Templates once a template with key 'account-deleted'
// exists; until then the default below is used. Turned off by an `automations` row
// 'account_deleted' with enabled = false (no row = on). Pure except the db / deliver passed in.
import { sendOnce } from './sendOnce.js';
import { deletedEmailFor } from '../accountDeletion.js';

export const ACCOUNT_DELETED_ID = 'account_deleted';
export const ACCOUNT_DELETED_KEY = 'account-deleted';

export const DEFAULT_TEMPLATE = {
  key: ACCOUNT_DELETED_KEY,
  name: 'Cuenta eliminada — despedida',
  subject: 'Lamentamos que te vayas, {{name}}',
  heading: 'Tu cuenta de Casa Libre fue eliminada',
  body: [
    'Hola {{name}},',
    'Te confirmamos que eliminamos tu cuenta y tus datos personales, como pediste.',
    'Gracias por haber sido parte de Casa Libre: fue un gusto ayudarte a buscar tu lugar.',
    '**¿Nos contás por qué te vas?** Nos lleva un minuto y nos ayuda mucho a mejorar para todos.',
    'Si algún día querés volver, acá vamos a estar.\n\nEl equipo de Casa Libre',
  ].join('\n\n'),
  button_label: 'Contanos por qué',
  button_url: '{{feedback_url}}',
  is_active: true,
};

// → 'sent' | 'duplicate' | 'failed' | 'off' | 'no_email'
export async function sendAccountDeleted({ db, uid, email, name, deliver, frame = {}, siteUrl = '' }) {
  if (!uid || !email) return 'no_email';
  const [row] = await db.select('automations', `select=id,enabled&id=eq.${ACCOUNT_DELETED_ID}&limit=1`).catch(() => []);
  if (row && row.enabled === false) return 'off';
  const [custom] = await db.select('email_templates', `select=*&key=eq.${ACCOUNT_DELETED_KEY}&limit=1`).catch(() => []);
  const tpl = custom && custom.is_active !== false ? custom : DEFAULT_TEMPLATE;
  const first = String(name || '').trim().split(/\s+/)[0] || 'hola';
  const dedupeKey = `${ACCOUNT_DELETED_ID}:${uid}`;
  const res = await sendOnce({
    db, automationId: ACCOUNT_DELETED_ID, dedupeKey, tpl, to: email, frame, deliver,
    vars: { name: first, feedback_url: `${siteUrl}/feedback?origen=cuenta-eliminada` },
  }).catch(() => 'failed');
  // their address doesn't stay in our log (the account is gone)
  await db.update('email_log', `dedupe_key=eq.${encodeURIComponent(dedupeKey)}`, { to_email: deletedEmailFor(uid) }, { returning: 'minimal' }).catch(() => {});
  return res;
}
