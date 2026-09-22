// /guias — hub for the answer pages. Exists so the guides have one crawlable
// parent, one place to link from the footer, and a breadcrumb trail.
import Link from 'next/link';
import MarketingShell from '@/components/MarketingShell';
import { GUIDES, UPDATED } from '@/lib/guias';
import { guideEn } from '@/lib/guias.en';
import Bi from '@/components/marketing/Bi';
import { SITE, INDEXABLE } from '@/lib/site';
import { COUNTRY } from '@/lib/country';
import { breadcrumbLd } from '@/lib/schema';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Guías para comprar, vender y alquilar en ${COUNTRY.name}`,
  description: `Respuestas claras a las preguntas de siempre: cómo vender tu casa, cuánto vale tu propiedad, qué impuestos y documentos hacen falta, y cómo alquilar sin inmobiliaria en ${COUNTRY.name}.`,
  alternates: { canonical: '/guias' },
};

export default function Page() {
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Guías inmobiliarias en ${COUNTRY.name}`,
      description: metadata.description,
      url: `${SITE}/guias`,
      inLanguage: 'es',
      hasPart: GUIDES.map((g) => ({ '@type': 'Article', headline: g.h1, url: `${SITE}/guias/${g.slug}`, dateModified: UPDATED })),
    },
    breadcrumbLd([{ name: 'Casa Libre', url: SITE }, { name: 'Guías', url: `${SITE}/guias` }]),
  ];

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      {!INDEXABLE ? <meta name="robots" content="noindex, nofollow" /> : null}

      <div className="px-5 md:px-11 py-12 max-w-[860px] mx-auto">
        <div className="text-[12px] font-semibold uppercase tracking-label text-ink/45 mb-3"><Bi es="Guías" en="Guides" /></div>
        <h1 className="text-[clamp(32px,5.5vw,48px)] leading-[1.05] tracking-head font-bold mb-4">
          <Bi es={`Comprar, vender y alquilar en ${COUNTRY.name}`} en={`Buying, selling and renting in ${COUNTRY.name}`} />
        </h1>
        <p className="text-[17px] leading-relaxed text-ink/65 max-w-[620px] mb-10">
          <Bi es={`Respuestas directas a lo que la gente pregunta antes de mover una propiedad: precios, impuestos, documentos y contratos. Escritas para ${COUNTRY.name}, sin vueltas.`} en={`Straight answers to what people ask before moving a property: prices, taxes, documents and contracts. Written for ${COUNTRY.name}, no waffle.`} />
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {GUIDES.map((g) => { const en = guideEn(g.slug); return (
            <Link
              key={g.slug}
              href={`/guias/${g.slug}`}
              className="block bg-card border border-ink/15 rounded-card p-6 hover:border-ink transition-colors"
            >
              <h2 className="text-[19px] font-bold tracking-head mb-2"><Bi es={g.h1} en={en?.h1} /></h2>
              <p className="text-[14.5px] leading-relaxed text-ink/65">
                <Bi es={`${g.answer.slice(0, 150)}…`} en={en ? `${en.answer.slice(0, 150)}…` : undefined} />
              </p>
            </Link>
          ); })}
        </div>

        <section className="bg-ink text-paper rounded-card p-7 mt-10">
          <h2 className="text-[22px] font-bold tracking-head mb-2"><Bi es="Mirá lo que hay en tu zona" en="See what's available in your area" /></h2>
          <p className="text-[15px] text-paper/70 mb-4">
            <Bi es={`Todas las propiedades de ${COUNTRY.name} en un solo mapa: de inmobiliarias y de dueños particulares.`} en={`Every property in ${COUNTRY.name} on one map: from agencies and from private owners.`} />
          </p>
          <Link href="/propiedades" className="inline-block px-6 py-3 bg-paper text-ink rounded-pill font-bold text-[15px]"><Bi es="Ver propiedades" en="See properties" /></Link>
        </section>
      </div>
    </MarketingShell>
  );
}
