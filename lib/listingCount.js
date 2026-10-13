// How many listings a user has published (properties they created, origin 'user').
// The paywall itself counts per MONTH with the limit set in the admin (lib/paidListings.js,
// lib/listingQuota.js); this all-time count is what the admin's Users page shows
// (admin lib/listingCount.js), flagged from the default free limit on.
export const LISTING_FREE_LIMIT = 3;

export const overFreeLimit = (n) => Number(n) >= LISTING_FREE_LIMIT;

// db = lib/db (selectWithCount). → the number of listings this user published.
export async function countUserListings(db, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId || ''))) return 0;
  const { count } = await db.selectWithCount('properties', `select=id&origin=eq.user&created_by=eq.${userId}&limit=1`);
  return Number(count) || 0;
}
