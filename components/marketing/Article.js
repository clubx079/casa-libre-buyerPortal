'use client';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { Hero, CTABand, FeatureGrid } from './Parts';
import { CITIES } from '@/lib/site';

const PROSE = 'px-5 md:px-11 py-6 max-w-[760px] mx-auto text-[16px] leading-relaxed text-ink/80 [&>h2]:text-[26px] [&>h2]:font-bold [&>h2]:tracking-head [&>h2]:text-ink [&>h2]:mt-10 [&>h2]:mb-3 [&>p]:mb-4 [&>ul]:mb-4 [&>ul]:pl-5 [&>ul]:list-disc [&_a]:font-semibold [&_a]:underline [&_a]:decoration-ink/30 hover:[&_a]:decoration-ink';

// Renders one content block. `data` is the already-language-picked object.
function Block({ b }) {
  switch (b.type) {
    case 'prose':
      return (
        <div className={PROSE}>
          {b.nodes.map(([tag, html], i) =>
            tag === 'h2'
              ? <h2 key={i} dangerouslySetInnerHTML={{ __html: html }} />
              : <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      );
    case 'heading':
      return (
        <section className="px-5 md:px-11 py-4 max-w-[1000px] mx-auto mt-6 first:mt-0">
          <h2 className="text-[24px] font-bold tracking-head mb-4">{b.text}</h2>
        </section>
      );
    case 'features':
      return <FeatureGrid items={b.items} />;
    case 'ctaButton':
      return (
        <div className="px-5 md:px-11 text-center mb-4">
          <Link href={b.href} className="inline-block px-7 py-3.5 bg-ink text-paper rounded-pill font-bold text-[15px] shadow-hard-soft">{b.label}</Link>
        </div>
      );
    case 'cities':
      return (
        <section className="px-5 md:px-11 max-w-[760px] mx-auto flex flex-wrap gap-2.5 pb-4">
          {CITIES.map((c) => (
            <Link key={c.slug} href={`/propiedades-en/${c.slug}`} className="px-4 py-2 rounded-pill border border-ink/25 bg-card text-[13.5px] font-medium hover:border-ink">{b.prefix} {c.name}</Link>
          ))}
        </section>
      );
    case 'faq':
      return (
        <section className="px-5 md:px-11 pb-6 max-w-[760px] mx-auto flex flex-col gap-3">
          {b.items.map((f, i) => (
            <details key={i} className="group bg-card border border-ink/15 rounded-[16px] p-5 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between gap-3 list-none">
                <span className="text-[16px] font-semibold">{f.q}</span>
                <span className="text-ink/40 group-open:rotate-45 transition-transform text-[20px] leading-none">+</span>
              </summary>
              <p className="text-[15px] text-ink/70 leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </section>
      );
    case 'contact':
      return (
        <section className="px-5 md:px-11 pb-16 max-w-[600px] mx-auto">
          <div className="bg-card border border-ink/15 rounded-card p-8 flex flex-col gap-5">
            {b.items.map((it, i) => (
              <div key={i}>
                <div className="text-[12px] font-semibold uppercase tracking-label text-ink/45 mb-1">{it.label}</div>
                <a href={it.href} className={`text-[16px] font-semibold ${it.href.startsWith('mailto') ? '' : 'underline decoration-ink/30'}`}>{it.value}</a>
              </div>
            ))}
          </div>
        </section>
      );
    case 'cta':
      return <CTABand title={b.title} sub={b.sub} primary={b.primary} secondary={b.secondary} />;
    default:
      return null;
  }
}

// Bilingual marketing page. `content` is a serialisable { es, en } object passed
// from the (server) page so its metadata stays server-rendered for SEO, while the
// visible copy switches with the language toggle.
export default function Article({ content }) {
  const [lang] = useLang();
  const c = content[lang] || content.es;
  return (
    <>
      <Hero {...c.hero} />
      {(c.blocks || []).map((b, i) => <Block key={i} b={b} />)}
    </>
  );
}
