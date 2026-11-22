'use client';
// The /newsletter page (app/newsletter/page.js): issues as articles + "Historias de éxito".
// Spanish, English (site language switch); Portuguese visitors read the Spanish issues.
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { STORIES, ILLUSTRATIVE_NOTE } from '@/lib/newsletter/content';

const T = {
  es: {
    eyebrow: 'Newsletter de Casa-Libre', title: 'Lo que buscan', serif: 'los compradores.',
    sub: (c) => `Cada semana, datos reales de Casa-Libre sobre lo que se busca en ${c}: precios, zonas, tipos de propiedad y consejos para publicar.`,
    data: (d) => `Datos de los últimos 30 días${d ? `, medidos el ${d}` : ''}.`,
    issue: 'Edición', toc: 'En este número', stories: 'Historias de éxito', storiesSub: 'Cómo trabajan dueños, agentes e inmobiliarias en Casa-Libre.',
    challenge: 'El desafío', did: 'Lo que hizo', result: 'El resultado', more: 'Ver la historia completa',
    cta: 'Publicá tu propiedad', ctaSub: 'Los interesados te escriben directo a tu WhatsApp. Desde la web o desde la app para iPhone y Android.',
    publish: 'Publicar mi propiedad', app: 'Descargar la app',
  },
  en: {
    eyebrow: 'Casa-Libre newsletter', title: 'What buyers', serif: 'are looking for.',
    sub: (c) => `Every week, real Casa-Libre data on what people search for in ${c}: prices, areas, property types and tips for listing.`,
    data: (d) => `Data from the last 30 days${d ? `, measured on ${d}` : ''}.`,
    issue: 'Issue', toc: 'In this issue', stories: 'Success stories', storiesSub: 'How owners, agents and agencies work on Casa-Libre.',
    challenge: 'The challenge', did: 'What they did', result: 'The result', more: 'Read the full story',
    cta: 'List your property', ctaSub: 'Interested people write straight to your WhatsApp. On the web or in the app for iPhone and Android.',
    publish: 'List my property', app: 'Get the app',
  },
};
const BTN_EN = {
  'Publicar mi propiedad': 'List my property', 'Publicar mi primera propiedad': 'List my first property', 'Publicar mi alquiler': 'List my rental',
  'Publicar mis propiedades': 'List my properties', 'Completar mi perfil': 'Complete my profile', 'Ver lo que buscan los compradores': 'See what buyers search for',
  'Descargar la app': 'Get the app',
};

// **bold** → <strong>, line breaks kept (text comes from our own content file, never from users)
function Rich({ text }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-ink">{p.slice(2, -2)}</strong> : p.split('\n').map((line, k) => <span key={`${i}-${k}`}>{k ? <br /> : null}{line}</span>)))}</>;
}

function Block({ b, lang }) {
  if (b.type === 'h') return <h3 className="text-[19px] font-bold tracking-head mt-7 mb-2">{b.text}</h3>;
  if (b.type === 'stat') {
    return (
      <div className="bg-paper border border-ink/10 rounded-[16px] px-5 py-4 mb-3">
        <div className="text-[26px] md:text-[30px] font-bold tracking-head leading-tight">{b.value}</div>
        <div className="text-[15px] text-ink/70 mt-1 leading-relaxed"><Rich text={b.text} /></div>
      </div>
    );
  }
  if (b.type === 'button') {
    return <Link href={b.href} className="inline-block mt-2 mb-3 mr-2 px-6 py-3 border-2 border-ink rounded-pill font-bold text-[14.5px]">{lang === 'en' ? BTN_EN[b.label] || b.label : b.label}</Link>;
  }
  return <p className="text-[16px] text-ink/75 leading-relaxed mb-3"><Rich text={b.text} /></p>;
}

function StoryCard({ s, lang, full }) {
  const t = T[lang];
  return (
    <article id={`historia-${s.slug}`} className="bg-card border border-ink/15 rounded-card p-6 flex flex-col scroll-mt-24">
      <div className="text-[24px] font-bold tracking-head leading-tight">{s.metric[lang]}</div>
      <div className="text-[14px] text-ink/55 mt-0.5">{s.when[lang]}</div>
      <h3 className="text-[16.5px] font-bold mt-4 leading-snug">{s.title[lang]}</h3>
      <div className="font-mono text-[11.5px] uppercase tracking-label text-ink/45 mt-1">{s.who[lang]}</div>
      {full ? (
        <div className="mt-3 text-[14.5px] text-ink/70 leading-relaxed space-y-2">
          <p><strong className="text-ink">{t.challenge}:</strong> {s.challenge[lang]}</p>
          <p><strong className="text-ink">{t.did}:</strong> {s.did[lang]}</p>
          <p><strong className="text-ink">{t.result}:</strong> {s.result[lang]}</p>
        </div>
      ) : <p className="mt-3 text-[14.5px] text-ink/70 leading-relaxed">{s.result[lang]}</p>}
      <blockquote className="mt-4 pt-4 border-t border-ink/10 text-[14.5px] italic text-ink/75">“{s.quote[lang]}”</blockquote>
    </article>
  );
}

