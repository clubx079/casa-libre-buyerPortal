// Alert email when the daily AI photo-check limit (lib/scanQuota.js, default 5,000
// photos a day per country site) is reached: new listings then wait in the queue
// ("Checking photos…") until local midnight. Sent ONCE per country per local day —
// email_log dedupe key scan-quota:<country>:<local date> is claimed before sending, so
// parallel publishes or retries never send twice. Recipient: SCAN_ALERT_EMAIL (comma-
// separated), else ADMIN_EMAIL, else omar@airosofts.com. Never throws.
// Pure + dependency-injected (tests/scanAlert.test.mjs).
import { TZ } from './scanQuota.js';

export const SCAN_ALERT_ID = 'image_scan_quota';

export const alertRecipients = (env = process.env) =>
  String(env.SCAN_ALERT_EMAIL || env.ADMIN_EMAIL || 'omar@airosofts.com')
    .split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'));

// The country's local calendar date, e.g. '2026-10-16'.
export const localDate = (countryCode = 'py', now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ[countryCode] || TZ.py, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const alertKey = (countryCode, now = new Date()) => `scan-quota:${countryCode}:${localDate(countryCode, now)}`;

const isDup = (e) => e?.status === 409 || e?.code === '23505' || /duplicate|unique/i.test(String(e?.message || ''));

// deps: { db: { select, insert, update, remove }, send: async ({ to, used, quota, queued, ... }) => { ok, id? },
//         countryCode, countryName, used, quota, now, env }
export async function maybeSendQuotaAlert(deps) {
  const { db, send, countryCode = 'py', countryName = '', used = 0, quota = 0, now = new Date(), env = process.env } = deps;
  try {
    const to = alertRecipients(env);
    if (!to.length) return 'no_recipient';
    const key = alertKey(countryCode, now);
    let log;
    try {
      [log] = await db.insert('email_log', [{ automation_id: SCAN_ALERT_ID, to_email: to.join(','), subject: 'scan quota reached', status: 'sending', dedupe_key: key }]);
    } catch (e) {
      return isDup(e) ? 'already_sent' : 'log_failed';
    }
    let queued = null;
    try {
      const rows = await db.select('properties', 'select=id&status=eq.scanning&limit=1000');
      queued = rows.length;
    } catch { /* optional */ }
    const res = await send({ to, countryCode, countryName, used, quota, queued, date: localDate(countryCode, now) });
    if (!res?.ok) {
      try { await db.remove('email_log', `id=eq.${encodeURIComponent(log.id)}`); } catch {}
      return 'failed';
    }
    try { await db.update('email_log', `id=eq.${encodeURIComponent(log.id)}`, { status: 'sent', subject: res.subject || 'scan quota reached', resend_id: res.id || null }, { returning: 'minimal' }); } catch {}
    return 'sent';
  } catch {
    return 'failed';
  }
}
