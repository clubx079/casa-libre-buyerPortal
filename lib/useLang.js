'use client';
// Shared language preference (es/en) persisted in localStorage so the choice
// sticks across page navigations and is kept in sync between components on the
// same page. Starts as 'es' on first paint (matches SSR), then hydrates from
// the saved value on mount to avoid a hydration mismatch.
import { useEffect, useState } from 'react';

// Bumped from 'cl-lang' so any previously-saved preference (e.g. a stale 'en'
// picked during testing) is dropped once — every visitor now defaults to ES on
// first load, and can still switch to EN (saved under this key).
const KEY = 'cl-lang-v2';
const EVT = 'cl-lang-change';

export function useLang() {
  const [lang, setLangState] = useState('es');

  useEffect(() => {
    // ?lang=en|es wins (the mobile app passes its own language when it opens the
    // site) and is saved, so the rest of the visit stays in that language.
    let fromUrl = null;
    try { fromUrl = new URLSearchParams(window.location.search).get('lang'); } catch {}
    if (fromUrl === 'es' || fromUrl === 'en') {
      setLangState(fromUrl);
      try { localStorage.setItem(KEY, fromUrl); } catch {}
    } else {
      try {
        const saved = localStorage.getItem(KEY);
        if (saved === 'es' || saved === 'en') setLangState(saved);
      } catch {}
    }
    const onChange = (e) => {
      const v = e.detail;
      if (v === 'es' || v === 'en') setLangState(v);
    };
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);

  const setLang = (v) => {
    if (v !== 'es' && v !== 'en') return;
    setLangState(v);
    try { localStorage.setItem(KEY, v); } catch {}
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: v })); } catch {}
  };

  return [lang, setLang];
}
