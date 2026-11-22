'use client';
// The /newsletter page (app/newsletter/page.js), laid out like a real newsletter: masthead with the
// edition date, a lead story, then the issues as articles (category, title, dek, stat tiles, body,
// button) next to a sticky sidebar (contents, numbers of the week, list-for-free box), then the
// success stories. Spanish, English (site language switch); Portuguese visitors read Spanish.
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { STORIES, ILLUSTRATIVE_NOTE } from '@/lib/newsletter/content';

const T = {
  es: {
    name: 'La Carta de Casa-Libre', tagline: 'Lo que buscan los compradores, con datos reales.',
    article: 'Nota', editionNo: (n, d) => `Edición Nº ${n} · ${d}`, latest: 'Última edición',
    data: 'Datos de los últimos 30 días en Casa-Libre', dataUntil: (d) => `Datos de los 30 días previos al ${d}`,
    editions: 'Ediciones', older: 'Edición anterior', newer: 'Edición siguiente', current: 'estás acá',
    sub: (c) => `Precios, zonas y tipos de propiedad que más se miran en ${c}, consejos para publicar e historias de quienes ya venden y alquilan con Casa-Libre.`,
    toc: 'En este número', numbers: 'Los números de la semana', stories: 'Historias de éxito',
    storiesSub: 'Cómo trabajan dueños, agentes e inmobiliarias en Casa-Libre.',
    challenge: 'El desafío', did: 'Lo que hizo', result: 'El resultado',
    boxTitle: 'Publicá gratis', boxSub: 'Los interesados te escriben directo a tu WhatsApp, desde la web o la app para iPhone y Android.',
    cta: 'Publicá tu propiedad', ctaSub: 'Los interesados te escriben directo a tu WhatsApp. Desde la web o desde la app para iPhone y Android.',
    publish: 'Publicar mi propiedad', app: 'Descargar la app', top: 'Volver arriba',
    cat: { data: 'Datos del mercado', sellers: 'Para vendedores', tips: 'Consejos', story: 'Historia', rent: 'Alquileres', app: 'La app' },
  },
  en: {
    name: 'The Casa-Libre Letter', tagline: 'What buyers are looking for, with real data.',
    article: 'Story', editionNo: (n, d) => `Issue No. ${n} · ${d}`, latest: 'Latest issue',
    data: 'Data from the last 30 days on Casa-Libre', dataUntil: (d) => `Data from the 30 days before ${d}`,
    editions: 'Issues', older: 'Previous issue', newer: 'Next issue', current: 'you are here',
    sub: (c) => `The prices, areas and property types people look at most in ${c}, tips for listing, and stories from people already selling and renting with Casa-Libre.`,
    toc: 'In this issue', numbers: 'Numbers of the week', stories: 'Success stories',
    storiesSub: 'How owners, agents and agencies work on Casa-Libre.',
    challenge: 'The challenge', did: 'What they did', result: 'The result',
    boxTitle: 'List for free', boxSub: 'Interested people write straight to your WhatsApp, on the web or in the app for iPhone and Android.',
    cta: 'List your property', ctaSub: 'Interested people write straight to your WhatsApp. On the web or in the app for iPhone and Android.',
    publish: 'List my property', app: 'Get the app', top: 'Back to top',
    cat: { data: 'Market data', sellers: 'For sellers', tips: 'Tips', story: 'Story', rent: 'Rentals', app: 'The app' },
  },
};
const BTN_EN = {
  'Publicar mi propiedad': 'List my property', 'Publicar mi primera propiedad': 'List my first property', 'Publicar mi alquiler': 'List my rental',
  'Publicar mis propiedades': 'List my properties', 'Completar mi perfil': 'Complete my profile', 'Ver lo que buscan los compradores': 'See what buyers search for',
  'Descargar la app': 'Get the app',
};
const catOf = (slug) => (slug.startsWith('historia') ? 'story' : slug === 'fotos' ? 'tips' : slug === 'alquileres' ? 'rent'
  : slug === 'experiencia-estados-unidos' ? 'app' : ['publicaciones-directas', 'tu-cuenta-esta-lista'].includes(slug) ? 'sellers' : 'data');
