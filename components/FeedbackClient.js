'use client';
// Feedback page — 5-star rating + message, opened from the CTA in the welcome /
// listing emails (…/feedback?src=…). Prefills name/email from the session when
// logged in. Brand: ink/paper, Space Grotesk, pill button, no emojis.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useAuth } from '@/components/AuthProvider';

const T = {
  es: {
    cta: 'Publicar gratis',
    kicker: 'Tu opinión',
    h1: <>Contanos qué te parece <em>Casa Libre</em></>,
    sub: 'Tu opinión nos ayuda a mejorar. Toma menos de un minuto.',
    rate: '¿Cómo calificarías tu experiencia?',
    name: 'Tu nombre (opcional)', email: 'Tu email (opcional)',
    msgLabel: 'Tu comentario',
    msgPh: 'Contanos qué te gustó o qué podríamos mejorar…',
    send: 'Enviar opinión', sending: 'Enviando…',
    needRating: 'Elegí una calificación de 1 a 5 estrellas.',
    sentH: '¡Gracias por tu opinión!', sentSub: 'La recibimos y nos ayuda a mejorar Casa Libre.',
    back: 'Volver al inicio',
  },
  en: {
    cta: 'List for free',
    kicker: 'Your feedback',
    h1: <>Tell us what you think of <em>Casa Libre</em></>,
    sub: 'Your feedback helps us improve. Takes under a minute.',
    rate: 'How would you rate your experience?',
    name: 'Your name (optional)', email: 'Your email (optional)',
    msgLabel: 'Your comment',
    msgPh: 'Tell us what you liked or what we could improve…',
    send: 'Send feedback', sending: 'Sending…',
    needRating: 'Pick a rating from 1 to 5 stars.',
    sentH: 'Thanks for your feedback!', sentSub: 'We got it — it helps us make Casa Libre better.',
    back: 'Back to home',
  },
};

const Star = ({ filled, onClick, onEnter, onLeave }) => (
  <button type="button" onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave} aria-label="star"
    className="p-1 transition-transform hover:scale-110">
    <svg viewBox="0 0 24 24" width="34" height="34" fill={filled ? '#111111' : 'none'} stroke="#111111" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.06 1.1-6.47L2.6 9.9l6.5-.95L12 2.5z" />
    </svg>
  </button>
);

export default function FeedbackClient() {
  const [lang, setLang] = useLang();
  const { user } = useAuth() || {};
  const t = T[lang] || T.es;

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [src, setSrc] = useState('site');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [err, setErr] = useState('');

  // Prefill from session + read ?src / ?e from the email link.
  useEffect(() => {
    if (user?.full_name) setName((n) => n || user.full_name);
    if (user?.email) setEmail((e) => e || user.email);
  }, [user]);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('src')) setSrc(p.get('src').slice(0, 40));
      const e = p.get('e');
      if (e) setEmail((cur) => cur || e);
    } catch { /* noop */ }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!(rating >= 1 && rating <= 5)) { setErr(t.needRating); return; }
    setErr('');
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, message: message.trim(), name: name.trim(), email: email.trim(), source: src }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('sent');
    } catch { setStatus('error'); }
  };

  const shown = hover || rating;

  return (
    <div className="bg-paper text-ink min-h-screen">
      <nav className="flex items-center justify-between flex-wrap gap-3 px-5 md:px-9 py-4 border-b border-ink/12">
        <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center h-[40px] border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((x) => (
              <button key={x} onClick={() => setLang(x)} className={`h-full flex items-center px-3 rounded-pill ${lang === x ? 'bg-ink text-paper' : 'text-ink/55'}`}>{x.toUpperCase()}</button>
            ))}
          </div>
          <Link href="/publicar" className="inline-flex items-center h-[40px] px-[22px] rounded-pill text-[14px] font-medium bg-ink text-paper">{t.cta}</Link>
        </div>
      </nav>

      <section className="max-w-[620px] mx-auto px-5 md:px-9 pt-12 md:pt-16 pb-20">
        <p className="font-mono text-[12px] tracking-[.12em] uppercase text-ink/55 mb-3">{t.kicker}</p>
        <h1 className="text-[clamp(28px,4vw,42px)] leading-[1.08] tracking-head font-bold mb-3 [&_em]:font-serif [&_em]:italic [&_em]:font-normal">{t.h1}</h1>
        <p className="text-[16px] text-ink/70 mb-8">{t.sub}</p>

        {status === 'sent' ? (
          <div className="bg-white border-[1.5px] border-ink rounded-[20px] shadow-[5px_4px_0_#111] p-8 text-center">
            <div className="flex justify-center gap-0.5 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} viewBox="0 0 24 24" width="22" height="22" fill={i <= rating ? '#111' : 'none'} stroke="#111" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.06 1.1-6.47L2.6 9.9l6.5-.95L12 2.5z" /></svg>
              ))}
            </div>
            <h2 className="text-[20px] font-bold tracking-head mb-1.5">{t.sentH}</h2>
            <p className="text-[14px] text-ink/65 mb-5">{t.sentSub}</p>
            <Link href="/" className="inline-flex items-center h-[42px] px-6 rounded-pill text-[14px] font-semibold bg-ink text-paper">{t.back}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white border-[1.5px] border-ink rounded-[20px] shadow-[5px_4px_0_#111] p-6 md:p-8">
            <p className="text-[14px] font-semibold mb-2">{t.rate}</p>
            <div className="flex items-center gap-1 mb-6" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} filled={i <= shown} onClick={() => setRating(i)} onEnter={() => setHover(i)} onLeave={() => setHover(0)} />
              ))}
              {rating > 0 && <span className="ml-2 font-mono text-[13px] text-ink/55">{rating}/5</span>}
            </div>

            <label className="block mb-4">
              <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.msgLabel}</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={t.msgPh} maxLength={2000}
                className="mt-1.5 w-full px-3.5 py-3 text-[15px] rounded-[12px] bg-paper text-ink border border-ink/45 outline-none focus:border-ink resize-y min-h-[100px] placeholder:text-ink/40" />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <label className="block">
                <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.name}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} type="text" maxLength={120}
                  className="mt-1.5 w-full px-3.5 py-3 text-[15px] rounded-[12px] bg-paper text-ink border border-ink/45 outline-none focus:border-ink" />
              </label>
              <label className="block">
                <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.email}</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={160}
                  className="mt-1.5 w-full px-3.5 py-3 text-[15px] rounded-[12px] bg-paper text-ink border border-ink/45 outline-none focus:border-ink" />
              </label>
            </div>

            {err && <p className="text-[13px] text-[#c0392b] mb-3">{err}</p>}
            {status === 'error' && <p className="text-[13px] text-[#c0392b] mb-3">{lang === 'es' ? 'No pudimos enviar tu opinión. Probá de nuevo.' : "We couldn't send your feedback. Please try again."}</p>}

            <button type="submit" disabled={status === 'sending'}
              className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-pill font-semibold text-[15px] bg-ink text-paper border-[1.5px] border-ink shadow-[4px_4px_0_rgba(17,17,17,.85)] disabled:opacity-60">
              {status === 'sending' ? t.sending : t.send}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
