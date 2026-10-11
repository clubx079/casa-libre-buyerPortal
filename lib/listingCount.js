// How many listings a user has published (properties they created, origin 'user').
// From LISTING_FREE_LIMIT on, listing more will be paid — the payment isn't built yet;
// this is the counter it will use. The admin's Users page shows the same count
// (admin lib/listingCount.js).
export const LISTING_FREE_LIMIT = 5;

export const overFreeLimit = (n) => Number(n) >= LISTING_FREE_LIMIT;

// db = lib/db (selectWithCount). → the number of listings this user published.
export async function countUserListings(db, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId || ''))) return 0;
  const { count } = await db.selectWithCount('properties', `select=id&origin=eq.user&created_by=eq.${userId}&limit=1`);
  return Number(count) || 0;
}
