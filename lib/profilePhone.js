// A seller's listing phone also becomes their PROFILE phone when the profile has none.
// The sell wizard requires a phone for every listing (the buyers' contact number), but it
// was only stored on the listing (properties.contact_phone) — so the admin's Users page
// and the WhatsApp campaign audiences showed no number for most sellers.
// Never overwrites a number the person already has (typed or verified), never marks it
// verified (only a WhatsApp code does that). Pure decision + a tiny DB step.
import { toE164 } from './whatsappPhone.js';

// → the E.164 number to save, or null to leave the profile alone.
export function profilePhoneFromListing(user, contactPhone, prefix) {
  if (!user || String(user.phone || '').trim()) return null;
  return toE164(contactPhone, prefix);
}

export async function saveListingPhoneToProfile(db, uid, contactPhone, prefix) {
  if (!uid || !contactPhone) return false;
  const [user] = await db.select('users', `select=id,phone&id=eq.${encodeURIComponent(uid)}&limit=1`);
  const phone = profilePhoneFromListing(user, contactPhone, prefix);
  if (!phone) return false;
  // `phone=is.null` again on the write: a number added meanwhile is never replaced
  await db.update('users', `id=eq.${encodeURIComponent(uid)}&phone=is.null`, { phone }, { returning: 'minimal' });
  return true;
}
