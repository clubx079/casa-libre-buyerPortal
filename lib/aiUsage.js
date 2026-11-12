// Every AI call the website makes (Groq photo check, Groq listing translation — and any Claude
// call added later) is logged in this site's `ai_usage_log` (app 'website'): tokens in / out,
// cache and the US$ cost (lib/aiPricing.js). The admin's AI usage page adds them up.
//   groqFetch({ feature, ref })   a fetch for Groq's chat completions that logs the call
//   logAiUsage({ provider, model, feature, usage, ok, ref })   log one call yourself
// Fire-and-forget, like lib/scanQuota.js logScans: the response goes back to the caller untouched
// and at once; the token counts are read from a COPY of it in the background. Never throws,
// never waits, and stops trying for 10 minutes while the table doesn't exist (migration
// migrations/021_ai_usage_log.sql not run yet). Server only.
import 'server-only';
import { insert } from './db';
import { usageFromBody, usageRow, requestModel } from './aiUsageCore.js';
import { makeTracker } from './aiUsageTrack.js';

const tracker = makeTracker({ insert: (table, rows) => insert(table, rows, { returning: 'minimal' }) });
export const logAiUsage = tracker.log;
export const trackedFetch = tracker.trackedFetch;
export const groqFetch = ({ feature, ref = null } = {}) => tracker.trackedFetch({ provider: 'groq', feature, ref });
export { usageFromBody, usageRow, requestModel };
