// Buyer-submitted "seller didn't respond" reports, stored in the
// `listing_reports` table via PostgREST. Mirrors lib/favorites.js.
import 'server-only';
import { insert } from '@/lib/db';

export async function createReport(row) {
  const [r] = await insert('listing_reports', [row], { returning: 'representation' });
  return r;
}