const btnLabel = (label, lang) => (lang === 'en' ? BTN_EN[label] || label : label);

// **bold** → <strong>, line breaks kept (text comes from our own content file, never from users)
function Rich({ text }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-ink font-semibold">{p.slice(2, -2)}</strong> : p.split('\n').map((line, k) => <span key={`${i}-${k}`}>{k ? <br /> : null}{line}</span>)))}</>;
}

// consecutive stat blocks → one row of tiles; everything else as it comes
function groupBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.type === 'stat' && last?.type === 'stats') last.items.push(b);
    else if (b.type === 'stat') out.push({ type: 'stats', items: [b] });
    else out.push(b);
  }
  return out;
}

function Stats({ items }) {
  return (
    <div className={`grid gap-px bg-ink/12 border border-ink/12 rounded-[14px] overflow-hidden my-5 ${items.length > 1 ? 'sm:grid-cols-2' : ''} ${items.length > 2 ? 'lg:grid-cols-3' : ''}`}>
      {items.map((s, i) => (
        <div key={i} className="bg-card px-5 py-4">
          <div className="text-[26px] md:text-[28px] font-bold tracking-head leading-tight">{s.value}</div>
          <div className="text-[13.5px] text-ink/65 mt-1.5 leading-snug"><Rich text={s.text} /></div>
        </div>
      ))}
    </div>
  );
}

function Body({ blocks, lang }) {
  return groupBlocks(blocks).map((b, k) => {
    if (b.type === 'stats') return <Stats key={k} items={b.items} />;
    if (b.type === 'h') return <h3 key={k} className="text-[18px] font-bold tracking-head mt-6 mb-2">{b.text}</h3>;
    if (b.type === 'button') return <Link key={k} href={b.href} className="inline-block mt-1 mb-3 mr-2 px-5 py-2.5 border-[1.5px] border-ink rounded-pill font-semibold text-[14px] hover:bg-ink hover:text-paper transition-colors">{btnLabel(b.label, lang)}</Link>;
    return <p key={k} className="text-[16px] text-ink/75 leading-[1.7] mb-3"><Rich text={b.text} /></p>;
  });
}

function StoryCard({ s, lang }) {
  const t = T[lang];
  return (
    <article id={`historia-${s.slug}`} className="bg-card border border-ink/12 rounded-[18px] p-6 flex flex-col scroll-mt-24">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-[16px] shrink-0" aria-hidden>{String(s.who[lang] || '?').trim().charAt(0)}</span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold leading-tight truncate">{s.who[lang]}</div>
          <div className="text-[12.5px] text-ink/50">{s.when[lang]}</div>
        </div>
      </div>
      <div className="text-[28px] font-bold tracking-head leading-tight mt-5">{s.metric[lang]}</div>
      <h3 className="text-[16px] font-bold mt-2 leading-snug">{s.title[lang]}</h3>
      <dl className="mt-3 text-[14px] text-ink/70 leading-relaxed space-y-2">
        <div><dt className="inline font-semibold text-ink">{t.challenge}: </dt><dd className="inline">{s.challenge[lang]}</dd></div>
        <div><dt className="inline font-semibold text-ink">{t.did}: </dt><dd className="inline">{s.did[lang]}</dd></div>
        <div><dt className="inline font-semibold text-ink">{t.result}: </dt><dd className="inline">{s.result[lang]}</dd></div>
      </dl>
      <blockquote className="mt-auto pt-4 border-t border-ink/10 text-[15px] font-serif italic text-ink/80 leading-snug">“{s.quote[lang]}”</blockquote>
    </article>
  );
}

