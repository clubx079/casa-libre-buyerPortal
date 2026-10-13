// The admin's "Mobile app updates" row (automations 'app_versions') for this country's
// DB, cached 60 s so the app's startup call stays cheap. Any error → null, and the
// policy falls back to the env vars (lib/appVersionPolicy.js) — the app never breaks
// because of this lookup.
import 'server-only';
import { select } from './db';
import { APP_VERSIONS_ID } from './appVersionPolicy';

const TTL = 60 * 1000;
let cache = { at: 0, row: null };

export async function loadAppVersionSettings(now = Date.now()) {
  if (now - cache.at < TTL) return cache.row;
  let row = null;
  try {
    const rows = await select('automations', `select=id,enabled,free_tiers,updated_at&id=eq.${APP_VERSIONS_ID}&limit=1`);
    row = rows[0] || null;
  } catch { row = cache.row; }   // DB hiccup: keep the last good answer (or env)
  cache = { at: now, row };
  return row;
}