export default function NewsletterContent({ es = [], en = [], measuredAt, countryName }) {
  const [langRaw] = useLang();
  const lang = langRaw === 'en' ? 'en' : 'es';
  const t = T[lang];
  const issues = lang === 'en' ? en : es;
  const date = measuredAt ? new Date(measuredAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return (
    <>
      <section className="px-5 md:px-11 pt-16 pb-8 max-w-[900px] mx-auto text-center">
        <div className="font-mono text-[12px] uppercase tracking-label text-ink/45 mb-4">{t.eyebrow}</div>
        <h1 className="text-[clamp(34px,6vw,58px)] font-bold tracking-display leading-[1.03]">{t.title} <span className="font-serif italic font-normal">{t.serif}</span></h1>
        <p className="text-[17px] text-ink/60 mt-5 max-w-[640px] mx-auto leading-relaxed">{t.sub(countryName)}</p>
        <p className="text-[13px] text-ink/45 mt-3">{t.data(date)}</p>
      </section>

      {issues.length > 0 && (
        <nav className="px-5 md:px-11 max-w-[760px] mx-auto pb-4" aria-label={t.toc}>
          <div className="font-mono text-[11.5px] uppercase tracking-label text-ink/45 mb-2">{t.toc}</div>
          <ol className="flex flex-col gap-1.5">
            {issues.map((i, n) => <li key={i.slug}><a href={`#${i.slug}`} className="text-[15px] font-semibold underline decoration-ink/25 hover:decoration-ink">{n + 1}. {i.title}</a></li>)}
            <li><a href="#historias" className="text-[15px] font-semibold underline decoration-ink/25 hover:decoration-ink">{issues.length + 1}. {t.stories}</a></li>
          </ol>
        </nav>
      )}

      <div className="px-5 md:px-11 max-w-[760px] mx-auto flex flex-col gap-6 py-6">
        {issues.map((i, n) => (
          <article key={i.slug} id={i.slug} className="bg-card border border-ink/15 rounded-card p-6 md:p-8 scroll-mt-24">
            <div className="font-mono text-[11.5px] uppercase tracking-label text-ink/45">{t.issue} {n + 1}</div>
            <h2 className="text-[24px] md:text-[28px] font-bold tracking-head leading-tight mt-2 mb-4">{i.title}</h2>
            {i.blocks.map((b, k) => <Block key={k} b={b} lang={lang} />)}
            {i.story && <div className="mt-4"><StoryCard s={i.story} lang={lang} full /></div>}
            <div className="mt-5">
              <Link href={i.button.href} className="inline-block px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px]">{lang === 'en' ? BTN_EN[i.button.label] || i.button.label : i.button.label}</Link>
            </div>
          </article>
        ))}
      </div>

      <section id="historias" className="px-5 md:px-11 py-10 max-w-[1100px] mx-auto scroll-mt-24">
        <h2 className="text-[clamp(28px,4vw,40px)] font-bold tracking-display text-center">{t.stories}</h2>
        <p className="text-[16px] text-ink/60 text-center mt-2 mb-8">{t.storiesSub}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STORIES.map((s) => <StoryCard key={s.slug} s={s} lang={lang} full />)}
        </div>
        {ILLUSTRATIVE_NOTE[lang] ? <p className="text-[12px] text-ink/40 text-center mt-6">{ILLUSTRATIVE_NOTE[lang]}</p> : null}
      </section>

      <section className="px-5 md:px-11 pb-16">
        <div className="max-w-[900px] mx-auto bg-ink text-paper rounded-section p-10 md:p-14 text-center">
          <h2 className="text-[clamp(26px,4vw,40px)] font-bold tracking-display leading-tight">{t.cta}</h2>
          <p className="text-[16px] text-paper/70 mt-3 max-w-[520px] mx-auto">{t.ctaSub}</p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <Link href="/publicar" className="px-7 py-3.5 bg-paper text-ink rounded-pill font-bold text-[15px]">{t.publish}</Link>
            <Link href="/descargar" className="px-7 py-3.5 border-2 border-paper text-paper rounded-pill font-bold text-[15px]">{t.app}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