function Article({ i, n, lang, lead = false }) {
  const t = T[lang];
  return (
    <article id={i.slug} className={`scroll-mt-24 ${lead ? '' : 'pt-10 mt-10 border-t border-ink/12'}`}>
      <div className="flex items-center gap-2 text-[12.5px] font-semibold">
        <span className="px-2.5 py-1 rounded-pill bg-ink text-paper">{t.cat[catOf(i.slug)]}</span>
        <span className="text-ink/45 font-medium">{t.article} {n}</span>
      </div>
      <h2 className={`${lead ? 'text-[clamp(30px,4.2vw,44px)]' : 'text-[clamp(24px,3vw,32px)]'} font-bold tracking-head leading-[1.08] mt-3`}>{i.title}</h2>
      {i.heading && i.heading !== i.title ? <p className="text-[18px] text-ink/55 font-serif italic mt-2">{i.heading}</p> : null}
      <div className="mt-4"><Body blocks={i.blocks} lang={lang} /></div>
      {i.story ? <div className="mt-5 max-w-[560px]"><StoryCard s={i.story} lang={lang} /></div> : null}
      <Link href={i.button.href} className="inline-block mt-4 px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] shadow-hard-soft">{btnLabel(i.button.label, lang)}</Link>
    </article>
  );
}

