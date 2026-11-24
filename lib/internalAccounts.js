// Team / test / review accounts: never sent marketing automations (the share-feature
// announcement — lib/automations/shareFeature.js). The website's copy of the admin's
// lib/internalTraffic.js lists (keep both in step), plus:
//   · the test & review accounts marked by hand in Admin → Users ("Mark as test account"):
//     the `automations` row 'test_accounts', free_tiers[0].emails = { "<email>": { at, by } }
//     (admin lib/testAccounts.js) — readMarkedTestEmails()
//   · the team's test phone numbers, and any Pakistan (+92) number (the dev team; the admin
//     hides Pakistan accounts the same way)
// Pure except readMarkedTestEmails (db-shaped).
export const INTERNAL_EMAILS = [
  'omar@airosofts.com', 'omar@airosofts.con', 'omar57new@gmail.com', 'omarsap6@gmail.com',
  'admin@airosofts.com',
  'review@casa-libre.com.py',
  'g54hrzpr67@privaterelay.appleid.com',
  'hd9gwbyjry@privaterelay.appleid.com',
  'putin571105@gmail.com', 'siliconpixels.org@gmail.com', 'clubx079@gmail.com', 'info@casa-libre.com',
];
// Roland's accounts: roland@ableman.co (domain), roland@southerninvestment.co (domain below),
// g54hrzpr67@privaterelay.appleid.com (Apple sign-in, listed above) — and his name, for any other.
export const INTERNAL_DOMAINS = ['airosofts.com', 'airosofts.co', 'ableman.co', 'southerninvestment.co'];
export const INTERNAL_NAMES = ['omar faiz', 'omar new', 'roland lallier'];
export const TEST_PHONES = ['923362771289'];          // digits only
export const INTERNAL_PHONE_PREFIXES = ['92'];        // Pakistan = the dev team (92 + 10 digits; a local PY 992… number is 9 digits)
export const TEST_ACCOUNTS_ID = 'test_accounts';

const norm = (v) => String(v || '').trim().toLowerCase();
const digits = (v) => String(v || '').replace(/\D/g, '');

export function isInternalEmail(email, marked = null) {
  const e = norm(email);
  if (!e || !e.includes('@')) return false;
  return INTERNAL_EMAILS.includes(e) || /\.pk$/.test(e) || INTERNAL_DOMAINS.includes(e.split('@')[1]) || !!marked?.has(e);
}

export function isInternalPhone(phone) {
  const d = digits(phone);
  if (!d) return false;
  return TEST_PHONES.includes(d) || INTERNAL_PHONE_PREFIXES.some((p) => d.startsWith(p) && d.length === 12);
}

// user: { email, phone?, full_name? } · marked: Set of lower-case emails (readMarkedTestEmails)
export function isInternalAccount(user, marked = null) {
  if (!user) return false;
  return isInternalEmail(user.email, marked) || isInternalPhone(user.phone) || INTERNAL_NAMES.includes(norm(user.full_name));
}

// → Set of lower-case emails marked as test accounts in this country's admin.
export async function readMarkedTestEmails(db) {
  const [row] = await db.select('automations', `select=id,free_tiers&id=eq.${TEST_ACCOUNTS_ID}&limit=1`).catch(() => []);
  const s = row && Array.isArray(row.free_tiers) && row.free_tiers[0] && typeof row.free_tiers[0] === 'object' ? row.free_tiers[0] : {};
  return new Set(Object.keys(s.emails && typeof s.emails === 'object' ? s.emails : {}).map(norm));
}
