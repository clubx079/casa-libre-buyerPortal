// IndexNow — instantly notify Bing (and Yandex + other participating engines)
// that a URL was published or updated, so it's crawled in minutes instead of
// days. The key is public (hosted at /<key>.txt); it just proves we own the host.
import 'server-only';
import { COUNTRY } from './country';

// One key for the whole network; overridable per deployment via env. Must match
// the filename served from /public (public/<key>.txt).
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '6af40208a6fc5c5b9327a1ef64247868';

function siteBase() {
  return (process.env.APP_PUBLIC_URL || COUNTRY.defaultUrl).replace(/\/$/, '');
}

// Ping IndexNow with one or more URLs. Best-effort: never throws, never blocks
// the caller's success path. Absolute URLs are used as-is; paths are resolved
// against the active country's site origin.
export async function submitToIndexNow(urls) {
  try {
    const base = siteBase();
    const list = (Array.isArray(urls) ? urls : [urls])
      .filter(Boolean)
      .map((u) => (/^https?:\/\//i.test(u) ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`));
    if (!list.length || !INDEXNOW_KEY) return { ok: false, skipped: true };
    const body = {
      host: new URL(base).host,
      key: INDEXNOW_KEY,
      keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
      urlList: Array.from(new Set(list)).slice(0, 10000),
    };
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
