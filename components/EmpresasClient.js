'use client';
// "Empresas y profesionales" — the partner/business funnel landing page.
// Faithful port of the Casa Libre Business mockup: hero + value props + steps +
// inquiry form + side card + FAQ. Brand rules honored: ink/paper palette, green
// strictly for WhatsApp, no emojis, ES default + EN toggle, instant/free launch.
// The inquiry form POSTs to /api/partner-inquiries (lead capture).
import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';

// Placeholder test number until the real business WhatsApp line is set — the
// previous placeholder (595981000000) was a real person's number, so this is a
// harmless dummy. Replace with the real line when available.
const BIZ_WA = '00000000';

const T = {
  es: {
    tabs: [['Comprar', '/propiedades?op=venta'], ['Alquilar', '/propiedades?op=alquiler'], ['Vender', '/publicar']],
    cta: 'Publicar gratis',
    kicker: 'Empresas y profesionales',
    h1: <>Tu cartera, frente a todo el mercado. <em>Libremente.</em></>,
    lede: 'Casa Libre es el portal inmobiliario de más rápido crecimiento en Latam. Inmobiliarias, corredores y desarrolladores publican su cartera, reciben consultas directas por WhatsApp y no pagan nada durante el lanzamiento.',
    ctaForm: 'Quiero ser partner', ctaSite: 'Ver el portal',
    mQuote: '“Traé tu cartera. Nosotros traemos los compradores.”', mWho: 'Cuate, tu guía',
    aud: ['Inmobiliarias', 'Corredores', 'Desarrolladores', 'Agentes independientes', 'Administradores de alquileres'],
    props: [
      ['01', 'Leads directos, sin intermediarios', 'Cada aviso muestra tu contacto. Los interesados te escriben por WhatsApp o te llaman a vos — nunca vendemos tus leads ni nos metemos en el medio.'],
      ['02', 'Publicación instantánea', 'Cargás la propiedad y queda visible al instante. Sin esperas ni trámites: tu cartera completa, en línea hoy.'],
      ['03', 'Gratis durante el lanzamiento', 'Publicar no cuesta nada durante el lanzamiento. Sin comisiones sobre tus operaciones — tus negocios son tuyos.'],
      ['04', 'Visibilidad donde importa', 'Trabajamos para que quien busque propiedades en Paraguay nos encuentre primero en Google. Tu cartera crece con ese tráfico.'],
      ['05', 'Migración de tu cartera', '¿Tenés decenas o cientos de avisos? Te ayudamos a migrar tu inventario completo para que arranques con todo publicado.'],
      ['06', 'Datos que sirven', 'Sabé qué avisos generan contactos: cada toque de WhatsApp, llamada y número copiado queda registrado para tu análisis.'],
    ],
    stepsH: <>Cómo funciona, en <em>tres pasos</em></>,
    stepsSub: 'Del primer contacto a tu cartera publicada, sin vueltas.',
    steps: [
      ['1', 'Contanos de tu operación', 'Completá el formulario con tu tipo de negocio y el tamaño de tu cartera.'],
      ['2', 'Coordinamos la carga', 'Te contactamos por WhatsApp, definimos el mejor camino y migramos tus avisos.'],
      ['3', 'Recibí consultas directas', 'Tus propiedades quedan en línea al instante y los interesados te escriben a vos.'],
    ],
    formH: <>Consultas <em>comerciales</em></>,
    formSub: 'Contanos quién sos y te respondemos a la brevedad.',
    lType: 'Tipo de negocio', types: ['Inmobiliaria', 'Corredor / broker', 'Desarrollador', 'Agente independiente', 'Administrador de alquileres', 'Otro'],
    lSize: 'Tamaño de cartera', sizes: ['1–10 avisos', '11–50 avisos', '51–200 avisos', 'Más de 200 avisos'],
    lName: 'Nombre y apellido', lCompany: 'Empresa (opcional)', lPhone: 'WhatsApp / teléfono', lEmail: 'Email',
    lCity: 'Ciudad o zona donde operás', lMsg: 'Mensaje (opcional)',
    consent: 'Al enviar, aceptás que te contactemos por WhatsApp o email sobre tu consulta. Nada más — sin spam.',
    btnSubmit: 'Enviar consulta', sending: 'Enviando…',
    formNote: '[ respuesta típica: dentro del día hábil ]',
    sideH: 'Por qué conviene entrar ahora',
    side: ['Publicación gratuita durante todo el lanzamiento', 'Tu contacto en cada aviso — los leads son tuyos', 'Publicación instantánea, sin esperas', 'Ayuda para migrar carteras grandes'],
    sideH2: '¿Preferís hablar directo?', waLbl: 'Escribinos por WhatsApp',
    faqH: 'Preguntas frecuentes',
    faq: [
      ['¿Cuánto cuesta publicar?', 'Nada. Durante el lanzamiento, publicar en Casa Libre es gratis para empresas y profesionales, sin límite de avisos y sin comisiones sobre tus operaciones.'],
      ['¿Quién se queda con los leads?', 'Vos. Cada aviso muestra tu contacto y los interesados te escriben directo por WhatsApp o te llaman. No intermediamos ni revendemos consultas.'],
      ['¿Cuánto tarda en publicarse mi cartera?', 'La publicación es instantánea. Si tenés una cartera grande, coordinamos la migración para que todo tu inventario quede en línea de una.'],
      ['¿Necesito exclusividad?', 'No. Publicá en Casa Libre y donde quieras — no pedimos exclusividad.'],
      ['¿Cómo cargo muchas propiedades a la vez?', 'Escribinos con el tamaño de tu cartera y te proponemos el mejor camino de migración para tu caso.'],
    ],
    sent: 'Consulta enviada — te contactamos a la brevedad', err: 'Revisá los campos marcados',
    waMsg: (name) => '¡Hola! Quiero publicar mi cartera en Casa Libre.' + (name ? ' Soy ' + name.trim() + '.' : ''),
  },
  en: {
    tabs: [['Buy', '/propiedades?op=venta'], ['Rent', '/propiedades?op=alquiler'], ['Sell', '/publicar']],
    cta: 'List for free',
    kicker: 'Business and professionals',
    h1: <>Your portfolio, in front of the whole market. <em>Freely.</em></>,
    lede: 'Casa Libre is the fastest-growing real estate portal in Latam. Agencies, brokers and developers list their portfolio, get inquiries straight to their WhatsApp, and pay nothing during launch.',
    ctaForm: 'Become a partner', ctaSite: 'See the portal',
    mQuote: '“Bring your portfolio. We bring the buyers.”', mWho: 'Cuate, your guide',
    aud: ['Agencies', 'Brokers', 'Developers', 'Independent agents', 'Rental managers'],
    props: [
      ['01', 'Direct leads, no middlemen', 'Every listing shows your contact. Interested buyers message you on WhatsApp or call you — we never sell your leads or sit in the middle.'],
      ['02', 'Instant publishing', 'Upload a property and it goes live instantly. No waiting, no red tape: your full portfolio, online today.'],
      ['03', 'Free during launch', 'Listing costs nothing during launch. No commission on your deals — your business stays yours.'],
      ['04', 'Visibility where it counts', 'We work to be the first result when people search for property in Paraguay on Google. Your portfolio grows with that traffic.'],
      ['05', 'Portfolio migration', 'Dozens or hundreds of listings? We help you migrate your full inventory so you start with everything live.'],
      ['06', 'Data that works for you', 'Know which listings generate contacts: every WhatsApp tap, call and copied number is tracked for your analysis.'],
    ],
    stepsH: <>How it works, in <em>three steps</em></>,
    stepsSub: 'From first contact to your portfolio live, no runaround.',
    steps: [
      ['1', 'Tell us about your operation', 'Fill out the form with your business type and portfolio size.'],
      ['2', 'We coordinate the upload', 'We reach out on WhatsApp, agree the best path and migrate your listings.'],
      ['3', 'Get direct inquiries', 'Your properties go live instantly and buyers message you directly.'],
    ],
    formH: <>Business <em>inquiries</em></>,
    formSub: "Tell us who you are and we'll get back to you shortly.",
    lType: 'Business type', types: ['Real estate agency', 'Broker', 'Developer', 'Independent agent', 'Rental manager', 'Other'],
    lSize: 'Portfolio size', sizes: ['1–10 listings', '11–50 listings', '51–200 listings', '200+ listings'],
    lName: 'Full name', lCompany: 'Company (optional)', lPhone: 'WhatsApp / phone', lEmail: 'Email',
    lCity: 'City or area you operate in', lMsg: 'Message (optional)',
    consent: 'By submitting, you agree to be contacted by WhatsApp or email about your inquiry. Nothing else — no spam.',
    btnSubmit: 'Send inquiry', sending: 'Sending…',
    formNote: '[ typical response: within one business day ]',
    sideH: 'Why join now',
    side: ['Free listings for the entire launch', 'Your contact on every listing — the leads are yours', 'Instant publishing, no waiting', 'Help migrating large portfolios'],
    sideH2: 'Prefer to talk directly?', waLbl: 'Message us on WhatsApp',
    faqH: 'Frequently asked questions',
    faq: [
      ['How much does listing cost?', 'Nothing. During launch, listing on Casa Libre is free for businesses and professionals, with no listing limit and no commission on your deals.'],
      ['Who keeps the leads?', "You do. Every listing shows your contact and buyers message or call you directly. We don't intermediate or resell inquiries."],
      ['How long until my portfolio is live?', 'Publishing is instant. For large portfolios we coordinate a migration so your full inventory goes live in one move.'],
      ['Do you require exclusivity?', "No. List on Casa Libre and anywhere else you like — we don't ask for exclusivity."],
      ['How do I upload many properties at once?', "Message us with your portfolio size and we'll propose the best migration path for your case."],
    ],
    sent: "Inquiry sent — we'll be in touch shortly", err: 'Check the highlighted fields',
    // Outgoing WhatsApp is ALWAYS Spanish — the team and market are local.
    waMsg: (name) => '¡Hola! Quiero publicar mi cartera en Casa Libre.' + (name ? ' Soy ' + name.trim() + '.' : ''),
  },
};

