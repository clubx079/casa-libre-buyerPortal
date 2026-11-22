// "Share your listing" — the pure rules for the reward and the nudge emails
// (tests/shareReward.test.mjs). Shared word-for-word with the admin portal.
//
// Settings live in the country DB's `automations` table (no table of their own):
//   share_reward  enabled (OFF by default) · free_tiers[0] = { visits, reward, days, perListingOnce }
//                 → when the listing's share links bring `visits` UNIQUE people, the listing
//                   gets `reward` ('verified' | 'home') for `days` days, once per listing
//                   (perListingOnce: false → again each further `visits` people)
//   share_nudge   enabled · channel 'email' · milestones = hours after publishing ([24, 168])
//                 → 'share-nudge-published' (template_id); free_tiers[0].lowViews =
//                   { enabled, threshold, afterHours } → 'share-nudge-lowviews'
//                   (reminder_template_id) once, when the listing is that old and still has
//                   fewer views than threshold and nobody came through a share link
// Records: email_log rows (automation_id 'share_reward', channel 'event', dedupe key ending
// ':ev', like the referral records), so each reward is given exactly once.
export const SHARE_REWARD_ID = 'share_reward';
export const SHARE_NUDGE_ID = 'share_nudge';
export const TEMPLATE_KEYS = Object.freeze({
  published: 'share-nudge-published',
  lowViews: 'share-nudge-lowviews',
  reward: 'share-reward-earned',
});
export const HOUR = 3600000;
export const DAY = 86400000;
export const REWARD_DEFAULTS = Object.freeze({ visits: 20, reward: 'verified', days: 3, perListingOnce: true });
export const NUDGE_DEFAULTS = Object.freeze({ steps: [24, 168], graceHours: 48, lowViews: { afterHours: 72, maxViews: 20 } });

const int = (v, min, max, d) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : d; };
const settingsOf = (row) => (Array.isArray(row?.free_tiers) ? row.free_tiers[0] : row?.free_tiers) || {};

// automations row 'share_reward' → settings, gaps filled from REWARD_DEFAULTS.
export function shareRewardConfig(row) {
  const s = settingsOf(row);
  return {
    exists: !!row,
    enabled: row?.enabled === true,
    enabledAt: row?.enabled_at || null,
    visits: int(s.visits, 1, 100000, REWARD_DEFAULTS.visits),
    reward: ['verified', 'home'].includes(s.reward) ? s.reward : REWARD_DEFAULTS.reward,
    days: int(s.days, 1, 365, REWARD_DEFAULTS.days),
    perListingOnce: typeof s.perListingOnce === 'boolean' ? s.perListingOnce : REWARD_DEFAULTS.perListingOnce,
  };
}

// automations row 'share_nudge' → settings.
export function shareNudgeConfig(row) {
  const s = settingsOf(row);
  const steps = [...new Set((Array.isArray(row?.milestones) ? row.milestones : NUDGE_DEFAULTS.steps).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 24 * 90))].sort((a, b) => a - b);
  // the admin writes { enabled, threshold, afterHours }; maxViews is the older name of threshold
  const raw = s.lowViews || {};
  const lv = s.lowViews === false || raw.enabled === false ? null : { ...NUDGE_DEFAULTS.lowViews, ...raw, maxViews: raw.threshold ?? raw.maxViews ?? NUDGE_DEFAULTS.lowViews.maxViews };
  return {
    exists: !!row,
    enabled: row?.enabled === true,
    enabledAt: row?.enabled_at || null,
    steps: steps.length ? steps.slice(0, 6) : [...NUDGE_DEFAULTS.steps],
    graceHours: int(s.graceHours, 1, 24 * 30, NUDGE_DEFAULTS.graceHours),
    lowViews: lv ? { afterHours: int(lv.afterHours, 1, 24 * 90, NUDGE_DEFAULTS.lowViews.afterHours), maxViews: int(lv.maxViews, 1, 100000, NUDGE_DEFAULTS.lowViews.maxViews) } : null,
  };
}

// Which reward step a listing has earned with `visits` unique people → 0 (none) | 1 | 2 …
// perListingOnce → at most 1.
export function rewardStep(visits, cfg) {
  const n = Math.floor(Number(visits || 0) / cfg.visits);
  return cfg.perListingOnce ? Math.min(n, 1) : n;
}

// Should this listing get a reward now? → { step } | null
//   given: the steps already recorded for it (Set or array of numbers)
export function rewardDecision({ visits, cfg, given = [], live = true }) {
  if (!cfg?.enabled || !live) return null;
  const step = rewardStep(visits, cfg);
  if (!step) return null;
  const done = new Set([...given].map(Number));
  return done.has(step) ? null : { step };
}

// The nudge step (hours after publishing) due now, or null: the latest step reached, only
// while it is fresh (within graceHours — a step missed long ago is not sent late) and not sent.
export function nudgeStepDue(publishedAtIso, steps, nowMs, sent = [], graceHours = NUDGE_DEFAULTS.graceHours) {
  const t = Date.parse(publishedAtIso);
  if (!Number.isFinite(t)) return null;
  const reached = steps.filter((h) => nowMs >= t + h * HOUR);
  if (!reached.length) return null;
  const step = Math.max(...reached);
  if (nowMs > t + (step + graceHours) * HOUR) return null;
  return [...sent].map(Number).includes(step) ? null : step;
}

// The "low views" nudge: old enough, few views, nobody through a share link yet.
export function lowViewsDue({ publishedAtIso, nowMs, views, shareVisits = 0, lowViews }) {
  if (!lowViews) return false;
  const t = Date.parse(publishedAtIso);
  if (!Number.isFinite(t) || nowMs < t + lowViews.afterHours * HOUR) return false;
  return Number(views || 0) < lowViews.maxViews && Number(shareVisits || 0) === 0;
}

// The line shown to the owner on the share sheet / app when the reward is on.
export function rewardText(cfg) {
  if (!cfg?.enabled) return { active: false };
  const plan = {
    es: cfg.reward === 'home' ? 'Verificada y en la portada' : 'Verificada',
    en: cfg.reward === 'home' ? 'Verified and on the home page' : 'Verified',
    pt: cfg.reward === 'home' ? 'Verificado e na página inicial' : 'Verificado',
  };
  const d = (es, en, pt) => ({ es: cfg.days === 1 ? es[0] : es[1], en: cfg.days === 1 ? en[0] : en[1], pt: cfg.days === 1 ? pt[0] : pt[1] });
  const days = d(['día', 'días'], ['day', 'days'], ['dia', 'dias']);
  return {
    active: true,
    visits: cfg.visits, days: cfg.days, plan: cfg.reward,
    es: `Si tu link trae ${cfg.visits} visitas, ganás ${cfg.days} ${days.es} de ${plan.es} gratis.`,
    en: `If your link brings ${cfg.visits} visits, you get ${cfg.days} ${days.en} ${plan.en} for free.`,
    pt: `Se o seu link trouxer ${cfg.visits} visitas, você ganha ${cfg.days} ${days.pt} de ${plan.pt} grátis.`,
  };
}
