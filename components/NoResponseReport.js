'use client';
// "No-Response report" — small section below the WhatsApp contact card. A
// buyer who messaged/called a seller and got no reply can file a report,
// persisted in public.listing_reports so admin can see which seller ignored
// which buyer. Works for both logged-in buyers (identity attached
// server-side) and anonymous buyers (name + contact typed here). Bilingual,
// no emojis — matches the brand's ink/paper palette.
import { useState } from 'react';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';
import { track } from '@/lib/analytics';

const T = {
  es: {
    trigger: '¿El publicador no responde? Reportalo',
    heading: 'Reportar publicador sin respuesta',
    intro: 'Si le escribiste por WhatsApp o llamaste y no obtuviste respuesta, avisanos y revisamos este aviso.',
    namePh: 'Tu nombre',
    contactPh: 'Tu WhatsApp, teléfono o email',
    msgPh: 'Contanos qué pasó (opcional)',
    submit: 'Enviar reporte',
    sending: 'Enviando…',
    sent: 'Gracias — recibimos tu reporte y lo vamos a revisar.',
    error: 'No pudimos enviar el reporte. Probá de nuevo.',
    contactReq: 'Dejanos un contacto para poder seguir el caso.',
    cancel: 'Cancelar',
  },
  en: {
    trigger: 'Publisher not responding? Report it',
    heading: 'Report an unresponsive publisher',
    intro: "If you messaged on WhatsApp or called and got no reply, let us know and we'll review this listing.",
    namePh: 'Your name',
    contactPh: 'Your WhatsApp, phone or email',
    msgPh: 'Tell us what happened (optional)',
    submit: 'Send report',
    sending: 'Sending…',
    sent: "Thanks — we got your report and will review it.",
    error: "We couldn't send the report. Please try again.",
    contactReq: 'Leave a contact so we can follow up.',
    cancel: 'Cancel',
  },
};

export default function NoResponseReport({ propertyId, listingRef, sellerName, sellerPhone }) {
  const [lang] = useLang();
  const { user } = useAuth() || {};
  const t = T[lang] || T.es;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [fieldError, setFieldError] = useState('');

  const openForm = () => {
    setOpen(true);
    if (!name && user?.full_name) setName(user.full_name);
    if (!contact && user?.email) setContact(user.email);
  };

  const submit = async (e) => {
    e.preventDefault();
    const contactVal = (contact || user?.email || '').trim();
    if (!contactVal) {
      setFieldError(t.contactReq);
      return;
    }
    setFieldError('');
    setStatus('sending');
    track('report_unresponsive', { ref: listingRef });
    try {
      const res = await fetch('/api/report-unresponsive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          listing_ref: listingRef,
          reporter_name: (name || user?.full_name || '').trim(),
          reporter_contact: contactVal,
          message,
          seller_name: sellerName,
          seller_phone: sellerPhone,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="mt-3.5 px-4 py-3.5 border border-ink/15 rounded-[16px] bg-card">
        <p className="text-[13px] text-ink/80 m-0">{t.sent}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="mt-3.5 font-mono text-[11.5px] tracking-[.01em] text-ink/55 hover:text-ink/80 transition-colors underline underline-offset-2 decoration-ink/25"
      >
        {t.trigger}
      </button>
    );
  }

  return (
    <div className="mt-3.5 px-4 py-4 border border-ink/15 rounded-[16px] bg-card">
      <h3 className="text-[14px] font-bold tracking-head m-0 mb-1">{t.heading}</h3>
      <p className="text-[12.5px] leading-[1.5] text-ink/60 m-0 mb-3">{t.intro}</p>

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePh}
          maxLength={120}
          className="w-full px-3 py-2.5 text-[13px] border border-ink/20 rounded-[10px] bg-paper text-ink placeholder:text-ink/40 focus:outline-none focus:border-ink/50"
        />
        <input
          type="text"
          value={contact}
          onChange={(e) => { setContact(e.target.value); if (fieldError) setFieldError(''); }}
          placeholder={t.contactPh}
          maxLength={160}
          required
          className="w-full px-3 py-2.5 text-[13px] border border-ink/20 rounded-[10px] bg-paper text-ink placeholder:text-ink/40 focus:outline-none focus:border-ink/50"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.msgPh}
          maxLength={2000}
          rows={3}
          className="w-full px-3 py-2.5 text-[13px] leading-[1.5] border border-ink/20 rounded-[10px] bg-paper text-ink placeholder:text-ink/40 focus:outline-none focus:border-ink/50 resize-none"
        />

        {fieldError && <p className="text-[12px] text-red-600 m-0">{fieldError}</p>}
        {status === 'error' && <p className="text-[12px] text-red-600 m-0">{t.error}</p>}

        <div className="flex items-center gap-3 mt-1">
          <button
            type="submit"
            disabled={status === 'sending'}
            className="inline-flex items-center h-[36px] px-[16px] rounded-pill text-[12.5px] font-semibold bg-ink text-paper disabled:opacity-60"
          >
            {status === 'sending' ? t.sending : t.submit}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setStatus('idle'); setFieldError(''); }}
            className="text-[12.5px] font-medium text-ink/55 hover:text-ink/80 transition-colors"
          >
            {t.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
