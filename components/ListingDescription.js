'use client';
// Listing description + "Translate" button. The button shows only when the text
// doesn't already look like the language the visitor is reading (lib/descLang.js);
// the translation comes from /api/translate (Groq) and "Show original" flips back.
import { useState } from 'react';
import { guessLang } from '@/lib/descLang';
import { track } from '@/lib/analytics';

const T = {
  es: { btn: 'Traducir al español', busy: 'Traduciendo…', note: 'Traducido automáticamente', original: 'Ver original', again: 'Ver traducción', err: 'No se pudo traducir. Probá de nuevo.' },
  en: { btn: 'Translate to English', busy: 'Translating…', note: 'Translated automatically', original: 'Show original', again: 'Show translation', err: 'Couldn’t translate. Please try again.' },
};

const split = (s) => String(s || '').split(/\n{2,}|\r?\n/).map((x) => x.trim()).filter(Boolean);
const linkCls = 'font-semibold text-ink/75 hover:text-ink underline underline-offset-2 decoration-ink/30 disabled:opacity-60';

export default function ListingDescription({ id, text, lang, pClass }) {
  const t = T[lang] || T.es;
  const [done, setDone] = useState({});       // lang → translated text
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [original, setOriginal] = useState(false);
  const translated = done[lang];
  const showTranslation = !!translated && !original;
  const offer = guessLang(text) !== lang;

  const translate = async () => {
    if (translated) { setOriginal(false); return; }
    setBusy(true); setErr(false);
    try {
      const r = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, target: lang }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.text) throw new Error('failed');
      setDone((m) => ({ ...m, [lang]: j.text }));
      setOriginal(false);
      track('description_translated', { property_id: id, target: lang });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {split(showTranslation ? translated : text).map((p, i) => <p key={i} className={pClass}>{p}</p>)}
      {offer && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] max-w-[62ch]">
          {showTranslation ? (
            <>
              <span className="text-ink/50">{t.note} ·</span>
              <button type="button" onClick={() => setOriginal(true)} className={linkCls}>{t.original}</button>
            </>
          ) : (
            <button type="button" onClick={translate} disabled={busy} className={linkCls}>
              {busy ? t.busy : translated ? t.again : t.btn}
            </button>
          )}
          {err && <span className="text-red-600" role="alert">{t.err}</span>}
        </div>
      )}
    </div>
  );
}
