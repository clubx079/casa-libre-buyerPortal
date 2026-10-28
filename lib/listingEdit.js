// Editing a published listing (/api/account/listings/edit): which listings can be edited.
// Pure — tests/listingEdit.test.mjs.
import { SCAN_STATUS } from './scanVerdict.js';
import { DUPLICATE_STATUS } from './duplicateCheck.js';

const PAYMENT_PENDING = 'payment_pending';   // LISTING_STATUS.pending (lib/listingPayments.js is server-only)

// Why a listing can't be edited right now (null = it can).
export function lockReason(p) {
  if (p.status === DUPLICATE_STATUS) return 'held_duplicate';
  if (p.status === PAYMENT_PENDING) return 'payment_pending';
  if (p.status === SCAN_STATUS.scanning) return 'checking';
  if (p.status === SCAN_STATUS.published && p.admin_status !== 'active') return 'taken_down';   // an admin took it off the site
  if (p.status !== SCAN_STATUS.published && p.status !== SCAN_STATUS.rejected) return 'locked';
  return null;
}

