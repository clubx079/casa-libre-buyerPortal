'use client';
// Search box with predictive place suggestions: what each place is and where
// ("Las Mercedes — Barrio, Asunción" vs "Las Mercedes — Barrio, San Lorenzo"), recent
// searches when the box is empty, and a last row that searches the typed text as it is.
// Keyboard: ↑/↓ move, Enter picks the highlighted row (else the form submits), Esc closes.
//
// Renders the <input> plus the dropdown; the dropdown is positioned against the nearest
// `relative` ancestor (the search form). Matching/ranking: lib/places.js.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { suggestPlaces, exactPlace, placeSubtitle, matchRange } from '@/lib/places';
import { readRecents, saveRecent, clearRecents } from '@/lib/placesClient';

const STR = {
  es: { recent: 'Búsquedas recientes', clear: 'Borrar', search: 'Buscar', none: 'Sin barrios ni ciudades con ese nombre', listings: 'propiedades' },
  en: { recent: 'Recent searches', clear: 'Clear', search: 'Search', none: 'No neighborhood or city by that name', listings: 'listings' },
  pt: { recent: 'Buscas recentes', clear: 'Limpar', search: 'Buscar', none: 'Nenhum bairro ou cidade com esse nome', listings: 'imóveis' },
};

const ICONS = {
  barrio: <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  city: <path d="M4 21V9l5-3v15 M9 21V4l7 3v14 M16 21v-9l4 2v7 M3 21h18" />,
  dept: <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z M9 4v13.5 M15 6.5V20" />,
  recent: <path d="M12 7v5l3 2 M3.5 12a8.5 8.5 0 1 0 2.5-6 M3 4v4h4" />,
  search: <path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M20 20l-4.8-4.8" />,
};
const Icon = ({ name }) => (
  <span className="w-8 h-8 flex-none rounded-full bg-ink/[0.05] flex items-center justify-center text-ink/70" aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name] || ICONS.barrio}</svg>
  </span>
);

function Name({ name, q }) {
  const r = q ? matchRange(name, q) : null;
  if (!r) return <span className="font-medium">{name}</span>;
  return <span>{name.slice(0, r[0])}<b className="font-bold">{name.slice(r[0], r[1])}</b>{name.slice(r[1])}</span>;
}

// Remembered for the empty box (this browser, per country).
export const rememberPlace = (p, lang = 'es') => saveRecent({ type: 'place', id: p.id, name: p.name, sub: placeSubtitle(p, lang) });
export const rememberText = (q) => saveRecent({ type: 'text', q: String(q || '').trim() });

// The form's submit (Enter with nothing highlighted, or the search button): a text that names
// a place outright ("las mercedes", "ykua sati", "mercedes asuncion") picks that place,
// anything else is a text search. Returns true when a place was picked.
export function submitSearch(index, text, { onPick, onText, lang = 'es' }) {
  const s = String(text || '').trim();
  const p = s && index ? exactPlace(index, s) : null;
  if (p) { rememberPlace(p, lang); onPick(p); return true; }
  if (s) rememberText(s);
  onText(s);
  return false;
}

