'use client';
// Shared language preference (es/en/pt) persisted in localStorage so the choice
// sticks across page navigations and is kept in sync between components on the
// same page. Starts as 'es' on first paint (matches SSR), then hydrates from
// the saved value on mount to avoid a hydration mismatch.
import { useEffect, useState } from 'react';

// Bumped from 'cl-lang' so any previously-saved preference (e.g. a stale 'en'
// picked during testing) is dropped once — every visitor now defaults to ES on
// first load, and can still switch to EN/PT (saved under this key).
const KEY = 'cl-lang-v2';
const EVT = 'cl-lang-change';
export const LANGS = ['es', 'en', 'pt'];
const ok = (v) => LANGS.includes(v);

// First visit with nothing saved: a Portuguese browser (Brazil, ~all of the
// pt-* visitors) gets PT. Everyone else stays on the Spanish default.
function browserPick() {
  try {
    const list = navigator.languages?.length ? navigator.languages : [navigator.language];
    const first = String(list[0] || '').toLowerCase();
    if (first.startsWith('pt')) return 'pt';
  } catch {}
  return null;
}

export function useLang() {
  const [lang, setLangState] = useState('es');

  useEffect(() => {
    // ?lang=en|es|pt wins (the mobile app passes its own language when it opens
    // the site) and is saved, so the rest of the visit stays in that language.
    let fromUrl = null;
    try { fromUrl = new URLSearchParams(window.location.search).get('lang'); } catch {}
    if (ok(fromUrl)) {
      setLangState(fromUrl);
      try { localStorage.setItem(KEY, fromUrl); } catch {}
    } else {
      let saved = null;
      try { saved = localStorage.getItem(KEY); } catch {}
      if (ok(saved)) setLangState(saved);
      else {
        const b = browserPick();
        if (b) setLangState(b); // not saved: an explicit switch is what persists
      }
    }
    const onChange = (e) => {
      const v = e.detail;
      if (ok(v)) setLangState(v);
    };
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);

  const setLang = (v) => {
    if (!ok(v)) return;
    setLangState(v);
    try { localStorage.setItem(KEY, v); } catch {}
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: v })); } catch {}
  };

  return [lang, setLang];
}
