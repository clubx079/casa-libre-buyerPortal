// The AI usage logger without the database wiring (lib/aiUsage.js plugs in lib/db insert), so it
// can be tested with a stand-in. tests/aiUsage.test.mjs.
import { usageFromBody, usageRow, requestModel } from './aiUsageCore.js';

export const TABLE = 'ai_usage_log';
export const isMissingTable = (e) => ['42P01', 'PGRST205', 'PGRST204'].includes(e?.code) || /does not exist|schema cache|Could not find the table/i.test(String(e?.message || ''));

export function makeTracker({ insert, app = 'website', pauseMs = 10 * 60 * 1000 }) {
  let pausedUntil = 0;
  function log({ provider, model, feature, usage, ok = true, ref = null }) {
    if (pausedUntil > Date.now()) return;
    let row;
    try { row = usageRow({ app, provider, model, feature, usage, ok, ref }); } catch { return; }
    Promise.resolve().then(() => insert(TABLE, [row])).catch((e) => { if (isMissingTable(e)) pausedUntil = Date.now() + pauseMs; });
  }
  function trackedFetch(meta = {}, baseFetch = globalThis.fetch) {
    return async (input, init) => {
      const asked = requestModel(init?.body);
      let res;
      try { res = await baseFetch(input, init); } catch (e) { log({ ...meta, model: asked, usage: {}, ok: false }); throw e; }
      try {
        res.clone().text().then((text) => {
          const got = res.ok ? usageFromBody(meta.provider, text) : null;
          log({ ...meta, model: got?.model || asked, usage: got?.usage || {}, ok: res.ok && !!got });
        }).catch(() => {});
      } catch { /* never in the way */ }
      return res;
    };
  }
  return { log, trackedFetch };
}
