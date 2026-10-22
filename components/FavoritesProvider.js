'use client';
// App-wide saved-properties state: loads the saves once, exposes isSaved()/toggle().
// Logged out, people can save too: the saves are kept for this browser (device id cookie
// cl_did, lib/deviceSignals.js) and move into their account when they sign in
// (app/api/favorites). Reloads when the user signs in or out.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { track } from '@/lib/analytics';
import { deviceId } from '@/lib/deviceSignals';

const Ctx = createContext(null);
export const useFavorites = () => useContext(Ctx) || { isSaved: () => false, toggle: () => {}, count: 0, ids: new Set() };

export default function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    deviceId();   // make sure this browser has its id (cookie) before asking
    fetch('/api/favorites', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (alive) setIds(new Set(j.ids || [])); }).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  const isSaved = useCallback((id) => ids.has(id), [ids]);

  // meta.mode (venta / alquiler) rides along on the analytics event only.
  const toggle = useCallback(async (id, meta = {}) => {
    deviceId();
    const wasSaved = ids.has(id);
    track(wasSaved ? 'property_unsaved' : 'property_saved', { property_id: id, mode: meta.mode, guest: !user });
    setIds((prev) => { const n = new Set(prev); wasSaved ? n.delete(id) : n.add(id); return n; });
    try {
      const r = await fetch('/api/favorites', { method: wasSaved ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property_id: id }) });
      if (!r.ok) throw new Error('save_failed');
    } catch {
      setIds((prev) => { const n = new Set(prev); wasSaved ? n.add(id) : n.delete(id); return n; });
    }
  }, [user, ids]);

  return <Ctx.Provider value={{ ids, isSaved, toggle, count: ids.size }}>{children}</Ctx.Provider>;
}
