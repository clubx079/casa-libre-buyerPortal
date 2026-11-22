// Writes for "buyer or seller" (lib/userType.js, migration 023_user_type.sql).
// Every call is best-effort: a DB without the columns (migration not run yet) makes the
// write fail → we return false and the sign-in / publish carries on untouched.
import 'server-only';
import { update } from './db';
import { userTypePatch } from './userType';

const enc = encodeURIComponent;

// Record the account's type. onlyIfEmpty: never overwrite a type it already has
// (used for log-ins and for the sell funnel signing in an existing account).
// Returns the updated row, or null when nothing changed / the column is missing.
export async function setUserType(userId, type, source, { onlyIfEmpty = false } = {}) {
  const patch = userTypePatch(type, source);
  if (!userId || !patch) return null;
  const where = `id=eq.${enc(userId)}${onlyIfEmpty ? '&user_type=is.null' : ''}`;
  try {
    const res = await update('users', where, patch, { returning: 'representation' });
    const row = Array.isArray(res) ? res[0] : res;
    return row || null;
  } catch {
    return null;
  }
}

// Apply what a sign-in learned to the user row it returns (so the API reply carries it).
// isNew: the account was just made → set; otherwise only fill an empty type.
export async function applyUserType(user, type, source, { isNew = false } = {}) {
  if (!user?.id || !type) return user;
  const row = await setUserType(user.id, type, source, { onlyIfEmpty: !isNew });
  return row ? { ...user, ...row } : user;
}

// A listing was published: stamp first_listed_at once, and an account with no type yet
// becomes a seller (source 'listing'). A buyer stays a buyer ("buyer who listed").
export async function markListed(userId, now = new Date()) {
  if (!userId) return false;
  const id = enc(userId);
  let ok = false;
  try {
    await update('users', `id=eq.${id}&first_listed_at=is.null`, { first_listed_at: now.toISOString() }, { returning: 'minimal' });
    ok = true;
  } catch {}
  await setUserType(userId, 'seller', 'listing', { onlyIfEmpty: true });
  return ok;
}
