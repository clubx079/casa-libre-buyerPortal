'use client';
// Mi cuenta → "Tu foto de perfil": upload, see, replace or remove the seller's photo.
// Every upload is saved at once and checked by the AI (/api/account/profile-photo,
// lib/profilePhoto.js): checking → approved | rejected. While a new photo is checked or
// after it was rejected, the approved one (if any) keeps showing on the listings. While
// checking, the card asks again every 4 s (like My listings' "Checking photos…" chip).
import { useEffect, useRef, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import { useLang } from '@/lib/useLang';

const T = {
  es: {
    title: 'Tu foto de perfil',
    intro: 'Los compradores confían más cuando ven quién vende. Tu foto aparece en todas tus publicaciones, junto a tu nombre.',
    rules: 'Tiene que ser una foto real de tu cara: solo vos, de frente y bien visible. No se aceptan logos, dibujos, mascotas ni fotos de la casa.',
    upload: 'Subir foto', replace: 'Cambiar foto', another: 'Subir otra foto', remove: 'Quitar foto', removing: 'Quitando…', uploading: 'Subiendo…',
    checking: 'Estamos revisando tu foto', checkingSub: 'Tarda unos segundos. Podés seguir usando el sitio.',
    checkingKeep: 'Mientras tanto se sigue mostrando tu foto actual.',
    approved: 'Tu foto fue aprobada y ya se muestra en tus publicaciones',
    rejected: 'Tu foto no fue aprobada', rejectedKeep: 'Se sigue mostrando tu foto anterior.',
    none: 'Todavía no tenés foto de perfil.', current: 'Foto actual', newOne: 'Foto nueva', inReview: 'En revisión', notApproved: 'No aprobada',
    confirmRemove: 'Deja de mostrarse en tus publicaciones. Podés subir otra cuando quieras.',
    removeTitle: '¿Quitar tu foto de perfil?', removeYes: 'Sí, quitar', cancel: 'Cancelar',
    errTooLarge: 'La foto es muy pesada (máximo 15 MB).', errType: 'Ese archivo no es una foto. Probá con JPG o PNG.',
    errMany: 'Subiste muchas fotos seguidas. Probá de nuevo en unos minutos.', errSetup: 'Esta función todavía no está disponible.',
    err: 'Algo salió mal. Intentá de nuevo.',
  },
  en: {
    title: 'Your profile photo',
    intro: 'Buyers trust a seller more when they can see who is selling. Your photo shows on all your listings, next to your name.',
    rules: 'It must be a real photo of your face: just you, from the front and clearly visible. Logos, drawings, pets and house photos are not accepted.',
    upload: 'Upload photo', replace: 'Change photo', another: 'Upload another photo', remove: 'Remove photo', removing: 'Removing…', uploading: 'Uploading…',
    checking: "We're checking your photo", checkingSub: 'It takes a few seconds. You can keep using the site.',
    checkingKeep: 'Meanwhile your current photo keeps showing.',
    approved: 'Your photo was approved and now shows on your listings',
    rejected: 'Your photo was not approved', rejectedKeep: 'Your previous photo keeps showing.',
    none: "You don't have a profile photo yet.", current: 'Current photo', newOne: 'New photo', inReview: 'In review', notApproved: 'Not approved',
    confirmRemove: 'It will stop showing on your listings. You can upload another one any time.',
    removeTitle: 'Remove your profile photo?', removeYes: 'Yes, remove', cancel: 'Cancel',
    errTooLarge: 'The photo is too large (15 MB max).', errType: "That file isn't a photo. Try a JPG or PNG.",
    errMany: 'You uploaded many photos in a row. Try again in a few minutes.', errSetup: 'This feature is not available yet.',
    err: 'Something went wrong. Try again.',
  },
};

const ERR = { too_large: 'errTooLarge', unreadable_image: 'errType', not_an_image: 'errType', too_many: 'errMany', not_set_up: 'errSetup' };

function Avatar({ src, label, tone = 'ok', size = 96 }) {
  const ring = tone === 'bad' ? 'border-red-400' : tone === 'wait' ? 'border-ink/30 border-dashed' : 'border-ink';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`rounded-full overflow-hidden border-[2px] ${ring} bg-paper flex items-center justify-center`} style={{ width: size, height: size }}>
        {src
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" className={`w-full h-full object-cover ${tone === 'bad' ? 'opacity-60' : ''}`} />
          : <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink/30" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>}
      </div>
      {label && <span className={`text-[11px] font-semibold ${tone === 'bad' ? 'text-red-700' : 'text-ink/50'}`}>{label}</span>}
    </div>
  );
}

