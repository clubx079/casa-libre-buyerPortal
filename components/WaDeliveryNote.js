'use client';
// Shown under a "we sent you a code by WhatsApp" step: asks /api/auth/whatsapp/delivery a few
// times and, when Meta refused the code because that number has no WhatsApp, says so plainly
// (Nov 23: a seller waited for codes that could never arrive). Renders nothing otherwise.
import { useEffect, useState } from 'react';

const T = {
  es: { no: 'Este número no tiene WhatsApp, por eso el código no llega. Usá un número con WhatsApp activo.', failed: 'No pudimos entregar el código por WhatsApp. Revisá el número o probá de nuevo en unos minutos.' },
  en: { no: 'This number has no WhatsApp, so the code can’t arrive. Use a number with WhatsApp.', failed: 'We couldn’t deliver the code on WhatsApp. Check the number or try again in a few minutes.' },
  pt: { no: 'Este número não tem WhatsApp, por isso o código não chega. Use um número com WhatsApp ativo.', failed: 'Não conseguimos entregar o código pelo WhatsApp. Confira o número ou tente de novo em alguns minutos.' },
};
const WAITS = [4000, 8000, 14000, 25000, 40000];

export default function WaDeliveryNote({ phone, sentAt, lang = 'es', className = '' }) {
  const [state, setState] = useState('pending');
  useEffect(() => {
    setState('pending');
    if (!phone || !sentAt) return undefined;
    let stop = false; const timers = [];
    for (const ms of WAITS) {
      timers.push(setTimeout(async () => {
        if (stop) return;
        try {
          const j = await fetch(`/api/auth/whatsapp/delivery?phone=${encodeURIComponent(phone)}&since=${sentAt}`, { cache: 'no-store' }).then((r) => r.json());
          if (!stop && j?.state && j.state !== 'pending') { setState(j.state); stop = true; }
        } catch { /* keep waiting */ }
      }, ms));
    }
    return () => { stop = true; timers.forEach(clearTimeout); };
  }, [phone, sentAt]);
  if (state !== 'no_whatsapp' && state !== 'failed') return null;
  const t = T[lang] || T.es;
  return (
    <p role="alert" data-testid="wa-delivery-note" className={`text-[13px] font-medium text-[#B23A3A] bg-[#FDF1F1] border border-[#F3D4D4] rounded-[12px] px-3.5 py-2.5 ${className}`}>
      {state === 'no_whatsapp' ? t.no : t.failed}
    </p>
  );
}