export default function NewsletterContent({ es = [], en = [], stories = null, edition = null, older = null, newer = null, editions = [], countryName }) {
  const [langRaw] = useLang();
  const lang = langRaw === 'en' ? 'en' : 'es';
  const t = T[lang];
  const issues = lang === 'en' ? en : es;
  const fmt = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
  const date = fmt(edition?.date);
  // this edition's stories (lib/newsletter/editions.js), or all of them
  const storyList = Array.isArray(stories) ? stories.map((slug) => STORIES.find((s) => s.slug === slug)).filter(Boolean) : STORIES;
  // the week's key figures for the sidebar: the first stat of each data issue
  const keyStats = issues.filter((i) => catOf(i.slug) !== 'story').map((i) => ({ slug: i.slug, s: i.blocks.find((b) => b.type === 'stat') })).filter((x) => x.s).slice(0, 4);
  const [lead, ...rest] = issues;

  return (
    <div id="top">
      {/* masthead */}
      <header className="px-5 md:px-11 pt-12 md:pt-16 max-w-[1180px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink/55 border-y-2 border-ink py-2.5">
          <span className="font-semibold text-ink">
            {edition ? t.editionNo(edition.number, date) : date}
            {edition?.latest ? <span className="ml-2 px-2 py-0.5 rounded-pill bg-ink text-paper text-[11.5px] font-semibold align-middle">{t.latest}</span> : null}
          </span>
          <span>{edition && !edition.latest ? t.dataUntil(date) : t.data} · {countryName}</span>
        </div>
        <div className="text-center py-9 md:py-12 border-b border-ink/15">
          <h1 className="text-[clamp(38px,7vw,76px)] font-bold tracking-display leading-[0.98]">{t.name}</h1>
          <p className="font-serif italic text-[clamp(18px,2.4vw,24px)] text-ink/60 mt-3">{t.tagline}</p>
          <p className="text-[15.5px] text-ink/55 mt-4 max-w-[620px] mx-auto leading-relaxed">{t.sub(countryName)}</p>
        </div>
      </header>

      <div className="px-5 md:px-11 max-w-[1180px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-10 lg:gap-14 py-10 md:py-12">
        <main className="min-w-0">
          {lead ? <Article i={lead} n={1} lang={lang} lead /> : null}
          {rest.map((i, k) => <Article key={i.slug} i={i} n={k + 2} lang={lang} />)}
        </main>

        <aside className="lg:sticky lg:top-24 self-start flex flex-col gap-5">
          {issues.length ? (
            <nav aria-label={t.toc} className="bg-card border border-ink/12 rounded-[18px] p-5">
              <h2 className="text-[13px] font-bold mb-3">{t.toc}</h2>
              <ol className="flex flex-col gap-2.5">
                {issues.map((i, n) => (
                  <li key={i.slug} className="flex gap-2.5 text-[14px] leading-snug">
                    <span className="tabular-nums font-bold text-ink/35 w-5 shrink-0">{n + 1}</span>
                    <a href={`#${i.slug}`} className="hover:underline underline-offset-2">{i.title}</a>
                  </li>
                ))}
                <li className="flex gap-2.5 text-[14px] leading-snug">
                  <span className="tabular-nums font-bold text-ink/35 w-5 shrink-0">{issues.length + 1}</span>
                  <a href="#historias" className="hover:underline underline-offset-2">{t.stories}</a>
                </li>
              </ol>
            </nav>
          ) : null}
          {keyStats.length ? (
            <div className="bg-card border border-ink/12 rounded-[18px] p-5">
              <h2 className="text-[13px] font-bold mb-3">{t.numbers}</h2>
              <ul className="flex flex-col divide-y divide-ink/10">
                {keyStats.map(({ slug, s }) => (
                  <li key={slug} className="py-3 first:pt-0 last:pb-0">
                    <a href={`#${slug}`} className="block group">
                      <div className="text-[20px] font-bold tracking-head leading-tight group-hover:underline underline-offset-2">{s.value}</div>
                      <div className="text-[12.5px] text-ink/55 mt-0.5 leading-snug line-clamp-2"><Rich text={s.text} /></div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="bg-ink text-paper rounded-[18px] p-6">
            <h2 className="text-[20px] font-bold tracking-head">{t.boxTitle}</h2>
            <p className="text-[14px] text-paper/70 mt-2 leading-relaxed">{t.boxSub}</p>
            <Link href="/publicar" className="inline-block mt-4 px-5 py-2.5 bg-paper text-ink rounded-pill font-bold text-[14px]">{t.publish}</Link>
          </div>
        </aside>
      </div>

      <section id="historias" className="px-5 md:px-11 py-12 md:py-16 border-y border-ink/10 scroll-mt-20" style={{ background: 'rgba(17,17,17,0.025)' }}>
        <div className="max-w-[1180px] mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
            <div>
              <h2 className="text-[clamp(28px,4vw,42px)] font-bold tracking-display leading-tight">{t.stories}</h2>
              <p className="text-[16px] text-ink/60 mt-1">{t.storiesSub}</p>
            </div>
            <a href="#top" className="text-[13.5px] font-semibold underline underline-offset-2 text-ink/60 hover:text-ink">{t.top}</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {storyList.map((s) => <StoryCard key={s.slug} s={s} lang={lang} />)}
          </div>
          {ILLUSTRATIVE_NOTE[lang] ? <p className="text-[12px] text-ink/40 mt-6">{ILLUSTRATIVE_NOTE[lang]}</p> : null}
        </div>
      </section>

      {(older || newer) ? (
        <nav aria-label={t.editions} className="px-5 md:px-11 pt-10 max-w-[1180px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {older ? (
              <a href={older.href} className="block border-[1.5px] border-ink rounded-[18px] px-6 py-5 hover:bg-ink hover:text-paper transition-colors">
                <span className="block text-[13px] font-semibold opacity-60">← {t.older}</span>
                <span className="block text-[18px] font-bold tracking-head mt-1">{fmt(older.date)}</span>
              </a>
            ) : <span />}
            {newer ? (
              <a href={newer.href} className="block border-[1.5px] border-ink rounded-[18px] px-6 py-5 text-right hover:bg-ink hover:text-paper transition-colors">
                <span className="block text-[13px] font-semibold opacity-60">{t.newer} →</span>
                <span className="block text-[18px] font-bold tracking-head mt-1">{fmt(newer.date)}</span>
              </a>
            ) : null}
          </div>
        </nav>
      ) : null}

      <section className="px-5 md:px-11 py-14 md:py-16">
        <div className="max-w-[900px] mx-auto bg-ink text-paper rounded-section p-10 md:p-14 text-center">
          <h2 className="text-[clamp(26px,4vw,40px)] font-bold tracking-display leading-tight">{t.cta}</h2>
          <p className="text-[16px] text-paper/70 mt-3 max-w-[520px] mx-auto">{t.ctaSub}</p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <Link href="/publicar" className="px-7 py-3.5 bg-paper text-ink rounded-pill font-bold text-[15px]">{t.publish}</Link>
            <Link href="/descargar" className="px-7 py-3.5 border-2 border-paper text-paper rounded-pill font-bold text-[15px]">{t.app}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
