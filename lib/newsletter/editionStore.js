// All newsletter editions for THIS country: the stored weekly ones (newsletter_editions,
// status 'published' — written by the admin, migration 026) merged with the hand-made ones
// (lib/newsletter/editions.js), newest first. Cached 5 minutes per process; without the table
// or the DB (e.g. the Docker build) it is just the hand-made editions. Server only.
import 'server-only';
import * as db from '../db';
import { mergeEditions, EDITIONS } from './editions';

const TTL = 5 * 60 * 1000;
const cache = (globalThis.__clNewsletterEditions ||= { at: 0, value: null });

export async function storedEditionRows() {
  return db.select('newsletter_editions', 'select=id,week,date,status,issues,stories&status=eq.published&order=date.desc&limit=520');
}

export async function allEditions({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < TTL) return cache.value;
  let rows;
  // table not there yet / DB blip: the last good list, else the hand-made editions (not cached)
  try { rows = await storedEditionRows(); } catch { return cache.value || mergeEditions([], EDITIONS); }
  const value = mergeEditions(rows, EDITIONS);
  cache.at = Date.now();
  cache.value = value;
  return value;
}
