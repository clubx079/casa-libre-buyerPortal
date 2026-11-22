'use client';
// Browser side of the place search: the compact place index (/api/listings/places, built
// on the server by lib/placeIndex.js), downloaded once per page and only when a search box
// is used or a map needs it; place outlines on demand; recent searches in localStorage.
// Matching / ranking is lib/places.js (tested).
import { useCallback, useEffect, useState } from 'react';
import { gatedFetch } from './gatedFetch';
import { hydrateIndex, addRecent } from './places';
import { COUNTRY } from './country';

let loading = null;
let loaded = null;
export function loadPlaces() {
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = gatedFetch('/api/listings/places')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !Array.isArray(j.places)) throw new Error('no places');
        loaded = { index: hydrateIndex(j.places), labels: Array.isArray(j.labels) ? j.labels : [] };
        return loaded;
      })
      .catch(() => { loading = null; return null; });
  }
  return loading;
}

// { index, labels, ensure }: index/labels null until loaded. `eager` loads on mount.
export function usePlaces(eager = false) {
  const [data, setData] = useState(loaded);
  const ensure = useCallback(() => { if (!loaded) loadPlaces().then((d) => { if (d) setData(d); }); }, []);
  useEffect(() => { if (eager) ensure(); }, [eager, ensure]);
  return { index: data ? data.index : null, labels: data ? data.labels : null, ensure };
}

const areas = new Map();
// Outline / label spot / box of one place: { ring, label, bounds, kind, name } or null.
export function loadPlaceArea(id) {
  if (!id) return Promise.resolve(null);
  if (!areas.has(id)) {
    areas.set(id, gatedFetch(`/api/listings/places?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.area) || null)
      .catch(() => { areas.delete(id); return null; }));
  }
  return areas.get(id);
}

// ── Recent searches (per country, this browser only) ──
const KEY = `cl.recentSearches.v1.${COUNTRY.code || 'py'}`;
export function readRecents() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => x && (x.type === 'place' || x.type === 'text')) : [];
  } catch { return []; }
}
export function saveRecent(item) {
  const next = addRecent(readRecents(), item);
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}
export function clearRecents() {
  try { window.localStorage.removeItem(KEY); } catch {}
  return [];
}

// The link to the marketplace for a picked place / a typed text.
export const placeHref = (p) => `/propiedades?place=${encodeURIComponent(p.id)}&q=${encodeURIComponent(p.name)}`;
