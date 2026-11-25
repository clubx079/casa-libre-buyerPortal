// "Deleted" listings (My listings → Eliminadas). When an owner deletes a listing it is NOT removed
// from the database: it leaves the site and the app straight away (status 'deleted', admin_status
// 'inactive', the same pattern every other hidden state uses) and stays in the owner's "Eliminadas"
// tab with a Recover button, with no time limit.
//
// Recover puts back the status it had. Paid features come back too (Verified / Landing page,
// the paid period, gifts) because they live on the row and are never cleared — but their clocks
// never stopped: every end date stays the ORIGINAL one (promotion_expires_at, paid_listing.until,
// the free period counted from when it was first listed). So:
//   • a Verified / Landing promotion that ended while the listing was deleted simply doesn't show
//     (lib/listings.js only shows it while promotion_expires_at is in the future);
//   • if the listing's own time (paid or free period) ran out while it was deleted, it comes back
//     ENDED — status 'expired', off the site — exactly as the hourly job would have left it, and
//     the owner can extend it from My listings like any ended listing.
//
// What we remember lives in raw_data.owner_deleted = { at, prev_status, prev_admin_status }.

export const DELETED_STATUS = 'deleted';

// The row change that moves a listing to "Eliminadas".
export function trashPatch(prop, now = Date.now()) {
  const raw = prop.raw_data && typeof prop.raw_data === 'object' ? prop.raw_data : {};
  return {
    status: DELETED_STATUS,
    admin_status: 'inactive',
    raw_data: {
      ...raw,
      owner_deleted: {
        at: new Date(now).toISOString(),
        prev_status: prop.status || 'published',
        prev_admin_status: prop.admin_status || 'active',
      },
    },
  };
}

// The row change that brings it back. until = when the listing's own time ends (paid period, or
// the free period while the paywall is on — lib/paidListings.js listingUntil), null = no end.
// → null when it isn't a deleted listing.
export function restorePatch(prop, { until = null, now = Date.now() } = {}) {
  const d = prop?.raw_data?.owner_deleted;
  if (prop?.status !== DELETED_STATUS || !d) return null;
  const { owner_deleted, ...raw } = prop.raw_data;
  const at = new Date(now).toISOString();
  const prevStatus = d.prev_status || 'published';
  const ended = prevStatus === 'published' && !!until && Date.parse(until) <= now;
  if (!ended) {
    return { status: prevStatus, admin_status: d.prev_admin_status || 'active', raw_data: { ...raw, owner_recovered_at: at } };
  }
  // Its time ran out while it was deleted → back as an ENDED listing (what the hourly job does).
  const paid = raw.paid_listing && raw.paid_listing.until ? raw.paid_listing : null;
  return {
    status: 'expired',
    admin_status: 'inactive',
    raw_data: {
      ...raw,
      owner_recovered_at: at,
      ...(paid
        ? { paid_listing: { ...paid, state: 'expired', ended_at: paid.ended_at || at } }
        : { free_listing: { ...(raw.free_listing || {}), state: 'expired', until, ended_at: at } }),
    },
  };
}

// What the owner's dashboard shows for a deleted listing (null = not deleted).
export function trashView(prop) {
  const d = prop?.raw_data?.owner_deleted;
  if (prop?.status !== DELETED_STATUS || !d) return null;
  return { deleted_at: d.at || null };
}
