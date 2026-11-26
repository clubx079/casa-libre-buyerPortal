'use client';
// Service-partner preview page (app/casa-limpia/page.js). Shows the company's profile, how a
// lead reaches its WhatsApp, the ad on a listing, and the founding-partner price with a Stripe
// pay button. Every step is tracked in PostHog (partner_* events, with the link's utm_* tags).
import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import { track } from '@/lib/analytics';
import { pick, waLink } from '@/lib/partners';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function Icons() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="clp-wa" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z" /></symbol>
      <symbol id="clp-key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M14 9l2 2" /></symbol>
      <symbol id="clp-door" viewBox="0 0 24 24"><path d="M5 21V4a1 1 0 0 1 1-1h9l4 2v16" /><path d="M3 21h18M15 3v18M11 12h.01" /></symbol>
      <symbol id="clp-sofa" viewBox="0 0 24 24"><path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" /><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2" /></symbol>
      <symbol id="clp-building" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" /></symbol>
      <symbol id="clp-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></symbol>
      <symbol id="clp-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
      <symbol id="clp-receipt" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></symbol>
      <symbol id="clp-card" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></symbol>
      <symbol id="clp-camera" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></symbol>
      <symbol id="clp-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></symbol>
      <symbol id="clp-check" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" /></symbol>
      <symbol id="clp-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></symbol>
      <symbol id="clp-chart" viewBox="0 0 24 24"><path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" /></symbol>
      <symbol id="clp-zero" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 16L16 8" /></symbol>
      <symbol id="clp-chat" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" /></symbol>
      <symbol id="clp-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></symbol>
    </svg>
  );
}

const I = ({ n, s }) => <svg className="i" style={s ? { width: s, height: s } : undefined}><use href={`#clp-${n}`} /></svg>;

function utmFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    return Object.fromEntries(UTM_KEYS.map((k) => [k, q.get(k)]).filter(([, v]) => v));
  } catch { return {}; }
}
function distinctId() {
  try { return posthog.__loaded ? posthog.get_distinct_id() || '' : ''; } catch { return ''; }
}

