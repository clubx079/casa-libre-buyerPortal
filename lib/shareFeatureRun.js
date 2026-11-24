// Server wiring for the "New: share your listing" announcement (lib/automations/shareFeature.js):
// the real database, email sender and links of THIS country site. From /api/cron/automations.
import 'server-only';
import * as db from './db';
import { sendRenderedEmail, templateFrame, siteUrl } from './email';
import { COUNTRY } from './country';
import { inSendWindow } from './sendWindow';
import { SHARE_FEATURE_ID } from './shareFeature';
import { readMarkedTestEmails } from './internalAccounts';
import { resendStatus } from './referrals/run';
import { runShareFeature } from './automations/shareFeature';

export async function runShareFeatureCron({ frame } = {}) {
  const [row] = await db.select('automations', `id=eq.${SHARE_FEATURE_ID}&limit=1`).catch(() => []);
  if (!row) return { skippedReason: 'not_set_up' };
  const templates = row.template_id
    ? await db.select('email_templates', `select=*&id=eq.${encodeURIComponent(row.template_id)}&limit=1`).catch(() => [])
    : [];
  return runShareFeature({
    db, automation: row, templates, now: new Date(),
    deliver: sendRenderedEmail,
    frame: frame || { ...templateFrame(), quiet: !inSendWindow(new Date(), COUNTRY.code) && process.env.AUTOMATION_SEND_ANYTIME !== '1' },
    siteUrl: siteUrl(),
    emailOverride: process.env.AUTOMATION_EMAIL_OVERRIDE || '',
    emailStatus: resendStatus,
    markedTestEmails: () => readMarkedTestEmails(db),
    // LOCAL TESTING ONLY: an email prefix — only those accounts are considered.
    testAudience: String(process.env.SHARE_FEATURE_TEST_AUDIENCE || '').trim(),
    pauseMs: 550,                                   // Resend: ~2 requests/second
  });
}
