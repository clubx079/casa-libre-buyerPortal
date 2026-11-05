// Single-IP block (Nov 6 2026): the admin's security watch (admin lib/securityWatch.js) puts a
// suspicious IP — one machine firing hundreds of events a day — on the blocked list in this
// country's DB (automations row 'security_watch', free_tiers[0].blocked_ips: { ip, until,
// unblocked? }). The middleware turns those IPs away with the same 403 page as the region block.
// The list is read at most once a minute per server (cached); if the DB can't be reached the
// last list is kept and nobody new is blocked. Edge-safe; the pure parts are tested in
// tests/ipBlock.test.mjs.
const TTL_MS = 60 * 1000;
let cache = { at: 0, set: new Set(), loading: null };

// free_tiers (the row's JSON) → the IPs blocked right now
export function activeBlockedIps(freeTiers, now = Date.now()) {
  const s = Array.isArray(freeTiers) && freeTiers[0] && typeof freeTiers[0] === 'object' ? freeTiers[0] : {};
  const list = Array.isArray(s.blocked_ips) ? s.blocked_ips : [];
  return new Set(list.filter((b) => b && b.ip && !b.unblocked && Date.parse(b.until || 0) > now).map((b) => String(b.ip).trim()));
}

// the visitor's IP (Cloudflare first)
export const clientIp = (headers) => String(headers.get('cf-connecting-ip') || (headers.get('x-forwarded-for') || '').split(',')[0] || '').trim();

async function load(url, key) {
  const r = await fetch(`${url}/rest/v1/automations?select=free_tiers&id=eq.security_watch&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(1500),
  });
  if (!r.ok) throw new Error(`blocked ips ${r.status}`);
  const [row] = await r.json();
  return activeBlockedIps(row?.free_tiers);
}

export async function blockedIps({ url = process.env.AIROBASE_URL, key = process.env.AIROBASE_SECRET_KEY, now = Date.now() } = {}) {
  if (!url || !key) return cache.set;
  if (now - cache.at < TTL_MS) return cache.set;
  if (!cache.loading) {
    cache.loading = load(url, key)
      .then((set) => { cache = { at: Date.now(), set, loading: null }; return set; })
      .catch(() => { cache = { ...cache, at: Date.now(), loading: null }; return cache.set; });   // keep the last list, try again in a minute
  }
  return cache.loading;
}
