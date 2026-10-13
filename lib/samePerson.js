// "Same person, different email": the free-listings quota is per PERSON, not per email.
// Each listing keeps three signals of where it was published from (raw_data.signals):
//   • device_id — a random id this browser/phone keeps (cookie cl_did, set once)
//   • fp        — the device's profile: model/browser, screen, language, time zone…
//   • ip        — the internet connection (the Wi-Fi or mobile network) it came from
// Websites can't read the Wi-Fi network's name, so the connection's address stands for
// it. When at least `min` of the three match (default 2 of 3), the two accounts are
// treated as the same person and share one free quota. Pure — tests/samePerson.test.mjs.

const clean = (v, max = 100) => {
  const s = String(v ?? '').trim();
  return s && s.length <= max ? s : null;
};

// Request inputs → the signals saved on the listing.
export function makeSignals({ deviceId, fp, ip } = {}) {
  return {
    device_id: /^[a-z0-9-]{8,64}$/i.test(String(deviceId || '')) ? String(deviceId) : null,
    fp: /^[a-z0-9]{6,32}$/i.test(String(fp || '')) ? String(fp) : null,
    ip: clean(ip, 64),
  };
}

export const SIGNAL_KEYS = ['device_id', 'fp', 'ip'];

// How many of the three signals two listings share (blank ones never match).
export function matchCount(a = {}, b = {}) {
  let n = 0;
  for (const k of SIGNAL_KEYS) if (a?.[k] && b?.[k] && a[k] === b[k]) n++;
  return n;
}

// The other accounts that look like the same person as `signals`, from recent listings
// [{ created_by, raw_data: { signals } }]. → [{ userId, matched: ['device_id', 'ip'] }]
export function linkedAccounts(uid, signals, listings = [], min = 2) {
  const out = new Map();
  for (const p of listings) {
    const other = String(p?.created_by || '');
    if (!other || other === String(uid)) continue;
    const s = p?.raw_data?.signals;
    if (matchCount(signals, s) < min) continue;
    const matched = SIGNAL_KEYS.filter((k) => signals?.[k] && s?.[k] === signals[k]);
    const prev = out.get(other);
    if (!prev || matched.length > prev.matched.length) out.set(other, { userId: other, matched });
  }
  return [...out.values()];
}

// Groups of accounts that look like one person, across all listings (admin view):
// accounts are joined when any two of their listings share `min`+ signals.
export function samePersonGroups(listings = [], min = 2) {
  const withSig = listings.filter((p) => p?.created_by && p?.raw_data?.signals);
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const p of withSig) if (!parent.has(String(p.created_by))) parent.set(String(p.created_by), String(p.created_by));
  const why = new Map();   // root pair → matched signals (for the admin label)
  for (let i = 0; i < withSig.length; i++) {
    for (let j = i + 1; j < withSig.length; j++) {
      const a = withSig[i], b = withSig[j];
      if (String(a.created_by) === String(b.created_by)) continue;
      if (matchCount(a.raw_data.signals, b.raw_data.signals) < min) continue;
      const ra = find(String(a.created_by)), rb = find(String(b.created_by));
      const matched = SIGNAL_KEYS.filter((k) => a.raw_data.signals[k] && a.raw_data.signals[k] === b.raw_data.signals[k]);
      if (ra !== rb) parent.set(ra, rb);
      const key = [String(a.created_by), String(b.created_by)].sort().join('|');
      why.set(key, matched);
    }
  }
  const groups = new Map();
  for (const id of parent.keys()) {
    const r = find(id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(id);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((users) => ({
    users: users.sort(),
    matched: [...new Set([...why.entries()].filter(([k]) => k.split('|').every((u) => users.includes(u))).flatMap(([, m]) => m))],
  }));
}
