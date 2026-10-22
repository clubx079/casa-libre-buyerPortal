'use client';
// App-wide saved-properties state: loads the saves once, exposes isSaved()/toggle().
// Logged out, people can save too: the saves are kept for this browser (device id cookie
// cl_did, lib/deviceSignals.js) and move into their account when they sign in
// (app/api/favorites). Reloads when the user signs in or out.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { track } from '@/lib/analytics';
import { deviceId } from '@/lib/deviceSignals';
import { useLang } from '@/lib/useLang';
import Link from 'next/link';

const HINT_KEY = 'cl_saved_hint';   // the "Guardada → Ver mis guardadas" hint, shown once per browser

const Ctx = createContext(null);
export const useFavorites = () => useContext(Ctx) || { isSaved: () => false, toggle: () => {}, count: 0, ids: new Set() };

export default function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [lang] = useLang();
  const [ids, setIds] = useState(() => new Set());
  const [hint, setHint] = useState(false);

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
      // The first save on this browser: show where saves live (once).
      if (!wasSaved) {
        let seen = true;
        try { seen = localStorage.getItem(HINT_KEY) === '1'; localStorage.setItem(HINT_KEY, '1'); } catch { /* private mode */ }
        if (!seen) { setHint(true); setTimeout(() => setHint(false), 6000); }
      }
    } catch {
      setIds((prev) => { const n = new Set(prev); wasSaved ? n.add(id) : n.delete(id); return n; });
    }
  }, [user, ids]);

  return (
    <Ctx.Provider value={{ ids, isSaved, toggle, count: ids.size }}>
      {children}
      {hint && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[700] flex items-center gap-3 bg-ink text-paper rounded-pill pl-5 pr-2 py-2 shadow-hard-soft text-[14px] font-medium" data-testid="saved-hint">
          <span>{lang === 'en' ? 'Saved' : 'Guardada'}</span>
          <Link href={user ? '/cuenta/guardadas' : '/guardadas'} onClick={() => setHint(false)} className="rounded-pill bg-paper text-ink px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap">
            {lang === 'en' ? 'See your saved homes →' : 'Ver mis guardadas →'}
          </Link>
        </div>
      )}
    </Ctx.Provider>
  );
}
