// Saved / favorite properties, stored in the `favorites` table via PostgREST.
// Visitors who are NOT logged in can save too: those saves live in `guest_favorites`
// under the browser's device id (cookie cl_did, lib/deviceSignals.js — migration 020) and
// move into `favorites` the next time that browser is signed in (mergeGuestFavorites).
// Sellers see the total of both as "N personas guardaron tu propiedad" (saveCounts).
import 'server-only';
import { select, insert, remove } from './db';

const enc = encodeURIComponent;
export const validDeviceId = (id) => /^[a-z0-9-]{8,64}$/i.test(String(id || ''));

export async function favoriteIds(userId) {
  if (!userId) return [];
  const rows = await select('favorites', `select=property_id&user_id=eq.${enc(userId)}&order=created_at.desc`).catch(() => []);
  return Array.isArray(rows) ? rows.map((r) => r.property_id) : [];
}

export async function addFavorite(userId, propertyId) {
  return insert('favorites', { user_id: userId, property_id: propertyId }, { upsert: true, onConflict: 'user_id,property_id', returning: 'minimal' });
}

export async function removeFavorite(userId, propertyId) {
  return remove('favorites', `user_id=eq.${enc(userId)}&property_id=eq.${enc(propertyId)}`);
}

export async function favoriteCount(userId) {
  const ids = await favoriteIds(userId);
  return ids.length;
}

// ── guests (not logged in) ──
export async function guestFavoriteIds(deviceId) {
  if (!validDeviceId(deviceId)) return [];
  const rows = await select('guest_favorites', `select=property_id&device_id=eq.${enc(deviceId)}&order=created_at.desc`).catch(() => []);
  return Array.isArray(rows) ? rows.map((r) => r.property_id) : [];
}

export async function addGuestFavorite(deviceId, propertyId) {
  return insert('guest_favorites', { device_id: deviceId, property_id: propertyId }, { upsert: true, onConflict: 'device_id,property_id', returning: 'minimal' });
}

export async function removeGuestFavorite(deviceId, propertyId) {
  return remove('guest_favorites', `device_id=eq.${enc(deviceId)}&property_id=eq.${enc(propertyId)}`);
}

// This browser just signed in: its guest saves become the account's saves. Never throws.
export async function mergeGuestFavorites(userId, deviceId) {
  if (!userId || !validDeviceId(deviceId)) return 0;
  try {
    const ids = await guestFavoriteIds(deviceId);
    if (!ids.length) return 0;
    await insert('favorites', ids.map((property_id) => ({ user_id: userId, property_id })), { upsert: true, onConflict: 'user_id,property_id', returning: 'minimal' });
    await remove('guest_favorites', `device_id=eq.${enc(deviceId)}`);
    return ids.length;
  } catch { return 0; }
}

// How many people saved each listing (accounts + guests) → Map id → n.
export async function saveCounts(propertyIds = []) {
  const ids = [...new Set(propertyIds.filter(Boolean).map(String))];
  const out = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return out;
  const list = enc(`(${ids.map((i) => `"${i.replace(/"/g, '')}"`).join(',')})`);
  const [users, guests] = await Promise.all([
    select('favorites', `select=property_id&property_id=in.${list}`).catch(() => []),
    select('guest_favorites', `select=property_id&property_id=in.${list}`).catch(() => []),
  ]);
  for (const r of [...(users || []), ...(guests || [])]) out.set(String(r.property_id), (out.get(String(r.property_id)) || 0) + 1);
  return out;
}