const WaGlyph = () => (
  <svg viewBox="0 0 32 32" width="19" height="19" fill="currentColor" aria-hidden="true">
    <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.257.59 4.462 1.71 6.404L3.2 28.8l6.56-1.68a12.74 12.74 0 0 0 6.24 1.628h.005c7.058 0 12.795-5.74 12.795-12.8 0-3.42-1.33-6.633-3.75-9.05a12.72 12.72 0 0 0-9.046-3.698zm0 23.39h-.004a10.6 10.6 0 0 1-5.4-1.48l-.388-.23-3.893.997 1.04-3.795-.253-.39a10.58 10.58 0 0 1-1.63-5.692c0-5.87 4.78-10.646 10.653-10.646 2.845 0 5.518 1.11 7.53 3.122a10.58 10.58 0 0 1 3.117 7.53c0 5.87-4.78 10.645-10.645 10.645zm5.84-7.97c-.32-.16-1.893-.934-2.186-1.04-.293-.107-.507-.16-.72.16-.213.32-.826 1.04-1.013 1.253-.187.213-.373.24-.693.08-.32-.16-1.352-.498-2.575-1.588-.952-.85-1.594-1.898-1.781-2.218-.187-.32-.02-.494.14-.653.144-.144.32-.374.48-.56.16-.187.213-.32.32-.534.107-.213.054-.4-.026-.56-.08-.16-.72-1.737-.987-2.378-.26-.625-.524-.54-.72-.55l-.613-.01c-.213 0-.56.08-.853.4-.293.32-1.12 1.094-1.12 2.667 0 1.573 1.146 3.093 1.306 3.307.16.213 2.256 3.444 5.464 4.83.764.33 1.36.527 1.824.674.766.244 1.464.21 2.015.127.615-.092 1.893-.774 2.16-1.52.267-.747.267-1.387.187-1.52-.08-.134-.293-.214-.613-.374z" />
  </svg>
);

