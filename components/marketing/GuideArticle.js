'use client';
// Visible body of a /guias page. The server route keeps the metadata and the
// JSON-LD in Spanish (that is the SEO target and what crawlers get); this
// component switches the reader-facing copy with the site's ES/EN toggle, the
// same way the other marketing pages work.
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { COUNTRY } from '@/lib/country';

const UI = {
  es: {
    guides: 'Guías', short: 'Respuesta corta', faq: 'Preguntas frecuentes',
    updated: 'Actualizado', disclaimer: 'Esta guía es informativa y no reemplaza el asesoramiento de un escribano o profesional; los montos y requisitos pueden variar según el caso.',
    seeNow: 'Mirá propiedades ahora', fullMap: 'Ver el mapa completo',
    ctaTitle: 'Publicá tu propiedad gratis',
    ctaSub: (n) => `Sin comisión y sin planes. Tu aviso aparece en el mapa junto a las propiedades de inmobiliarias y de dueños particulares de ${n}.`,
    ctaBtn: 'Publicar gratis', others: 'Otras guías',
    inline: 'Mientras tanto, mirá el mercado:', inlinePublish: 'Publicar gratis →',
  },
  en: {
    guides: 'Guides', short: 'Short answer', faq: 'Frequently asked questions',
    updated: 'Updated', disclaimer: 'This guide is informational and does not replace advice from a notary or other professional; amounts and requirements vary case by case.',
    seeNow: 'See properties now', fullMap: 'Open the full map',
    ctaTitle: 'List your property for free',
    ctaSub: (n) => `No commission, no plans. Your listing appears on the map alongside properties from agencies and private owners across ${n}.`,
    ctaBtn: 'List for free', others: 'Other guides',
    inline: 'Meanwhile, see the market:', inlinePublish: 'List for free →',
  },
};

export default function GuideArticle({ content, updated, related = [], others = [] }) {
  const [lang] = useLang();
  const l = content[lang] ? lang : 'es';
  const g = content[l];
  const t = UI[l];

  return (
    <article className="px-5 md:px-11 py-10 max-w-[760px] mx-auto">
      <nav className="text-[13px] text-ink/50 mb-4">
        <Link href="/guias" className="underline decoration-ink/25 hover:decoration-ink">{t.guides}</Link>
        <span className="mx-2">·</span>
        <span>{COUNTRY.name}</span>
      </nav>

      <h1 className="text-[clamp(30px,5vw,44px)] leading-[1.08] tracking-head font-bold mb-5">{g.h1}</h1>

      {/* The quotable answer: first thing on the page, in its own box. */}
      <div className="bg-card border-[1.5px] border-ink rounded-card p-6 shadow-hard-soft mb-8">
        <div className="text-[12px] font-semibold uppercase tracking-label text-ink/45 mb-2">{t.short}</div>
        <p className="text-[17px] leading-relaxed text-ink">{g.answer}</p>
      </div>

      {/* The reader came for the answer, so the answer comes first — but the way
          into the product sits right under it, not only at the foot of the page. */}
      {related.length ? (
        <div className="flex flex-wrap items-center gap-2.5 mb-10 -mt-3">
          <span className="text-[13.5px] text-ink/55">{t.inline}</span>
          {related.slice(0, 2).map((r) => (
            <Link key={r.href} href={r.href} className="px-3.5 py-1.5 rounded-pill border border-ink/25 bg-card text-[13px] font-medium hover:border-ink">
              {l === 'en' ? r.labelEn || r.label : r.label}
            </Link>
          ))}
          <Link href="/publicar" className="px-3.5 py-1.5 rounded-pill bg-ink text-paper text-[13px] font-semibold">{t.inlinePublish}</Link>
        </div>
      ) : null}

      {g.sections.map((s, i) => (
        <section key={i} className="mb-8">
          <h2 className="text-[24px] font-bold tracking-head mt-10 mb-3">{s.h2}</h2>
          {(s.paras || []).map((p, k) => (
            <p key={k} className="text-[16px] leading-relaxed text-ink/80 mb-4">{p}</p>
          ))}
          {s.bullets ? (
            <ul className="list-disc pl-5 mb-4 text-[16px] leading-relaxed text-ink/80 flex flex-col gap-2">
              {s.bullets.map((b, k) => <li key={k}>{b}</li>)}
            </ul>
          ) : null}
          {s.table ? (
            <div className="overflow-x-auto mb-4">
              <table className="w-full border-collapse text-[15px]">
                <thead>
                  <tr>{s.table.head.map((h, k) => (
                    <th key={k} className="text-left font-semibold border-b-[1.5px] border-ink py-2.5 pr-4">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {s.table.rows.map((r, k) => (
                    <tr key={k}>{r.map((cell, j) => (
                      <td key={j} className="border-b border-ink/12 py-2.5 pr-4 align-top text-ink/80">{cell}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}

      {g.faq?.length ? (
        <section className="mb-10">
          <h2 className="text-[24px] font-bold tracking-head mt-10 mb-4">{t.faq}</h2>
          <div className="flex flex-col gap-3">
            {g.faq.map((f, i) => (
              <details key={i} className="group bg-card border border-ink/15 rounded-[16px] p-5 [&_summary]:cursor-pointer">
                <summary className="flex items-center justify-between gap-3 list-none">
                  <span className="text-[16px] font-semibold">{f.q}</span>
                  <span className="text-ink/40 group-open:rotate-45 transition-transform text-[20px] leading-none">+</span>
                </summary>
                <p className="text-[15px] text-ink/70 leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-[13px] text-ink/45 mb-10">{t.updated}: {updated}. {t.disclaimer}</p>

      {related.length ? (
        <section className="mb-10">
          <h2 className="text-[20px] font-bold tracking-head mb-3">{t.seeNow}</h2>
          <div className="flex flex-wrap gap-2.5">
            {related.map((r) => (
              <Link key={r.href} href={r.href} className="px-4 py-2 rounded-pill border border-ink/25 bg-card text-[13.5px] font-medium hover:border-ink">
                {l === 'en' ? r.labelEn || r.label : r.label}
              </Link>
            ))}
            <Link href="/propiedades" className="px-4 py-2 rounded-pill border border-ink/25 bg-card text-[13.5px] font-medium hover:border-ink">{t.fullMap}</Link>
          </div>
        </section>
      ) : null}

      <section className="bg-ink text-paper rounded-card p-7">
        <h2 className="text-[22px] font-bold tracking-head mb-2">{t.ctaTitle}</h2>
        <p className="text-[15px] text-paper/70 mb-4">{t.ctaSub(COUNTRY.name)}</p>
        <Link href="/publicar" className="inline-block px-6 py-3 bg-paper text-ink rounded-pill font-bold text-[15px]">{t.ctaBtn}</Link>
      </section>

      {others.length ? (
        <section className="mt-10">
          <h2 className="text-[20px] font-bold tracking-head mb-3">{t.others}</h2>
          <ul className="flex flex-col gap-2 text-[15px]">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/guias/${o.slug}`} className="font-semibold underline decoration-ink/30 hover:decoration-ink">
                  {l === 'en' ? o.h1En || o.h1 : o.h1}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
