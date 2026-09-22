// One answer page per question (/guias/<slug>).
//
// Shape is deliberate: the question as H1, a short quotable answer immediately
// under it, then the detail, then an FAQ block — mirrored into FAQPage schema.
// Google and the AI engines lift whoever answered the question, so the answer has
// to be the first thing on the page, server-rendered.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import MarketingShell from '@/components/MarketingShell';
import { getGuide, guideSlugs, GUIDES, UPDATED } from '@/lib/guias';
import { OPS, TIPOS } from '@/lib/matrix';
import { SITE, INDEXABLE, CITIES } from '@/lib/site';
import { COUNTRY } from '@/lib/country';
import { breadcrumbLd } from '@/lib/schema';

// Runtime-rendered so robots/indexability read live env (a static prerender bakes
// INDEXABLE=false — the bug that kept /comprar and /alquilar out of the index).
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return guideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const g = getGuide(params.slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guias/${g.slug}` },
    openGraph: { title: g.title, description: g.description, type: 'article', url: `${SITE}/guias/${g.slug}` },
  };
}

// Link the guides at the capital's matrix pages (per country, from the city list).
const capitalCity = CITIES.find((x) => x.name === COUNTRY.capital) || CITIES[0];
const citySlug = capitalCity?.slug;
const cityName = capitalCity?.name || COUNTRY.capital;

function relatedLinks(g) {
  return (g.related || []).map(([op, tipo]) => {
    const o = OPS[op], t = TIPOS[tipo];
    if (!o || !t) return null;
    if (!citySlug) return null;
    return { href: `/${op}/${tipo}/${citySlug}`, label: `${o.short} de ${t.plural} en ${cityName}` };
  }).filter(Boolean);
}

export default function Page({ params }) {
  const g = getGuide(params.slug);
  if (!g) notFound();
  const url = `${SITE}/guias/${g.slug}`;
  const related = relatedLinks(g);
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 4);

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: g.h1,
      description: g.description,
      inLanguage: 'es',
      mainEntityOfPage: url,
      dateModified: UPDATED,
      author: { '@type': 'Organization', name: 'Casa Libre', url: SITE },
      publisher: { '@type': 'Organization', name: 'Casa Libre', url: SITE },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (g.faq || []).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    breadcrumbLd([
      { name: 'Casa Libre', url: SITE },
      { name: 'Guías', url: `${SITE}/guias` },
      { name: g.h1, url },
    ]),
  ];

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      {!INDEXABLE ? <meta name="robots" content="noindex, nofollow" /> : null}

      <article className="px-5 md:px-11 py-10 max-w-[760px] mx-auto">
        <nav className="text-[13px] text-ink/50 mb-4">
          <Link href="/guias" className="underline decoration-ink/25 hover:decoration-ink">Guías</Link>
          <span className="mx-2">·</span>
          <span>{COUNTRY.name}</span>
        </nav>

        <h1 className="text-[clamp(30px,5vw,44px)] leading-[1.08] tracking-head font-bold mb-5">{g.h1}</h1>

        {/* The quotable answer: first thing on the page, in its own box. */}
        <div className="bg-card border-[1.5px] border-ink rounded-card p-6 shadow-hard-soft mb-8">
          <div className="text-[12px] font-semibold uppercase tracking-label text-ink/45 mb-2">Respuesta corta</div>
          <p className="text-[17px] leading-relaxed text-ink">{g.answer}</p>
        </div>

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
            <h2 className="text-[24px] font-bold tracking-head mt-10 mb-4">Preguntas frecuentes</h2>
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

        <p className="text-[13px] text-ink/45 mb-10">
          Actualizado: {UPDATED}. Esta guía es informativa y no reemplaza el asesoramiento de un escribano o profesional; los montos y requisitos pueden variar según el caso.
        </p>

        {related.length ? (
          <section className="mb-10">
            <h2 className="text-[20px] font-bold tracking-head mb-3">Mirá propiedades ahora</h2>
            <div className="flex flex-wrap gap-2.5">
              {related.map((r) => (
                <Link key={r.href} href={r.href} className="px-4 py-2 rounded-pill border border-ink/25 bg-card text-[13.5px] font-medium hover:border-ink">{r.label}</Link>
              ))}
              <Link href="/propiedades" className="px-4 py-2 rounded-pill border border-ink/25 bg-card text-[13.5px] font-medium hover:border-ink">Ver el mapa completo</Link>
            </div>
          </section>
        ) : null}

        <section className="bg-ink text-paper rounded-card p-7">
          <h2 className="text-[22px] font-bold tracking-head mb-2">Publicá tu propiedad gratis</h2>
          <p className="text-[15px] text-paper/70 mb-4">
            Sin comisión y sin planes. Tu aviso aparece en el mapa junto a las propiedades de inmobiliarias y de dueños particulares de {COUNTRY.name}.
          </p>
          <Link href="/publicar" className="inline-block px-6 py-3 bg-paper text-ink rounded-pill font-bold text-[15px]">Publicar gratis</Link>
        </section>

        {others.length ? (
          <section className="mt-10">
            <h2 className="text-[20px] font-bold tracking-head mb-3">Otras guías</h2>
            <ul className="flex flex-col gap-2 text-[15px]">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/guias/${o.slug}`} className="font-semibold underline decoration-ink/30 hover:decoration-ink">{o.h1}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </MarketingShell>
  );
}
