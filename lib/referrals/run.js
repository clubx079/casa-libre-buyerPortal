// Server wiring for the referral program: the real database, promotions, emails and
// links of THIS country site, handed to the pure engine (./engine.js).
//   runReferralsCron()      — from /api/cron/automations (hourly)
//   referralsAfterPublish() — a listing just went live (lib/listingScan.js)
//   recordReferralSignup()  — every sign-in (lib/auth.js setSessionCookie): a NEW account
//                              that arrived through a referral link is attached to the referrer
import 'server-only';
import * as db from '../db';
import { grantPromotion } from '../billing';
import { sendRenderedEmail, templateFrame, siteUrl } from '../email';
import { signRenewToken } from '../promoToken';
import { promoUsd } from '../stripe';
import { COUNTRY } from '../country';
import { inSendWindow } from '../sendWindow';
import { runReferrals, settleReferred } from './engine';
import { REFERRALS_ID, referralConfig, parseRefCookie, isNewForReferral } from './core';
import { codeOwner, attachPerson } from './store';

const formatDate = (s) => { try { return new Date(s).toLocaleDateString(COUNTRY.locale, { day: 'numeric', month: 'long' }); } catch { return String(s).slice(0, 10); } };

export async function referralRow() {
  const [row] = await db.select('automations', `id=eq.${REFERRALS_ID}&limit=1`).catch(() => []);
  return row || null;
}

async function deps(frame) {
  const [automation, templates, paid] = await Promise.all([
    referralRow(),
    db.select('email_templates', 'select=*&key=like.referral-%25').catch(() => []),
    db.select('automations', 'select=milestones&id=eq.paid_listings&limit=1').catch(() => []),
  ]);
  const site = siteUrl();
  const samePersonMin = Number(paid?.[0]?.milestones?.[3]) || 2;   // the paid-listings same-person setting
  return {
    db, automation, templates, now: new Date(),
    grant: (pid, plan, { days, extendFrom }) => grantPromotion(pid, plan, { days, extendFrom }),
    deliver: sendRenderedEmail,
    frame: frame || { ...templateFrame(), quiet: !inSendWindow(new Date(), COUNTRY.code) && process.env.AUTOMATION_SEND_ANYTIME !== '1' },
    siteUrl: site,
    // "Extend" in the ends-soon email: the existing pay-to-extend link (signs the owner in
    // and opens the payment for that plan; it never charges by itself).
    extendUrl: (reward, d) => `${site}/api/promo/extend?token=${encodeURIComponent(signRenewToken({ pid: d.property_id, uid: String(reward.run_id), plan: d.plan_applied || d.plan, purpose: 'extend' }))}`,
    formatDate,
    priceFor: (plan) => `US$${promoUsd(plan)}`,
    emailOverride: process.env.AUTOMATION_EMAIL_OVERRIDE || '',
    phonePrefix: COUNTRY.phonePrefix || '',
    samePersonMin,
  };
}

export async function runReferralsCron({ frame } = {}) {
  return runReferrals(await deps(frame));
}

export async function referralsAfterPublish(userId) {
  if (!userId) return null;
  return settleReferred(await deps(), userId);
}

// method: how they signed in ('email' | 'google' | 'apple' | 'whatsapp' | …)
export async function recordReferralSignup(user, rawCookie, { now = Date.now() } = {}) {
  if (!user?.id || !rawCookie) return { skipped: 'no_cookie' };
  const cfg = referralConfig(await referralRow());
  if (!cfg.enabled) return { skipped: 'off' };
  const ref = parseRefCookie(rawCookie, now, cfg.attributionDays);
  if (!ref) return { skipped: 'expired' };
  if (!isNewForReferral(user, ref.clickedAt, now)) return { skipped: 'not_new' };
  const owner = await codeOwner(db, ref.code);
  if (!owner || owner.userId === String(user.id)) return { skipped: 'own_link' };
  const row = await attachPerson(db, { referrerId: owner.userId, user, code: ref.code, clickedAt: ref.clickedAt, method: user.auth_provider || 'email', now: new Date(now) });
  return row ? { attached: true } : { skipped: 'already_referred' };
}