export default function PartnerPage({ partner: p, payState, contact }) {
  const [lang, setLang] = useState('es');
  const t = (es, en) => (lang === 'en' ? en : es);
  const L = (v) => pick(v, lang);
  const utm = useRef({});
  const pricingRef = useRef(null);
  const ev = (event, props = {}) => track(event, { partner: p.slug, lang, ...utm.current, ...props });

  useEffect(() => {
    utm.current = utmFromUrl();
    try { const q = new URLSearchParams(window.location.search).get('lang'); if (q === 'en' || q === 'es') setLang(q); } catch { /* ignore */ }
    ev('partner_page_viewed', { pay_state: payState || 'none' });
    if (payState === 'paid') ev('partner_payment_returned');
    if (payState === 'canceled') ev('partner_checkout_canceled');
    if (payState === 'error') ev('partner_checkout_error');
    // Did they scroll down to the price?
    const el = pricingRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { ev('partner_pricing_viewed'); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchLang = (l) => { setLang(l); track('partner_lang_switched', { partner: p.slug, lang: l, ...utm.current }); };

  const payHref = () => {
    const q = new URLSearchParams({ from: 'page', ...utm.current });
    const id = distinctId();
    if (id) q.set('ph', id);
    return `/${p.slug}/pagar?${q}`;
  };
  const onPay = (placement) => (e) => {
    e.preventDefault();
    ev('partner_pay_clicked', { placement });
    const href = payHref();
    // give the event a moment to leave before navigating to Stripe
    setTimeout(() => { window.location.href = href; }, 250);
  };
  const wa = waLink(p, lang);
  const onWa = (placement) => () => ev('partner_whatsapp_clicked', { placement });
  const onWeb = () => ev('partner_website_clicked');

  const ticker = [t('CASA-LIBRE — SOCIOS DE SERVICIOS', 'CASA-LIBRE — SERVICE PARTNERS'), t('LIMPIEZA', 'CLEANING'), t('MUDANZAS', 'MOVING'), t('MANTENIMIENTO', 'MAINTENANCE'), t('PINTURA', 'PAINTING'), t('CONTACTO DIRECTO POR WHATSAPP', 'DIRECT CONTACT ON WHATSAPP'), t('SIN COMISIÓN', 'NO COMMISSION')];
  const logoWa = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(t(`Hola Casa-Libre, ya pagamos el plan de socio fundador de ${p.name}. Les enviamos el logo y los textos.`, `Hi Casa-Libre, we paid the founding partner plan for ${p.name}. Here are our logo and texts.`))}`;

  return (
    <div className="clp" lang={lang}>
      <Icons />
      <div className="note">
        <b>{t(`Vista previa para ${p.name}`, `Preview for ${p.name}`)}</b>{' · '}
        {t('Así se vería su empresa en Casa-Libre. Logo, textos y fotos se reemplazan por los que ustedes elijan.', 'This is how your company would look on Casa-Libre. Logo, texts and photos are replaced with the ones you choose.')}
      </div>
      <div className="ticker" aria-hidden="true"><div className="run">{[...ticker, ...ticker].map((s, i) => <span key={i}>{s}</span>)}</div></div>

      <nav className="top">
        <a className="wordmark" href="/">casa-libre<em>.py</em></a>
        <div className="navend">
          <div className="lang" role="group" aria-label={t('Idioma', 'Language')}>
            <button type="button" className={lang === 'es' ? 'on' : ''} onClick={() => switchLang('es')}>ES</button>
            <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => switchLang('en')}>EN</button>
          </div>
          <a className="pill dark" href="#precio" onClick={() => ev('partner_nav_price_clicked')}>{t('Ver precio', 'See price')}</a>
        </div>
      </nav>

      <main className="wrap">
        <div className="crumbs"><span>{t('Socios de servicios', 'Service partners')}</span><span>/</span><span>{L(p.category)}</span><span>/</span><span style={{ color: 'var(--ink)' }}>{p.name}</span></div>

        {/* 1 · PROFILE */}
        <div className="stephead" style={{ marginTop: 6 }}>
          <span className="n">1</span>
          <div><h2>{t('El perfil de ', 'The ')}<em>{p.name}</em>{t('', ' profile')}</h2>
            <p>{t('Su página de empresa en Casa-Libre: servicios, precios, zonas, equipo y contacto directo.', 'Your company page on Casa-Libre: services, prices, areas, team and direct contact.')}</p></div>
        </div>
        <div className="card">
          <div className="cover" style={{ backgroundImage: `url('${p.cover}')`, backgroundPosition: 'center 55%' }} />
          <div className="head">
            <div className="mark"><img src={p.logo} alt={p.name} /></div>
            <div className="info">
              <div className="label">{L(p.area)}</div>
              <h1>{p.name}</h1>
              <p className="tagline">{L(p.tagline)}</p>
              <div className="chips">
                <span className="chip fill"><I n="check" s={13} />{t('Socio fundador', 'Founding partner')}</span>
                {p.chips.map((c, i) => <span className="chip" key={i}>{L(c)}</span>)}
              </div>
            </div>
            <div className="cta">
              <a className="pill" href={p.website} target="_blank" rel="noopener" onClick={onWeb}><I n="globe" />{t('Sitio web', 'Website')}</a>
              <a className="pill wa" href={wa} target="_blank" rel="noopener" onClick={onWa('profile_head')}><I n="wa" />{t('Escribir por WhatsApp', 'Message on WhatsApp')}</a>
            </div>
          </div>
          <div className="stats">
            {p.stats.map((s, i) => <div key={i}><span className="label">{L(s.k)}</span><b>{L(s.v)}</b></div>)}
          </div>
        </div>

        <div className="grid">
          <div>
            <div className="soft block">
              <div className="label">{t('Sobre la empresa', 'About the company')}</div>
              <h2>{t('Limpieza con ', 'Cleaning with a ')}<em>{t('precio claro', 'clear price')}</em></h2>
              <p className="txt">{L(p.about)}</p>
            </div>

            <div className="soft block">
              <div className="label">{t('Servicios', 'Services')}</div>
              <h2>{t('Qué ', 'What they ')}<em>{t('hacen', 'do')}</em></h2>
              {p.services.map((s, i) => (
                <div className="svc" key={i}>
                  <div className="ic"><I n={s.icon} /></div>
                  <div className="t"><b>{L(s.t)}</b><p>{L(s.d)}</p></div>
                  <div className="pr"><small>{L(s.from)}</small><b>{L(s.price)}</b></div>
                </div>
              ))}
            </div>

            <div className="soft block">
              <div className="label">{t('Trabajos realizados', 'Their work')}</div>
              <h2>{t('Fotos de ', 'Photos of ')}<em>{t('sus trabajos', 'their jobs')}</em></h2>
              <div className="gallery">{p.gallery.map((g) => <div key={g} style={{ backgroundImage: `url('${g}')` }} />)}</div>
              <p className="fine">{t('Fotos de muestra. Al activar el perfil se reemplazan por fotos de trabajos de ', 'Sample photos. When the profile goes live they are replaced with job photos from ')}{p.name}.</p>
            </div>

            <div className="soft block">
              <div className="label">{t('Cómo trabajan', 'How they work')}</div>
              <h2>{t('En tres ', 'In three ')}<em>{t('pasos', 'steps')}</em></h2>
              <div className="steps">
                {p.steps.map((s, i) => <div key={i}><span className="n">0{i + 1}</span><b>{L(s.t)}</b><p>{L(s.d)}</p></div>)}
              </div>
            </div>

            <div className="soft block">
              <div className="label">{t('Equipo', 'Team')}</div>
              <h2>{t('Quiénes ', 'Who ')}<em>{t('atienden', 'you deal with')}</em></h2>
              <div className="team">{p.team.map((m) => <div key={m.name}><img src={m.img} alt={m.name} /><b>{m.name}</b><small>{L(m.role)}</small></div>)}</div>
            </div>
          </div>

          <aside className="side">
            <div className="contact">
              <div className="label">{t('Contacto directo', 'Direct contact')}</div>
              <h3>{t('¿Necesitás ', 'Need ')}<em>{t('limpieza?', 'cleaning?')}</em></h3>
              <p>{t(`Escribile directo a ${p.name}. Casa-Libre no cobra comisión por el trabajo.`, `Message ${p.name} directly. Casa-Libre charges no commission on the job.`)}</p>
              <a className="pill wa block" href={wa} target="_blank" rel="noopener" onClick={onWa('profile_side')}><I n="wa" />{t('Escribir por WhatsApp', 'Message on WhatsApp')}</a>
              <a className="pill block" href={p.website} target="_blank" rel="noopener" onClick={onWeb}><I n="globe" />{p.websiteLabel}</a>
            </div>
            <div className="soft block">
              <div className="label">{t('Zonas', 'Areas')}</div>
              <div className="zones">{p.zones.map((z) => <span key={z}>{z}</span>)}</div>
            </div>
            <div className="soft block">
              <div className="label">{t('Datos', 'Details')}</div>
              {p.details.map((d, i) => <div className="kv" key={i}><I n={d.icon} /><span className="k">{L(d.k)}</span><span className="v">{L(d.v)}</span></div>)}
              <div className="kv"><I n="wa" /><span className="k">WhatsApp</span><span className="v">{p.whatsappLabel}</span></div>
            </div>
          </aside>
        </div>

        {/* 2 · HOW LEADS REACH THEM */}
        <div className="stephead">
          <span className="n">2</span>
          <div><h2>{t('Así le llegan ', 'This is how ')}<em>{t('los clientes', 'clients reach you')}</em></h2>
            <p>{t(`Un toque en el botón verde y el interesado le escribe al WhatsApp de ${p.name}, con el mensaje ya escrito. Sin formularios y sin intermediarios.`, `One tap on the green button and the person messages ${p.name}'s WhatsApp, with the message already written. No forms, no middlemen.`)}</p></div>
        </div>
        <div className="card flow">
          <div className="phone" aria-label={t('Ejemplo de conversación', 'Example conversation')}>
            <div className="bar"><span className="av" style={{ backgroundImage: `url('${p.logo}')` }} />{p.name}</div>
            <div className="msgs">
              <div className="bub out">{L(p.waText)}<small>10:42 ✓✓</small></div>
              <div className="bub in">{t('¡Hola! Gracias por escribirnos. ¿Cuántos dormitorios tiene la propiedad y en qué zona está?', 'Hi! Thanks for writing. How many bedrooms does the property have and where is it?')}<small>10:44</small></div>
            </div>
          </div>
          <div>
            <div className="label">{t('El recorrido del cliente', "The client's path")}</div>
            <ol>
              <li>{t('Una persona mira o publica una propiedad en Casa-Libre (web o app para iPhone y Android).', 'Someone views or lists a property on Casa-Libre (web or the iPhone and Android app).')}</li>
              <li>{t(`Ve a ${p.name} como socio recomendado de limpieza.`, `They see ${p.name} as the recommended cleaning partner.`)}</li>
              <li>{t(`Toca "Escribir por WhatsApp" y le llega el mensaje directo a ${p.name}.`, `They tap "Message on WhatsApp" and the message goes straight to ${p.name}.`)}</li>
            </ol>
            <a className="pill wa lg" href={wa} target="_blank" rel="noopener" onClick={onWa('flow_demo')}><I n="wa" />{t('Probar el botón de WhatsApp', 'Try the WhatsApp button')}</a>
            <p className="fine">{t(`Abre WhatsApp con ${p.name} (${p.whatsappLabel}), igual que para un cliente.`, `Opens WhatsApp with ${p.name} (${p.whatsappLabel}), exactly as it would for a client.`)}</p>
          </div>
        </div>

        {/* 3 · AD ON A LISTING */}
        <div className="stephead">
          <span className="n">3</span>
          <div><h2>{t('El anuncio en ', 'The ad on ')}<em>{t('cada publicación', 'every listing')}</em></h2>
            <p>{t('Cuando alguien mira o publica una propiedad, ve a los socios recomendados de cada servicio. Así se ve el anuncio:', 'When someone views or lists a property, they see the recommended partners for each service. This is the ad:')}</p></div>
        </div>
        <div className="card lst">
          <div>
            <div className="ph" style={{ backgroundImage: "url('/casa-limpia/listing.jpg')" }} />
            <div className="price">Gs. 4.800.000 <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--i55)' }}>{t('/ mes', '/ month')}</span></div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{t('Departamento en alquiler · Villa Morra, Asunción', 'Apartment for rent · Villa Morra, Asunción')}</div>
            <div className="meta">{t('2 dormitorios · 2 baños · 85 m² · cochera', '2 bedrooms · 2 bathrooms · 85 m² · parking')}</div>
            <p className="fine">{t('Publicación de ejemplo.', 'Example listing.')}</p>
          </div>
          <div>
            <div className="label">{t('Socios recomendados', 'Recommended partners')}</div>
            <div className="cat"><span className="chip fill">{t('Limpieza', 'Cleaning')}</span><span className="chip dash">{t('Mudanzas', 'Moving')}</span><span className="chip dash">{t('Mantenimiento', 'Maintenance')}</span><span className="chip dash">{t('Pintura', 'Painting')}</span></div>
            <div className="pc">
              <div className="row">
                <div className="m"><img src={p.logo} alt="" /></div>
                <div><b style={{ fontSize: 16 }}>{p.name}</b><div className="mono" style={{ fontSize: 11.5, color: 'var(--i55)', marginTop: 2 }}>{t('SOCIO FUNDADOR · LIMPIEZA', 'FOUNDING PARTNER · CLEANING')}</div></div>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--i70)' }}>{t('Limpieza antes de entregar o alquilar y al salir el inquilino. Precio fijo y factura legal.', 'Cleaning before handover or renting and when tenants leave. Fixed price and official invoice.')}</p>
              <div className="acts">
                <a className="pill wa" href={wa} target="_blank" rel="noopener" onClick={onWa('listing_ad')}><I n="wa" s={16} />WhatsApp</a>
                <a className="pill" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); ev('partner_view_profile_clicked'); }}><I n="eye" s={16} />{t('Ver perfil', 'View profile')}</a>
              </div>
            </div>
          </div>
        </div>

        {/* 4 · PRICE + PAY */}
        <div className="stephead" id="precio">
          <span className="n">4</span>
          <div><h2>{t('Activar el perfil de ', 'Activate ')}<em>{p.name}</em></h2>
            <p>{t('Pagan con tarjeta en la página segura de Stripe. Después nos envían su logo y los textos, y su perfil y el anuncio quedan activos.', 'Pay by card on Stripe\'s secure page. Then send us your logo and texts, and your profile and ad go live.')}</p></div>
        </div>

        {payState === 'paid' && (
          <div className="banner ok" role="status">
            <b>{t('Pago recibido. ¡Gracias!', 'Payment received. Thank you!')}</b>{' '}
            {t('Último paso: envíennos su logo y los textos que prefieren, y su perfil queda activo.', 'Last step: send us your logo and preferred texts, and your profile goes live.')}
            <div className="acts">
              <a className="pill wa" href={logoWa} target="_blank" rel="noopener" onClick={() => ev('partner_send_assets_clicked', { via: 'whatsapp' })}><I n="wa" />{t('Enviar por WhatsApp', 'Send on WhatsApp')}</a>
              <a className="pill" href={`mailto:${contact.email}?subject=${encodeURIComponent(`${p.name} · logo y textos`)}`} onClick={() => ev('partner_send_assets_clicked', { via: 'email' })}>{contact.email}</a>
            </div>
          </div>
        )}
        {payState === 'pending' && <div className="banner" role="status">{t('Estamos confirmando el pago con Stripe. Si ya pagaron, en unos minutos les escribimos.', 'We are confirming the payment with Stripe. If you already paid, we will write to you in a few minutes.')}</div>}
        {payState === 'canceled' && <div className="banner" role="status">{t('El pago no se completó. Pueden intentarlo de nuevo cuando quieran.', 'The payment was not completed. You can try again whenever you like.')}</div>}
        {payState === 'error' && <div className="banner" role="status">{t(`No pudimos abrir la página de pago. Intenten de nuevo o escríbannos a ${contact.email}.`, `We could not open the payment page. Please try again or write to ${contact.email}.`)}</div>}

        <div className="card pricing" ref={pricingRef}>
          <div>
            <div className="label">{t('Programa de socios de servicios', 'Service partner program')}</div>
            <h2>{t('Qué recibe ', 'What ')}<em>{p.name}</em>{t('', ' gets')}</h2>
            <ul>
              <li><I n="check" />{t('Perfil de empresa en Casa-Libre, con servicios, precios, fotos y equipo', 'A company profile on Casa-Libre with services, prices, photos and team')}</li>
              <li><I n="eye" />{t('El anuncio en las publicaciones de propiedades', 'The ad on property listings')}</li>
              <li><I n="chat" />{t('Los interesados le escriben directo a su WhatsApp', 'Interested people message your WhatsApp directly')}</li>
              <li><I n="zero" />{t('Sin comisión por los trabajos que consigan', 'No commission on the jobs you get')}</li>
              <li><I n="chart" />{t('Reporte mensual de contactos', 'Monthly contacts report')}</li>
              <li><I n="check" />{t('Sin permanencia: cancelan cuando quieran', 'No minimum term: cancel anytime')}</li>
            </ul>
          </div>
          <div className="price-box">
            <div className="label">{t('Precio de socio fundador', 'Founding partner price')}</div>
            <div className="big">US${p.plan.usd}</div>
            <div style={{ fontSize: 14, color: 'var(--i55)' }}>{t('por mes', 'per month')} · <s>US${p.plan.listUsd}</s></div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--i45)', marginTop: 6 }}>{t('MANTIENEN ESTE PRECIO MIENTRAS SIGAN ACTIVOS', 'YOU KEEP THIS PRICE WHILE YOU STAY ACTIVE')}</div>
            {payState === 'paid'
              ? <span className="pill dark lg block" aria-disabled="true"><I n="check" />{t('Pagado', 'Paid')}</span>
              : <a className="pill dark lg block" href={`/${p.slug}/pagar?from=page`} onClick={onPay('pricing')}><I n="card" />{t('Pagar ahora', 'Click now to pay')}</a>}
            <div className="secure"><I n="lock" s={14} />{t('Pago seguro con Stripe · tarjeta de crédito o débito', 'Secure payment with Stripe · credit or debit card')}</div>
          </div>
        </div>
      </main>

      <footer>
        <div>
          <div className="wordmark">casa-libre<em>.py</em></div>
          <div style={{ color: 'var(--i55)', marginTop: 4 }}>{t('El marketplace inmobiliario de Paraguay · App para iPhone y Android', "Paraguay's real estate marketplace · App for iPhone and Android")}</div>
        </div>
        <div style={{ color: 'var(--i55)' }}>{t('¿Preguntas? ', 'Questions? ')}<a href={`mailto:${contact.email}`} style={{ textDecoration: 'underline' }}>{contact.email}</a></div>
        <div className="fineprint">{t(`© 2026 Casa-Libre · Vista previa preparada para ${p.name}. Datos de la empresa tomados de ${p.websiteLabel}.`, `© 2026 Casa-Libre · Preview prepared for ${p.name}. Company details taken from ${p.websiteLabel}.`)}</div>
      </footer>
    </div>
  );
}
