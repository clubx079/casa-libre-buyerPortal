// GET /api/account/referrals — the signed-in user's Referrals page (/cuenta/referidos):
// their link, the share message, what they've earned and the people who used their link.
// People are shown privately: first name + last initial and a status, never an email or
// phone (lib/referrals/core.js maskName).
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/users';
import { SITE } from '@/lib/site';
import { COUNTRY } from '@/lib/country';
import { referralConfig, referralUrl, maskName, dataOf, isLive, summarize } from '@/lib/referrals/core';
import { ensureCode, personsOf, rewardsOf, clickCount } from '@/lib/referrals/store';
import { referralRow } from '@/lib/referrals/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inList = (ids) => `in.(${ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')})`;
const fill = (text, vars) => String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? ''));

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let cfg;
  try { cfg = referralConfig(await referralRow()); } catch { cfg = referralConfig(null); }
  if (!cfg.enabled) return NextResponse.json({ enabled: false });

  const user = await getUserById(session.uid).catch(() => null);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const own = await db.select('properties', `select=id,status,admin_status,is_complete,is_delisted,property_type,neighborhood,city&created_by=eq.${encodeURIComponent(user.id)}&origin=eq.user&limit=200`).catch(() => []);
  let blocked = null;
  if (!user.verified || user.active === false || user.blocked || user.suspended) blocked = 'not_verified';
  else if (cfg.requireReferrerListing && !own.some(isLive)) blocked = 'need_listing';

  const program = {
    referrerDays: cfg.referrer.enabled ? cfg.referrer.days : 0, referrerPlan: cfg.referrer.plan,
    newUserDays: cfg.newUser.enabled ? cfg.newUser.days : 0, newUserPlan: cfg.newUser.plan,
    milestoneEvery: cfg.milestone.enabled ? cfg.milestone.every : 0, milestoneDays: cfg.milestone.days, milestonePlan: cfg.milestone.plan, milestoneRepeat: cfg.milestone.repeat,
  };
  if (blocked) return NextResponse.json({ enabled: true, blocked, program });

  const code = await ensureCode(db, user);
  const url = referralUrl(SITE, code);
  const [persons, rewards, clicks] = await Promise.all([
    personsOf(db, user.id).catch(() => []),
    rewardsOf(db, user.id).catch(() => []),
    clickCount(db, code).catch(() => 0),
  ]);
  const propIds = [...new Set(rewards.map((r) => dataOf(r).property_id).filter(Boolean))];
  const props = propIds.length ? await db.select('properties', `select=id,property_type,neighborhood,city&id=${inList(propIds)}`).catch(() => []) : [];
  const title = new Map(props.map((p) => [String(p.id), [p.property_type, p.neighborhood || p.city].filter(Boolean).join(' · ')]));

  return NextResponse.json({
    enabled: true,
    code,
    url,
    shareText: fill(cfg.shareText, { link: url, country: COUNTRY.name, new_user_days: String(cfg.newUser.days), reward_days: String(cfg.referrer.days) }),
    program,
    stats: summarize({ persons, rewards, clicks }),
    persons: persons.map((p) => {
      const d = dataOf(p);
      return { id: p.id, name: maskName(d.referred_name, p.to_email), status: p.subject, hold: d.hold || null, reason: p.subject === 'rejected' ? d.reason || null : null, joinedAt: d.signed_up_at || p.created_at, qualifiedAt: d.qualified_at || null };
    }),
    rewards: rewards.map((r) => {
      const d = dataOf(r);
      return { id: r.id, type: d.type, plan: d.plan_applied || d.plan, days: d.days, state: r.subject, until: d.until || null, wait: d.wait || null, propertyId: d.property_id || null, property: d.property_id ? title.get(String(d.property_id)) || null : null, from: d.referred_name || null };
    }),
  });
}
