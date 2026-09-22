// /guias — hub for the answer pages. Exists so the guides have one crawlable
// parent, one place to link from the footer, and a breadcrumb trail.
import Link from 'next/link';
import MarketingShell from '@/components/MarketingShell';
import { GUIDES, UPDATED } from '@/lib/guias';
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
        <div className="text-[12px] font-semibold uppercase tracking-label text-ink/45 mb-3">Guías</div>
        <h1 className="text-[clamp(32px,5.5vw,48px)] leading-[1.05] tracking-head font-bold mb-4">
          Comprar, vender y alquilar en {COUNTRY.name}
        </h1>
        <p className="text-[17px] leading-relaxed text-ink/65 max-w-[620px] mb-10">
          Respuestas directas a lo que la gente pregunta antes de mover una propiedad: precios, impuestos, documentos y contratos. Escritas para {COUNTRY.name}, sin vueltas.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/guias/${g.slug}`}
              className="block bg-card border border-ink/15 rounded-card p-6 hover:border-ink transition-colors"
            >
              <h2 className="text-[19px] font-bold tracking-head mb-2">{g.h1}</h2>
              <p className="text-[14.5px] leading-relaxed text-ink/65">{g.answer.slice(0, 150)}…</p>
            </Link>
          ))}
        </div>

        <section className="bg-ink text-paper rounded-card p-7 mt-10">
          <h2 className="text-[22px] font-bold tracking-head mb-2">Mirá lo que hay en tu zona</h2>
          <p className="text-[15px] text-paper/70 mb-4">
            Todas las propiedades de {COUNTRY.name} en un solo mapa: de inmobiliarias y de dueños particulares.
          </p>
          <Link href="/propiedades" className="inline-block px-6 py-3 bg-paper text-ink rounded-pill font-bold text-[15px]">Ver propiedades</Link>
        </section>
      </div>
    </MarketingShell>
  );
}
