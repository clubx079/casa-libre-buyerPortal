'use client';
// "Fix photos" (My listings → Rejected): the listing's photos with the ones the AI check
// didn't accept marked in red. The seller removes those, adds new ones and submits again
// → the listing goes back to "Checking photos…" (POST /api/account/listings/photos).
import { useEffect, useRef, useState } from 'react';

const MAX = 20;
const T = {
  es: {
    title: 'Cambiar fotos', why: 'Algunas fotos pueden tener contenido para adultos (+18), dañino, ofensivo o sin relación con la propiedad.',
    hint: 'Quitá las fotos marcadas en rojo y agregá otras.', bad: 'No aceptada', cover: 'Portada', add: 'Agregar fotos',
    cancel: 'Cancelar', submit: 'Enviar de nuevo', sending: 'Enviando…', removeBad: 'Primero quitá las fotos marcadas en rojo.', fail: 'No se pudo enviar. Probá de nuevo.', loading: 'Cargando fotos…',
  },
  en: {
    title: 'Fix photos', why: 'Some photos may show 18+, harmful, abusive or unrelated content.',
    hint: 'Remove the photos marked in red and add others.', bad: 'Not accepted', cover: 'Cover', add: 'Add photos',
    cancel: 'Cancel', submit: 'Submit again', sending: 'Sending…', removeBad: 'Remove the photos marked in red first.', fail: "Couldn't send. Please try again.", loading: 'Loading photos…',
  },
};

export default function FixPhotosModal({ listing, lang, onClose, onDone }) {
  const t = T[lang] || T.es;
  const [items, setItems] = useState(null);   // [{ key, url, bad } | { file, url }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const made = useRef([]);   // object URLs to release

  useEffect(() => {
    fetch(`/api/account/listings/photos?id=${encodeURIComponent(listing.id)}`).then((r) => r.json())
      .then((j) => setItems((j.photos || []).map((p) => ({ key: p.key, url: p.url, bad: p.verdict === 'fail' }))))
      .catch(() => setItems([]));
    return () => made.current.forEach((u) => URL.revokeObjectURL(u));
  }, [listing.id]);

  const addFiles = (list) => {
    const fresh = [...list].filter((f) => f.type.startsWith('image/')).map((file) => {
      const url = URL.createObjectURL(file); made.current.push(url);
      return { file, url };
    });
    setItems((cur) => [...(cur || []), ...fresh].slice(0, MAX));
    setErr('');
  };
  const removeAt = (i) => { setItems((cur) => cur.filter((_, k) => k !== i)); setErr(''); };

  const submit = async () => {
    if (items.some((x) => x.bad)) { setErr(t.removeBad); return; }
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.set('id', listing.id);
    const order = [];
    items.forEach((x) => {
      if (x.key) order.push({ key: x.key });
      else { order.push({ file: fd.getAll('photos').length }); fd.append('photos', x.file, x.file.name); }
    });
    fd.set('order', JSON.stringify(order));
    try {
      const r = await fetch('/api/account/listings/photos', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(String(r.status));
      onDone();
    } catch { setErr(t.fail); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-ink/40 flex items-end sm:items-center justify-center" onClick={busy ? undefined : onClose}>
      <div className="bg-paper w-full sm:max-w-[620px] max-h-[92vh] overflow-y-auto rounded-t-[22px] sm:rounded-card p-5 sm:p-6" onClick={(e) => e.stopPropagation()} data-testid="fix-photos">
        <h2 className="text-[22px] font-bold tracking-head">{t.title}</h2>
        {listing.label && <p className="text-[13px] text-ink/55 mt-0.5">{listing.label}</p>}
        <p className="text-[13.5px] text-red-700 mt-3">{t.why}</p>
        <p className="text-[13px] text-ink/60 mt-1">{t.hint}</p>

        {items === null ? (
          <div className="py-10 text-center font-mono text-[12px] text-ink/45">{t.loading}</div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            {items.map((x, i) => (
              <div key={x.key || x.url} className={`relative aspect-square rounded-[12px] overflow-hidden bg-card ${x.bad ? 'ring-[3px] ring-red-500' : 'border border-ink/15'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.url} alt="" className={`w-full h-full object-cover ${x.bad ? 'opacity-60' : ''}`} />
                {x.bad && <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-pill">{t.bad}</span>}
                {!x.bad && i === 0 && <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-ink text-paper px-2 py-0.5 rounded-pill">{t.cover}</span>}
                <button type="button" onClick={() => removeAt(i)} disabled={busy} aria-label="remove" className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-paper/95 text-ink text-[15px] leading-none flex items-center justify-center shadow">×</button>
              </div>
            ))}
            {items.length < MAX && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="aspect-square rounded-[12px] border-[1.5px] border-dashed border-ink/35 text-[13px] font-semibold text-ink/70 flex flex-col items-center justify-center gap-1">
                <span className="text-[22px] leading-none">+</span>{t.add}
              </button>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files || []); e.target.value = ''; }} />

        {err && <p className="text-[13px] text-red-700 mt-3">{err}</p>}
        <div className="flex gap-2.5 mt-5">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 py-3 rounded-pill border-[1.5px] border-ink text-[14px] font-semibold">{t.cancel}</button>
          <button type="button" onClick={submit} disabled={busy || items === null} className="flex-[2] py-3 rounded-pill bg-ink text-paper text-[14px] font-bold disabled:opacity-60">{busy ? t.sending : t.submit}</button>
        </div>
      </div>
    </div>
  );
}