export default function EmpresasClient() {
  const [lang, setLang] = useLang();
  const t = T[lang] || T.es;
  const [form, setForm] = useState({ type: '', size: '', name: '', company: '', phone: '', email: '', city: '', message: '', web: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [bad, setBad] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const waHref = `https://wa.me/${BIZ_WA}?text=${encodeURIComponent(t.waMsg(form.name))}`;

  const submit = async (e) => {
    e.preventDefault();
    if (form.web) return; // honeypot
    const req = ['type', 'size', 'name', 'phone', 'email'];
    const nb = {};
    req.forEach((k) => {
      const empty = !String(form[k] || (k === 'type' ? t.types[0] : k === 'size' ? t.sizes[0] : '')).trim();
      const emailBad = k === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
      if ((k !== 'type' && k !== 'size' && empty) || emailBad) nb[k] = true;
    });
    setBad(nb);
    if (Object.keys(nb).length) { setStatus('error'); return; }
    setStatus('sending');
    try {
      const res = await fetch('/api/partner-inquiries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type || t.types[0], size: form.size || t.sizes[0], name: form.name.trim(),
          company: form.company.trim(), phone: form.phone.trim(), email: form.email.trim(),
          city: form.city.trim(), message: form.message.trim(), lang, source: 'empresas',
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('sent');
      setForm({ type: '', size: '', name: '', company: '', phone: '', email: '', city: '', message: '', web: '' });
    } catch { setStatus('error'); }
  };

  const fieldCls = (k) => `font-sans text-[15px] px-3.5 py-3 rounded-[12px] bg-paper text-ink outline-none border ${bad[k] ? 'border-[#c0392b]' : 'border-ink/45'} focus:border-ink`;

  return (
    <div className="bg-paper text-ink min-h-screen">
      {/* NAV */}
      <nav className="flex items-center justify-between flex-wrap gap-3 px-5 md:px-9 py-4 border-b border-ink/12">
        <Link href="/" className="text-[22px] font-bold tracking-head">casa-libre<em className="font-serif italic font-normal">.py</em></Link>
        <div className="hidden md:flex gap-2">
          {t.tabs.map(([label, href]) => (
            <Link key={label} href={href} className="inline-flex items-center h-[40px] px-[18px] rounded-pill text-[14px] font-medium border border-ink">{label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center h-[40px] border border-ink/30 rounded-pill p-[3px] text-[12px] font-semibold">
            {['es', 'en'].map((x) => (
              <button key={x} onClick={() => setLang(x)} className={`h-full flex items-center px-3 rounded-pill ${lang === x ? 'bg-ink text-paper' : 'text-ink/55'}`}>{x.toUpperCase()}</button>
            ))}
          </div>
          <Link href="/publicar" className="inline-flex items-center h-[40px] px-[22px] rounded-pill text-[14px] font-medium bg-ink text-paper">{t.cta}</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-[1180px] mx-auto px-5 md:px-9 pt-12 md:pt-20 pb-8 md:pb-12 grid gap-8 md:gap-14 items-center [grid-template-columns:1fr] min-[860px]:[grid-template-columns:1.25fr_.75fr]">
        <div>
          <p className="font-mono text-[12px] tracking-[.12em] uppercase text-ink/55 mb-3.5">{t.kicker}</p>
          <h1 className="text-[clamp(34px,5.4vw,60px)] leading-[1.04] tracking-head font-bold mb-4 [&_em]:font-serif [&_em]:italic [&_em]:font-normal">{t.h1}</h1>
          <p className="text-[clamp(16px,1.6vw,19px)] leading-[1.55] text-ink/75 max-w-[56ch] mb-6">{t.lede}</p>
          <div className="flex gap-3 flex-wrap">
            <a href="#form" className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-pill font-semibold text-[15px] bg-ink text-paper border-[1.5px] border-ink shadow-[4px_4px_0_rgba(17,17,17,.85)] active:translate-x-[2px] active:translate-y-[2px]">{t.ctaForm}</a>
            <Link href="/propiedades" className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-pill font-semibold text-[15px] bg-white text-ink border-[1.5px] border-ink shadow-[4px_4px_0_rgba(17,17,17,.18)] active:translate-x-[2px] active:translate-y-[2px]">{t.ctaSite}</Link>
          </div>
        </div>
        <div className="bg-white border-[1.5px] border-ink rounded-[20px] shadow-[5px_4px_0_#111] p-[22px] text-center">
          <p className="font-serif italic text-[19px] mt-1 mb-1">{t.mQuote}</p>
          <p className="font-mono text-[11px] text-ink/50">{t.mWho}</p>
        </div>
      </section>

      {/* AUDIENCE CHIPS */}
      <div className="max-w-[1180px] mx-auto px-5 md:px-9 pb-2 flex gap-2.5 flex-wrap">
        {t.aud.map((a) => (
          <span key={a} className="font-mono text-[12px] border border-ink/35 rounded-pill px-3.5 py-2 bg-white">{a}</span>
        ))}
      </div>

      {/* VALUE PROPS */}
      <section className="max-w-[1180px] mx-auto px-5 md:px-9 py-8 md:py-12 grid gap-4 [grid-template-columns:1fr] min-[860px]:grid-cols-3">
        {t.props.map(([n, h, p]) => (
          <div key={n} className="bg-white border-[1.5px] border-ink rounded-[18px] shadow-[4px_4px_0_rgba(17,17,17,.85)] p-[22px]">
            <span className="font-mono text-[11px] tracking-[.1em] text-ink/45">{n}</span>
            <h3 className="mt-2 mb-2 text-[19px] tracking-head font-bold">{h}</h3>
            <p className="text-[14.5px] leading-[1.55] text-ink/70">{p}</p>
          </div>
        ))}
      </section>

      {/* STEPS */}
      <section className="max-w-[1180px] mx-auto px-5 md:px-9 pb-8 md:pb-12">
        <h2 className="text-[clamp(24px,3vw,34px)] tracking-head font-bold mb-1.5 [&_em]:font-serif [&_em]:italic [&_em]:font-normal">{t.stepsH}</h2>
        <p className="text-ink/65 mb-5 text-[15px]">{t.stepsSub}</p>
        <div className="grid gap-4 [grid-template-columns:1fr] min-[860px]:grid-cols-3">
          {t.steps.map(([num, h, p]) => (
            <div key={num} className="border border-dashed border-ink/40 rounded-[18px] p-5">
              <span className="font-serif italic text-[34px] leading-none">{num}</span>
              <h4 className="mt-2.5 mb-1.5 text-[16.5px] font-bold">{h}</h4>
              <p className="text-[14px] leading-[1.5] text-ink/70">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FORM + SIDE */}
      <section id="form" className="max-w-[1180px] mx-auto px-5 md:px-9 pb-9 md:pb-16 grid gap-6 md:gap-12 items-start [grid-template-columns:1fr] min-[920px]:[grid-template-columns:1fr_.85fr]">
        <div className="bg-white border-[1.5px] border-ink rounded-[20px] shadow-[5px_4px_0_#111] p-5 md:p-[30px]">
          <h2 className="text-[clamp(24px,3vw,34px)] tracking-head font-bold mb-1.5 [&_em]:font-serif [&_em]:italic [&_em]:font-normal">{t.formH}</h2>
          <p className="text-ink/65 mb-5 text-[15px]">{t.formSub}</p>
          {status === 'sent' ? (
            <div className="px-4 py-6 border border-ink/15 rounded-[14px] bg-paper text-center">
              <p className="text-[15px] font-medium">{t.sent}</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="grid gap-3.5 [grid-template-columns:1fr] min-[600px]:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.lType}</span>
                  <select value={form.type} onChange={set('type')} className={fieldCls('type')}>{t.types.map((x) => <option key={x} value={x}>{x}</option>)}</select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.lSize}</span>
                  <select value={form.size} onChange={set('size')} className={fieldCls('size')}>{t.sizes.map((x) => <option key={x} value={x}>{x}</option>)}</select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.lName}</span>
                  <input value={form.name} onChange={set('name')} type="text" autoComplete="name" className={fieldCls('name')} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.lCompany}</span>
                  <input value={form.company} onChange={set('company')} type="text" autoComplete="organization" className={fieldCls('company')} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.lPhone}</span>
                  <input value={form.phone} onChange={set('phone')} type="tel" placeholder="0981 123 456" autoComplete="tel" className={fieldCls('phone')} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.lEmail}</span>
                  <input value={form.email} onChange={set('email')} type="email" autoComplete="email" className={fieldCls('email')} />
                </label>
                <label className="flex flex-col gap-1.5 min-[600px]:col-span-2">
                  <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.lCity}</span>
                  <input value={form.city} onChange={set('city')} type="text" placeholder="Asunción, Luque, Ciudad del Este..." className={fieldCls('city')} />
                </label>
                <label className="flex flex-col gap-1.5 min-[600px]:col-span-2">
                  <span className="font-mono text-[11px] tracking-[.08em] uppercase text-ink/55">{t.lMsg}</span>
                  <textarea value={form.message} onChange={set('message')} rows={4} className={`${fieldCls('message')} resize-y min-h-[96px]`} />
                </label>
                <input value={form.web} onChange={set('web')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] opacity-0 h-0" />
              </div>
              <p className="text-[12.5px] text-ink/60 leading-[1.5] my-4">{t.consent}</p>
              {status === 'error' && <p className="text-[13px] text-[#c0392b] mb-3">{t.err}</p>}
              <button type="submit" disabled={status === 'sending'} className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-pill font-semibold text-[15px] bg-ink text-paper border-[1.5px] border-ink shadow-[4px_4px_0_rgba(17,17,17,.85)] disabled:opacity-60">
                {status === 'sending' ? t.sending : t.btnSubmit}
              </button>
              <p className="font-mono text-[11px] text-ink/45 mt-3">{t.formNote}</p>
            </form>
          )}
        </div>

        <div className="bg-white border-[1.5px] border-ink rounded-[20px] shadow-[5px_4px_0_#111] p-5 md:p-[30px]">
          <p className="font-mono text-[12px] tracking-[.08em] uppercase text-ink/55 mb-2">{t.sideH}</p>
          <ul className="list-disc pl-[18px] mb-[18px] text-[14.5px] leading-[1.7] text-ink/80">
            {t.side.map((s) => <li key={s}>{s}</li>)}
          </ul>
          <p className="font-mono text-[12px] tracking-[.08em] uppercase text-ink/55 mb-2">{t.sideH2}</p>
          <div className="flex flex-col gap-2.5">
            {BIZ_WA && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2.5 px-[22px] py-3 rounded-pill font-semibold text-[15px] text-white border-[1.5px] border-ink shadow-[4px_4px_0_#111]" style={{ background: '#25D366' }}>
                <WaGlyph /> {t.waLbl}
              </a>
            )}
            <p className="text-[13.5px] text-ink/65">
              {BIZ_WA ? (lang === 'es' ? 'O por email: ' : 'Or by email: ') : (lang === 'es' ? 'Escribinos por email: ' : 'Reach us by email: ')}
              <a href="mailto:hola@casa-libre.com" className="underline">hola@casa-libre.com</a>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[1180px] mx-auto px-5 md:px-9 pb-12 md:pb-20">
        <h2 className="text-[clamp(24px,3vw,34px)] tracking-head font-bold mb-1.5">{t.faqH}</h2>
        {t.faq.map(([q, a]) => (
          <details key={q} className="bg-white border border-ink/35 rounded-[14px] px-[18px] py-4 mt-2.5">
            <summary className="font-semibold cursor-pointer text-[15px]">{q}</summary>
            <p className="mt-2.5 text-[14px] leading-[1.6] text-ink/72">{a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
