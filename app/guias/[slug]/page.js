// One answer page per question (/guias/<slug>).
//
// Shape is deliberate: the question as H1, a short quotable answer immediately
// under it, then the detail, then an FAQ block — mirrored into FAQPage schema.
// Google and the AI engines lift whoever answered the question, so the answer has
// to be the first thing on the page, server-rendered.
//
// Metadata and JSON-LD stay Spanish (the SEO target); the visible copy switches
// with the site's ES/EN toggle inside GuideArticle.
import { notFound } from 'next/navigation';
import MarketingShell from '@/components/MarketingShell';
import GuideArticle from '@/components/marketing/GuideArticle';
import { getGuide, guideSlugs, GUIDES, UPDATED } from '@/lib/guias';
import { guideEn } from '@/lib/guias.en';
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
  if (!citySlug) return [];
  return (g.related || []).map(([op, tipo]) => {
    const o = OPS[op], t = TIPOS[tipo];
    if (!o || !t) return null;
    return {
      href: `/${op}/${tipo}/${citySlug}`,
      label: `${o.short} de ${t.plural} en ${cityName}`,
      labelEn: `${t.pluralEn || t.plural} ${o.labelEn || o.label} in ${cityName}`,
    };
  }).filter(Boolean);
}

export default function Page({ params }) {
  const g = getGuide(params.slug);
  if (!g) notFound();
  const en = guideEn(params.slug);
  const url = `${SITE}/guias/${g.slug}`;
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 4)
    .map((o) => ({ slug: o.slug, h1: o.h1, h1En: guideEn(o.slug)?.h1 }));

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
      <GuideArticle
        content={{ es: g, ...(en ? { en } : {}) }}
        updated={UPDATED}
        related={relatedLinks(g)}
        others={others}
      />
    </MarketingShell>
  );
}