export default function ProfilePhotoCard() {
  const [lang] = useLang();
  const t = T[lang] || T.es;
  const [v, setV] = useState(null);        // ownerView from the API
  const [busy, setBusy] = useState(null);  // 'upload' | 'remove'
  const [err, setErr] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [askRemove, setAskRemove] = useState(false);
  const fileRef = useRef(null);
  const polls = useRef(0);

  const load = () => fetch(`/api/account/profile-photo?lang=${lang}`).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (r.status === 503 && j.error === 'not_set_up') { setHidden(true); return; }
    if (r.ok) setV(j);
  }).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lang]);

  // While checking: ask again every 4 s, for up to ~3 minutes.
  useEffect(() => {
    if (v?.status !== 'checking' || polls.current >= 45) return undefined;
    const id = setTimeout(() => { polls.current += 1; load(); }, 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  const pick = () => { setErr(null); fileRef.current?.click(); };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setErr(t.errTooLarge); return; }
    setBusy('upload'); setErr(null);
    try {
      const fd = new FormData(); fd.set('photo', f);
      const r = await fetch(`/api/account/profile-photo?lang=${lang}`, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(t[ERR[j.error]] || t.err); return; }
      polls.current = 0;
      setV(j);
    } catch { setErr(t.err); } finally { setBusy(null); }
  };
  const removePhoto = async () => {
    setBusy('remove'); setErr(null);
    try {
      const r = await fetch(`/api/account/profile-photo?lang=${lang}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(t.err); return; }
      setV(j);
    } catch { setErr(t.err); } finally { setBusy(null); setAskRemove(false); }
  };

  if (hidden) return null;
  const st = v?.status || null;
  const hasAny = !!(v?.photo || v?.pending);

  return (
    <section id="foto" className="bg-card border border-ink/15 rounded-card p-5 sm:p-6 mb-8 scroll-mt-24" data-testid="profile-photo-card" data-status={st || 'none'}>
      <h2 className="text-[17px] font-bold tracking-head">{t.title}</h2>
      <p className="text-[13.5px] text-ink/60 mt-1 mb-4 max-w-[560px]">{t.intro}</p>

      <div className="flex flex-col sm:flex-row sm:items-start gap-5">
        <div className="flex gap-4 shrink-0">
          {v === null
            ? <div className="w-24 h-24 rounded-full bg-ink/5 animate-pulse" />
            : <>
                {(v.photo || !v.pending) && <Avatar src={v.photo} label={v.pending ? t.current : null} />}
                {v.pending && <Avatar src={v.pending} label={st === 'rejected' ? t.notApproved : t.inReview} tone={st === 'rejected' ? 'bad' : 'wait'} />}
              </>}
        </div>

        <div className="flex-1 min-w-0">
          {st === 'checking' && (
            <div className="rounded-[12px] border-[1.5px] border-ink/20 bg-paper px-4 py-3" data-testid="profile-photo-checking">
              <div className="flex items-center gap-2 text-[14px] font-bold">
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-ink/25 border-t-ink animate-spin" aria-hidden="true" />
                {t.checking}
              </div>
              <p className="text-[12.5px] text-ink/60 mt-1">{t.checkingSub}{v.photo ? ` ${t.checkingKeep}` : ''}</p>
            </div>
          )}
          {st === 'rejected' && (
            <div className="rounded-[12px] border-[1.5px] border-red-200 bg-red-50 px-4 py-3" data-testid="profile-photo-rejected">
              <div className="text-[14px] font-bold text-red-800">{t.rejected}</div>
              <p className="text-[13px] text-red-700 mt-1" data-testid="profile-photo-reason">{v.reason}</p>
              {v.photo && <p className="text-[12px] text-ink/55 mt-1">{t.rejectedKeep}</p>}
            </div>
          )}
          {!st && v && <p className="text-[13.5px] text-ink/60">{t.none}</p>}

          {/* Once the photo is approved the card stays clean: just the photo and the buttons. */}
          {st !== 'approved' && <p className="text-[12px] text-ink/50 mt-3 max-w-[520px]">{t.rules}</p>}

          <div className="flex flex-wrap gap-2.5 mt-4">
            <button type="button" onClick={pick} disabled={!!busy || v === null} className="px-5 py-2.5 rounded-pill bg-ink text-paper text-[13.5px] font-bold shadow-hard-soft disabled:opacity-60" data-testid="profile-photo-upload">
              {busy === 'upload' ? t.uploading : st === 'rejected' ? t.another : hasAny ? t.replace : t.upload}
            </button>
            {hasAny && (
              <button type="button" onClick={() => { setErr(null); setAskRemove(true); }} disabled={!!busy} className="px-5 py-2.5 rounded-pill border-[1.5px] border-red-300 text-red-700 text-[13.5px] font-semibold disabled:opacity-60" data-testid="profile-photo-remove">
                {busy === 'remove' ? t.removing : t.remove}
              </button>
            )}
          </div>
          {err && <div className="mt-3 text-[13px] font-medium rounded-[10px] px-3.5 py-2.5 text-red-700 bg-red-50 border border-red-200">{err}</div>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
        </div>
      </div>
      <ConfirmModal
        open={askRemove}
        title={t.removeTitle}
        message={t.confirmRemove}
        confirmLabel={busy === 'remove' ? '…' : t.removeYes}
        cancelLabel={t.cancel}
        danger
        busy={busy === 'remove'}
        onConfirm={removePhoto}
        onCancel={() => setAskRemove(false)}
      />
    </section>
  );
}
