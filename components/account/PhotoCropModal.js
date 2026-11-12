'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Crop step for the profile photo: the chosen image sits behind a round frame; the user drags
// it into place and zooms (slider, mouse wheel or pinch), then we cut that square on a canvas
// and hand back a JPEG blob. Only the cropped square is uploaded and checked, so the round
// avatar on the listings shows exactly what the user framed here.
const VIEW = 300;   // size of the crop area on screen (px)
const OUT = 800;    // size of the exported square (px); the server keeps at most 800px
const MAX_ZOOM = 4;

export default function PhotoCropModal({ open, src, fallbackSrc = null, t, busy = false, onCancel, onSave }) {
  const [shown, setShown] = useState(src);
  const [img, setImg] = useState(null);         // { el, w, h }
  const [zoom, setZoom] = useState(1);          // 1 = the image just covers the circle
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset of the image centre from the frame centre (px)
  const drag = useRef(null);
  const pointers = useRef(new Map());

  useEffect(() => {
    if (!open || !src) { setImg(null); return; }
    let cancelled = false;
    const tryLoad = (u, next) => {
      const el = new Image();
      el.onload = () => { if (cancelled) return; setShown(u); setImg({ el, w: el.naturalWidth, h: el.naturalHeight }); setZoom(1); setPos({ x: 0, y: 0 }); };
      el.onerror = () => { if (!cancelled && next) tryLoad(next, null); };
      el.src = u;
    };
    setImg(null);
    tryLoad(src, fallbackSrc);
    return () => { cancelled = true; };
  }, [open, src, fallbackSrc]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  // Scale that makes the image cover the frame, times the zoom.
  const scale = img ? Math.max(VIEW / img.w, VIEW / img.h) * zoom : 1;
  // Keep the frame always covered: the image may not move past its own edges.
  const clamp = useCallback((p, s = scale) => {
    if (!img) return p;
    const mx = Math.max(0, (img.w * s - VIEW) / 2);
    const my = Math.max(0, (img.h * s - VIEW) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  }, [img, scale]);

  const setZoomClamped = (z) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    if (!img) return setZoom(nz);
    const ns = Math.max(VIEW / img.w, VIEW / img.h) * nz;
    setZoom(nz);
    setPos((p) => clamp({ x: p.x * (ns / scale), y: p.y * (ns / scale) }, ns));
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { x: e.clientX, y: e.clientY, start: pos, dist: null, zoom };
  };
  const onPointerMove = (e) => {
    if (!drag.current || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {             // pinch to zoom
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (drag.current.dist == null) { drag.current.dist = d; drag.current.zoom = zoom; return; }
      setZoomClamped(drag.current.zoom * (d / drag.current.dist));
      return;
    }
    const { x, y, start } = drag.current;
    setPos(clamp({ x: start.x + (e.clientX - x), y: start.y + (e.clientY - y) }));
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) drag.current = null;
    else drag.current = { ...drag.current, dist: null, start: pos, x: e.clientX, y: e.clientY };
  };
  const onWheel = (e) => { setZoomClamped(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); };

  const save = () => {
    if (!img || busy) return;
    // The visible square, in image pixels.
    const side = VIEW / scale;
    const sx = img.w / 2 - pos.x / scale - side / 2;
    const sy = img.h / 2 - pos.y / scale - side / 2;
    const size = Math.min(OUT, Math.round(side));          // never upscale a small crop
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.el, sx, sy, side, side, 0, 0, size, size);
    c.toBlob((b) => { if (b) onSave?.(b); }, 'image/jpeg', 0.92);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t.cropTitle}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => !busy && onCancel?.()} />
      <div className="relative w-full max-w-[400px] bg-paper border-[1.5px] border-ink rounded-[22px] shadow-hard p-6 sm:p-7">
        <h3 className="text-[20px] font-bold tracking-head leading-tight">{t.cropTitle}</h3>
        <p className="text-[13.5px] text-ink/60 mt-1 mb-5">{t.cropHint}</p>

        <div
          className="relative mx-auto overflow-hidden rounded-[16px] bg-ink/90 touch-none select-none cursor-grab active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW, maxWidth: '100%' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onWheel={onWheel}
          data-testid="photo-crop-area"
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown} alt="" draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{ width: img.w * scale, height: img.h * scale, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="inline-block w-6 h-6 rounded-full border-2 border-paper/30 border-t-paper animate-spin" aria-hidden="true" />
            </div>
          )}
          {/* the round frame: everything outside it is dimmed */}
          <div className="absolute inset-0 pointer-events-none rounded-full" style={{ boxShadow: '0 0 0 9999px rgba(20,20,20,0.55)', border: '2px solid rgba(255,255,255,0.9)' }} />
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button type="button" onClick={() => setZoomClamped(zoom / 1.2)} disabled={!img || busy} className="w-9 h-9 rounded-full border-[1.5px] border-ink/30 text-[18px] font-bold leading-none disabled:opacity-40" aria-label={t.zoomOut}>−</button>
          <input
            type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom}
            onChange={(e) => setZoomClamped(Number(e.target.value))}
            disabled={!img || busy}
            className="flex-1 accent-ink" aria-label={t.zoom}
          />
          <button type="button" onClick={() => setZoomClamped(zoom * 1.2)} disabled={!img || busy} className="w-9 h-9 rounded-full border-[1.5px] border-ink/30 text-[18px] font-bold leading-none disabled:opacity-40" aria-label={t.zoomIn}>+</button>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 rounded-pill border-[1.5px] border-ink/30 font-semibold text-[14px] disabled:opacity-50">{t.cancel}</button>
          <button type="button" onClick={save} disabled={!img || busy} className="px-6 py-2.5 rounded-pill bg-ink text-paper font-bold text-[14px] shadow-hard-soft disabled:opacity-60" data-testid="photo-crop-save">
            {busy ? t.uploading : t.cropSave}
          </button>
        </div>
      </div>
    </div>
  );
}
