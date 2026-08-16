// Saved / favorite properties, stored in the `favorites` table via PostgREST.
import 'server-only';
import { select, insert, remove } from './db';

export async function favoriteIds(userId) {
  if (!userId) return [];
  const rows = await select('favorites', `select=property_id&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`).catch(() => []);
  return Array.isArray(rows) ? rows.map((r) => r.property_id) : [];
}

export async function addFavorite(userId, propertyId) {
  return insert('favorites', { user_id: userId, property_id: propertyId }, { upsert: true, onConflict: 'user_id,property_id', returning: 'minimal' });
}

export async function removeFavorite(userId, propertyId) {
  return remove('favorites', `user_id=eq.${encodeURIComponent(userId)}&property_id=eq.${encodeURIComponent(propertyId)}`);
}

export async function favoriteCount(userId) {
  const ids = await favoriteIds(userId);
  return ids.length;
}
