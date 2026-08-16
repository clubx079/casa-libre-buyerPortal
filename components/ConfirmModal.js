'use client';
import { useEffect } from 'react';

// Branded confirmation dialog. Labels are passed in by the caller (bilingual).
export default function ConfirmModal({ open, title, message, confirmLabel, cancelLabel = 'Cancelar', danger = false, busy = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-[400px] bg-paper border-[1.5px] border-ink rounded-[22px] shadow-hard p-7">
        <h3 className="text-[20px] font-bold tracking-head leading-tight mb-2">{title}</h3>
        {message && <p className="text-[14px] text-ink/60 mb-6">{message}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={busy} className="px-5 py-2.5 rounded-pill border-[1.5px] border-ink/30 font-semibold text-[14px] disabled:opacity-50">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={busy} className={`px-6 py-2.5 rounded-pill font-bold text-[14px] shadow-hard-soft disabled:opacity-60 ${danger ? 'bg-red-600 text-white' : 'bg-ink text-paper'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
