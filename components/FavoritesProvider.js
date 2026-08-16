'use client';
// App-wide saved-properties state: loads the user's favorites once, exposes
// isSaved()/toggle(). Toggling while logged out opens the auth modal.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

const Ctx = createContext(null);
export const useFavorites = () => useContext(Ctx) || { isSaved: () => false, toggle: () => {}, count: 0, ids: new Set() };

export default function FavoritesProvider({ children }) {
  const { user, openAuth } = useAuth();
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    let alive = true;
    fetch('/api/favorites').then((r) => r.json()).then((j) => { if (alive) setIds(new Set(j.ids || [])); }).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  const isSaved = useCallback((id) => ids.has(id), [ids]);

  const toggle = useCallback(async (id) => {
    if (!user) { openAuth(); return; }
    const wasSaved = ids.has(id);
    setIds((prev) => { const n = new Set(prev); wasSaved ? n.delete(id) : n.add(id); return n; });
    try {
      await fetch('/api/favorites', { method: wasSaved ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property_id: id }) });
    } catch {
      setIds((prev) => { const n = new Set(prev); wasSaved ? n.add(id) : n.delete(id); return n; });
    }
  }, [user, ids, openAuth]);

  return <Ctx.Provider value={{ ids, isSaved, toggle, count: ids.size }}>{children}</Ctx.Provider>;
}