export default function PlaceAutocomplete({
  value, onChange, onPick, onText, index, onNeedIndex, lang = 'es',
  placeholder, ariaLabel, className = '', dropdownClassName = '', inputRef: extRef, max = 7,
}) {
  const s = STR[lang] || STR.es;
  const listId = useId();
  const ownRef = useRef(null);
  const inputRef = extRef || ownRef;
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recents, setRecents] = useState([]);
  const q = String(value || '');
  const typed = q.trim().length > 0;

  const items = useMemo(() => (typed && index ? suggestPlaces(index, q, max) : []), [typed, index, q, max]);
  // Rows the arrows move over: suggestions + "Search “…”", or the recent searches.
  const rows = typed
    ? [...items.map(({ place }) => ({ kind: 'place', place })), { kind: 'text', q: q.trim() }]
    : recents.map((r) => ({ kind: 'recent', r }));
  const show = open && focused && (typed || recents.length > 0);

  useEffect(() => { setActive(-1); }, [q, index]);

  // The list is drawn in its own layer (portal, position: fixed) under the search box, so no
  // parent's overflow / layout can clip it or push it off-screen; it opens below the box and its
  // height is capped to the space left under it. Re-measured on scroll and resize.
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!show) return undefined;
    const measure = () => {
      const el = inputRef.current;
      if (!el) return;
      const box = (el.closest('form') || el.parentElement || el).getBoundingClientRect();
      const vw = window.innerWidth; const vh = window.innerHeight;
      const width = Math.min(Math.max(box.width, 340), vw - 16);
      const left = Math.max(8, Math.min(box.left, vw - width - 8));
      const top = box.bottom + 8;
      setPos({ top, left, width, maxList: Math.max(160, Math.min(380, vh - top - 70)) });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [show, inputRef]);

  const close = () => { setOpen(false); setActive(-1); };
  const done = () => { close(); try { inputRef.current?.blur(); } catch {} };

  const pickPlace = (p) => { rememberPlace(p, lang); done(); onPick(p); };
  const searchText = (t) => { const v = String(t || '').trim(); if (v) rememberText(v); done(); onText(v); };
  const activate = (row) => {
    if (!row) return;
    if (row.kind === 'place') pickPlace(row.place);
    else if (row.kind === 'text') searchText(row.q);
    else if (row.r.type === 'place') {
      const p = index && index.byId.get(row.r.id);
      if (p) pickPlace(p); else searchText(row.r.name);
    } else searchText(row.r.q);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault();
      if (!open) { setOpen(true); setActive(e.key === 'ArrowDown' ? 0 : rows.length - 1); return; }
      const d = e.key === 'ArrowDown' ? 1 : -1;
      const n = rows.length + 1;   // -1 = back in the box
      setActive((i) => ((((i + 1 + d) % n) + n) % n) - 1);
    } else if (e.key === 'Enter') {
      if (show && active >= 0 && rows[active]) { e.preventDefault(); activate(rows[active]); }
      else close();   // the form submits (submitSearch)
    } else if (e.key === 'Escape') {
      if (show) { e.preventDefault(); close(); }
    }
  };

  const optId = (i) => `${listId}-o${i}`;
  const rowCls = (i) => `flex items-center gap-3 min-h-[54px] px-3.5 py-2 cursor-pointer select-none ${i === active ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.04]'}`;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label={ariaLabel || placeholder}
        aria-autocomplete="list"
        aria-expanded={show}
        aria-controls={listId}
        aria-activedescendant={show && active >= 0 ? optId(active) : undefined}
        value={q}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); setRecents(readRecents()); if (onNeedIndex) onNeedIndex(); }}
        onBlur={() => { setFocused(false); close(); }}
        onKeyDown={onKeyDown}
        className={className}
      />
      {show && pos && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className={`z-[1200] bg-card text-ink text-left border-[1.5px] border-ink rounded-[18px] shadow-hard overflow-hidden ${dropdownClassName.replace(/min-w-\[[^\]]+\]/g, '')}`}
          // Keep the focus in the box while a row is clicked (no blur before the click lands).
          onMouseDown={(e) => e.preventDefault()}
        >
          {!typed && (
            <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
              <span className="font-mono text-[11px] tracking-[0.05em] uppercase text-ink/45">{s.recent}</span>
              <button type="button" onClick={() => setRecents(clearRecents())} className="text-[13px] font-medium text-ink/60 hover:text-ink">{s.clear}</button>
            </div>
          )}
          {typed && index && !items.length && (
            <div className="px-4 pt-3 pb-1 text-[13px] text-ink/60" aria-hidden="true">{s.none}</div>
          )}
          <ul id={listId} role="listbox" aria-label={ariaLabel || placeholder} style={{ maxHeight: pos.maxList }} className="overflow-y-auto overscroll-contain m-0 p-0 list-none">
            {rows.map((row, i) => {
              const sep = i > 0 ? 'border-t border-ink/[0.08]' : '';
              if (row.kind === 'place') {
                const p = row.place;
                return (
                  <li key={p.id} id={optId(i)} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => activate(row)} className={`${rowCls(i)} ${sep}`}>
                    <Icon name={p.kind} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[15px]"><Name name={p.name} q={q.trim()} /></span>
                      <span className="block truncate text-[12.5px] text-ink/60 mt-px">{placeSubtitle(p, lang)}</span>
                    </span>
                    <span className="font-mono text-[12px] text-ink/45" title={`${p.count} ${s.listings}`}>{p.count}</span>
                  </li>
                );
              }
              if (row.kind === 'text') {
                return (
                  <li key="__text" id={optId(i)} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => activate(row)} className={`${rowCls(i)} ${sep}`}>
                    {index && !items.length && <span className="sr-only">{s.none}. </span>}
                    <Icon name="search" />
                    <span className="flex-1 min-w-0 truncate text-[15px] font-medium">{s.search} “{row.q}”</span>
                  </li>
                );
              }
              const r = row.r;
              return (
                <li key={r.type === 'place' ? 'p:' + r.id : 't:' + r.q} id={optId(i)} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => activate(row)} className={`${rowCls(i)} ${sep}`}>
                  <Icon name="recent" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[15px] font-medium">{r.type === 'place' ? r.name : r.q}</span>
                    {r.type === 'place' && r.sub ? <span className="block truncate text-[12.5px] text-ink/60 mt-px">{r.sub}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
