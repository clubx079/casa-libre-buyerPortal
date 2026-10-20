// "Same person, different email": the free-listings quota is per PERSON, not per email.
// Each listing keeps three signals of where it was published from (raw_data.signals):
//   • device_id — a random id this browser/phone keeps (cookie cl_did, set once)
//   • fp        — the device's profile: model/browser, screen, language, time zone…
//   • ip        — the internet connection (the Wi-Fi or mobile network) it came from
// Websites can't read the Wi-Fi network's name, so the connection's address stands for
// it. When at least `min` of the three match (default 2 of 3), the two accounts are
// treated as the same person and share one free quota.
// Stronger than all three: the PHONE. A seller who opens a second account still puts
// their real number on the listing (buyers must reach them), so the same contact phone
// on two accounts' listings — or one account's listing phone being another account's
// verified WhatsApp — is the same person on its own. Pure — tests/samePerson.test.mjs.
import { toE164 } from './whatsappPhone.js';

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

// A listing's contact phone as E.164 (null when blank / not a phone).
export const listingPhone = (p, prefix) => toE164(p?.contact_phone, prefix);

// How many of the three signals two listings share (blank ones never match).
export function matchCount(a = {}, b = {}) {
  let n = 0;
  for (const k of SIGNAL_KEYS) if (a?.[k] && b?.[k] && a[k] === b[k]) n++;
  return n;
}

// The other accounts that look like the same person as `signals`, from recent listings
// [{ created_by, contact_phone, raw_data: { signals } }].
//   phones   — this person's numbers (E.164): the listing being published, their verified
//              WhatsApp, their own listings' contact phones
//   verified — other accounts' verified WhatsApp: [{ id, phone }]
// → [{ userId, matched: ['phone'] | ['device_id', 'ip'] | … }]
export function linkedAccounts(uid, signals, listings = [], min = 2, { phones = [], prefix = '', verified = [] } = {}) {
  const mine = new Set(phones.filter(Boolean));
  const out = new Map();
  const add = (other, matched) => {
    const prev = out.get(other)?.matched || [];
    out.set(other, { userId: other, matched: [...new Set([...prev, ...matched])] });
  };
  for (const p of listings) {
    const other = String(p?.created_by || '');
    if (!other || other === String(uid)) continue;
    const ph = listingPhone(p, prefix);
    if (ph && mine.has(ph)) add(other, ['phone']);
    const s = p?.raw_data?.signals;
    if (matchCount(signals, s) < min) continue;
    add(other, SIGNAL_KEYS.filter((k) => signals?.[k] && s?.[k] === signals[k]));
  }
  for (const v of verified) {
    const other = String(v?.id || '');
    if (other && other !== String(uid) && v.phone && mine.has(v.phone)) add(other, ['phone']);
  }
  return [...out.values()];
}

// Groups of accounts that look like one person, across all listings (admin view):
// accounts are joined when any two of their listings share `min`+ signals or the same
// contact phone, or one's listing phone is another's verified WhatsApp (`verified`).
export function samePersonGroups(listings = [], min = 2, { prefix = '', verified = [] } = {}) {
  const withSig = listings.filter((p) => p?.created_by && (p?.raw_data?.signals || p?.contact_phone));
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const p of withSig) if (!parent.has(String(p.created_by))) parent.set(String(p.created_by), String(p.created_by));
  const why = new Map();   // root pair → matched signals (for the admin label)
  for (let i = 0; i < withSig.length; i++) {
    for (let j = i + 1; j < withSig.length; j++) {
      const a = withSig[i], b = withSig[j];
      if (String(a.created_by) === String(b.created_by)) continue;
      const pa = listingPhone(a, prefix);
      const samePhone = !!pa && pa === listingPhone(b, prefix);
      const sa = a.raw_data?.signals || {}, sb = b.raw_data?.signals || {};
      const sig = matchCount(sa, sb) >= min;
      if (!samePhone && !sig) continue;
      const ra = find(String(a.created_by)), rb = find(String(b.created_by));
      const matched = [...(samePhone ? ['phone'] : []), ...(sig ? SIGNAL_KEYS.filter((k) => sa[k] && sa[k] === sb[k]) : [])];
      if (ra !== rb) parent.set(ra, rb);
      const key = [String(a.created_by), String(b.created_by)].sort().join('|');
      why.set(key, matched);
    }
  }
  // a listing phone that is another account's verified WhatsApp
  for (const p of withSig) {
    const ph = listingPhone(p, prefix);
    const v = ph && verified.find((x) => x?.phone === ph && String(x.id) !== String(p.created_by));
    if (!v) continue;
    const a = String(p.created_by), b = String(v.id);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
    why.set([a, b].sort().join('|'), ['phone']);
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
