// "Recently deleted" listings. When an owner deletes a listing it is NOT removed from the
// database any more: it leaves the site and the app straight away (status 'deleted',
// admin_status 'inactive', the same pattern every other hidden state uses), and shows in the
// owner's "Recently deleted" list for TRASH_DAYS with a Recover button. Recover puts back the
// exact status it had, so paid features (Verified / Landing page, the paid period, gifts)
// come back untouched: they live on the row and were never cleared. After TRASH_DAYS the
// purge cron (app/api/cron/purge-deleted) deletes the row for good.
//
// What we remember lives in raw_data.owner_deleted = { at, purge_after, prev_status, prev_admin_status }.

export const TRASH_DAYS = 3;
export const DELETED_STATUS = 'deleted';
const DAY = 24 * 60 * 60 * 1000;

const enc = encodeURIComponent;

// The row change that moves a listing to "Recently deleted".
export function trashPatch(prop, now = Date.now()) {
  const raw = prop.raw_data && typeof prop.raw_data === 'object' ? prop.raw_data : {};
  return {
    status: DELETED_STATUS,
    admin_status: 'inactive',
    raw_data: {
      ...raw,
      owner_deleted: {
        at: new Date(now).toISOString(),
        purge_after: new Date(now + TRASH_DAYS * DAY).toISOString(),
        prev_status: prop.status || 'published',
        prev_admin_status: prop.admin_status || 'active',
      },
    },
  };
}

// The row change that brings it back exactly as it was. null when it can't be recovered.
export function restorePatch(prop, now = Date.now()) {
  const d = prop?.raw_data?.owner_deleted;
  if (prop?.status !== DELETED_STATUS || !d) return null;
  if (Date.parse(d.purge_after || 0) <= now) return null;   // window over (the purge just hasn't run yet)
  const { owner_deleted, ...raw } = prop.raw_data;
  return {
    status: d.prev_status || 'published',
    admin_status: d.prev_admin_status || 'active',
    raw_data: { ...raw, owner_recovered_at: new Date(now).toISOString() },
  };
}

// What the owner's dashboard shows for a deleted listing.
export function trashView(prop, now = Date.now()) {
  const d = prop?.raw_data?.owner_deleted;
  if (prop?.status !== DELETED_STATUS || !d) return null;
  const left = Date.parse(d.purge_after || 0) - now;
  return { deleted_at: d.at || null, purge_after: d.purge_after || null, days_left: Math.max(0, Math.ceil(left / DAY)), recoverable: left > 0 };
}

// Permanently remove every listing whose window is over. db = { select, remove } (lib/db.js shape).
export async function purgeExpired(db, { now = Date.now(), limit = 500 } = {}) {
  const rows = await db.select('properties', `select=id,raw_data&status=eq.${DELETED_STATUS}&limit=${limit}`);
  const due = (rows || []).filter((r) => Date.parse(r.raw_data?.owner_deleted?.purge_after || 0) <= now);
  let purged = 0;
  for (const r of due) {
    await db.remove('property_images', `property_id=eq.${enc(r.id)}`);
    await db.remove('properties', `id=eq.${enc(r.id)}&status=eq.${DELETED_STATUS}`);   // status re-checked: a recover a second ago wins
    purged++;
  }
  return { checked: (rows || []).length, purged };
}
