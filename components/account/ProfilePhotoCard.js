'use client';
// Mi cuenta → "Tu foto de perfil": upload, see, replace or remove the seller's photo.
// Every upload is saved at once and checked by the AI (/api/account/profile-photo,
// lib/profilePhoto.js): checking → approved | rejected. While a new photo is checked or
// after it was rejected, the approved one (if any) keeps showing on the listings. While
// checking, the card asks again every 4 s (like My listings' "Checking photos…" chip).
import { useEffect, useRef, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import PhotoCropModal from './PhotoCropModal';
import { useLang } from '@/lib/useLang';
import { track } from '@/lib/analytics';

const T = {
  es: {
    title: 'Tu foto o logo de perfil',
    intro: 'Los compradores confían más cuando ven quién vende. Tu foto o el logo de tu inmobiliaria aparece en todas tus publicaciones, junto a tu nombre.',
    rules: 'Podés subir una foto tuya o el logo de tu empresa. No se aceptan imágenes para adultos, violentas u ofensivas, ni memes o capturas de pantalla.',
    upload: 'Subir foto', replace: 'Cambiar foto', another: 'Subir otra foto', remove: 'Quitar foto', removing: 'Quitando…', uploading: 'Subiendo…',
    checking: 'Estamos revisando tu foto', checkingSub: 'Tarda unos segundos. Podés seguir usando el sitio.',
    checkingKeep: 'Mientras tanto se sigue mostrando tu foto actual.',
    approved: 'Tu foto fue aprobada y ya se muestra en tus publicaciones',
    rejected: 'Tu foto no fue aprobada', rejectedKeep: 'Se sigue mostrando tu foto anterior.',
    none: 'Todavía no tenés foto de perfil.', current: 'Foto actual', newOne: 'Foto nueva', inReview: 'En revisión', notApproved: 'No aprobada',
    confirmRemove: 'Deja de mostrarse en tus publicaciones. Podés subir otra cuando quieras.',
    removeTitle: '¿Quitar tu foto de perfil?', removeYes: 'Sí, quitar', cancel: 'Cancelar',
    cropTitle: 'Ajustá tu foto', cropHint: 'Arrastrá la imagen y usá el zoom para que tu cara o tu logo quede dentro del círculo.', cropSave: 'Guardar foto', zoom: 'Zoom', zoomIn: 'Acercar', zoomOut: 'Alejar', recrop: 'Ajustar el recorte de tu foto', recropShort: 'Ajustar',
    errTooLarge: 'La foto es muy pesada (máximo 15 MB).', errType: 'Ese archivo no es una foto. Probá con JPG o PNG.',
    errMany: 'Subiste muchas fotos seguidas. Probá de nuevo en unos minutos.', errSetup: 'Esta función todavía no está disponible.',
    err: 'Algo salió mal. Intentá de nuevo.',
  },
  en: {
    title: 'Your profile photo or logo',
    intro: 'Buyers trust a seller more when they can see who is selling. Your photo or your agency logo shows on all your listings, next to your name.',
    rules: 'Upload a photo of yourself or your company logo. Adult, violent or offensive images, memes and screenshots are not accepted.',
    upload: 'Upload photo', replace: 'Change photo', another: 'Upload another photo', remove: 'Remove photo', removing: 'Removing…', uploading: 'Uploading…',
    checking: "We're checking your photo", checkingSub: 'It takes a few seconds. You can keep using the site.',
    checkingKeep: 'Meanwhile your current photo keeps showing.',
    approved: 'Your photo was approved and now shows on your listings',
    rejected: 'Your photo was not approved', rejectedKeep: 'Your previous photo keeps showing.',
    none: "You don't have a profile photo yet.", current: 'Current photo', newOne: 'New photo', inReview: 'In review', notApproved: 'Not approved',
    confirmRemove: 'It will stop showing on your listings. You can upload another one any time.',
    removeTitle: 'Remove your profile photo?', removeYes: 'Yes, remove', cancel: 'Cancel',
    cropTitle: 'Adjust your photo', cropHint: 'Drag the image and use the zoom so your face or your logo sits inside the circle.', cropSave: 'Save photo', zoom: 'Zoom', zoomIn: 'Zoom in', zoomOut: 'Zoom out', recrop: 'Adjust your photo crop', recropShort: 'Adjust',
    errTooLarge: 'The photo is too large (15 MB max).', errType: "That file isn't a photo. Try a JPG or PNG.",
    errMany: 'You uploaded many photos in a row. Try again in a few minutes.', errSetup: 'This feature is not available yet.',
    err: 'Something went wrong. Try again.',
  },
  pt: {
    title: 'Sua foto de perfil ou logo',
    intro: 'Os compradores confiam mais quando veem quem está vendendo. Sua foto ou o logo da sua imobiliária aparece em todos os seus anúncios, ao lado do seu nome.',
    rules: 'Envie uma foto sua ou o logo da sua empresa. Não aceitamos imagens adultas, violentas ou ofensivas, memes nem capturas de tela.',
    upload: 'Enviar foto', replace: 'Trocar foto', another: 'Enviar outra foto', remove: 'Remover foto', removing: 'Removendo…', uploading: 'Enviando…',
    checking: 'Estamos verificando sua foto', checkingSub: 'Leva alguns segundos. Você pode continuar usando o site.',
    checkingKeep: 'Enquanto isso, sua foto atual continua aparecendo.',
    approved: 'Sua foto foi aprovada e já aparece nos seus anúncios',
    rejected: 'Sua foto não foi aprovada', rejectedKeep: 'Sua foto anterior continua aparecendo.',
    none: 'Você ainda não tem foto de perfil.', current: 'Foto atual', newOne: 'Nova foto', inReview: 'Em análise', notApproved: 'Não aprovada',
    confirmRemove: 'Ela deixará de aparecer nos seus anúncios. Você pode enviar outra quando quiser.',
    removeTitle: 'Remover sua foto de perfil?', removeYes: 'Sim, remover', cancel: 'Cancelar',
    cropTitle: 'Ajuste sua foto', cropHint: 'Arraste a imagem e use o zoom para que seu rosto ou seu logo fique dentro do círculo.', cropSave: 'Salvar foto', zoom: 'Zoom', zoomIn: 'Aumentar zoom', zoomOut: 'Diminuir zoom', recrop: 'Ajustar o recorte da foto', recropShort: 'Ajustar',
    errTooLarge: 'A foto é grande demais (máx. 15 MB).', errType: 'Esse arquivo não é uma foto. Tente um JPG ou PNG.',
    errMany: 'Você enviou muitas fotos seguidas. Tente de novo em alguns minutos.', errSetup: 'Este recurso ainda não está disponível.',
    err: 'Algo deu errado. Tente novamente.',
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

// onView(v): told every time the photo state changes (Settings' completion bar counts the photo).
export default function ProfilePhotoCard({ onView } = {}) {
  const [lang] = useLang();
  const t = T[lang] || T.es;
  const [v, setV] = useState(null);        // ownerView from the API
  useEffect(() => { if (v && onView) onView(v); }, [v, onView]);
  const [busy, setBusy] = useState(null);  // 'upload' | 'remove'
  const [err, setErr] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [askRemove, setAskRemove] = useState(false);
  // The crop dialog: { src, fallback, file } — file = a newly picked photo (sent as the original too);
  // no file = re-cropping the current photo (the server reuses its stored original).
  const [crop, setCrop] = useState(null);
  const fileRef = useRef(null);
  const polls = useRef(0);
  // PostHog: photo upload started / succeeded (accepted, AI check running or done) / rejected
  // (the upload failed or the AI check turned it down) — Settings' Profile Personalization funnel.
  const uploading = useRef(false);
  useEffect(() => {
    if (!uploading.current || !v?.status || v.status === 'checking') return;
    uploading.current = false;
    if (v.status === 'rejected') track('profile_photo_rejected', { reason: v.category || null, stage: 'ai_check' });
    else if (v.status === 'approved') track('profile_photo_approved', {});
  }, [v]);

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
  const closeCrop = () => { if (crop?.file && crop.src) URL.revokeObjectURL(crop.src); setCrop(null); };
  const recrop = () => { if (v?.edit_src && !busy) { setErr(null); setCrop({ src: v.edit_src, fallback: v.edit_fallback, file: null }); } };
  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setErr(t.errTooLarge); return; }
    if (!/^image\//.test(f.type || '')) { setErr(t.errType); return; }
    setErr(null);
    setCrop({ src: URL.createObjectURL(f), fallback: null, file: f });   // the upload happens on "Save photo"
  };
  const upload = async (blob) => {
    setBusy('upload'); setErr(null);
    track('profile_photo_upload_started', { replace: !!v?.photo, recrop: !crop?.file });
    try {
      const fd = new FormData(); fd.set('photo', new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
      if (crop?.file) fd.set('original', crop.file); else fd.set('reuse', '1');
      const r = await fetch(`/api/account/profile-photo?lang=${lang}`, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { track('profile_photo_rejected', { reason: j.error || `http_${r.status}`, stage: 'upload' }); setErr(t[ERR[j.error]] || t.err); return; }
      track('profile_photo_upload_succeeded', { status: j.status || null });
      uploading.current = true;
      polls.current = 0;
      setV(j);
    } catch { track('profile_photo_rejected', { reason: 'network', stage: 'upload' }); setErr(t.err); } finally { setBusy(null); closeCrop(); }
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
                {(v.photo || !v.pending) && (v.photo && v.edit_src
                  ? <button type="button" onClick={recrop} disabled={!!busy} className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2" title={t.recrop} aria-label={t.recrop} data-testid="profile-photo-recrop">
                      <Avatar src={v.photo} label={v.pending ? t.current : null} />
                      <span className="pointer-events-none absolute left-0 top-0 w-24 h-24 rounded-full bg-ink/45 text-paper text-[12px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">{t.recropShort}</span>
                    </button>
                  : <Avatar src={v.photo} label={v.pending ? t.current : null} />)}
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
      <PhotoCropModal open={!!crop} src={crop?.src} fallbackSrc={crop?.fallback} t={t} busy={busy === 'upload'} onCancel={closeCrop} onSave={upload} />
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
