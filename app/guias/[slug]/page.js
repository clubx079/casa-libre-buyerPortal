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
import { guidePt } from '@/lib/guias.pt';
import { OPS, TIPOS } from '@/lib/matrix';
import { SITE, INDEXABLE, CITIES } from '@/lib/site';
import { COUNTRY } from '@/lib/country';
import { breadcrumbLd } from '@/lib/schema';
import { dbGuide, guideStats, moneyFormatter } from '@/lib/seo';
import { fillGuide, placeholderPaths, monthEs } from '@/lib/seoContent';

// '<' inside JSON-LD becomes the 6 characters backslash-u003c: stored text can never close the <script> tag
const LT_ESC = String.fromCharCode(92) + 'u003c';

// Runtime-rendered so robots/indexability read live env (a static prerender bakes
// INDEXABLE=false — the bug that kept /comprar and /alquilar out of the index).
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return guideSlugs().map((slug) => ({ slug }));
}

// A guide written by the SEO pipeline (Admin → SEO → Drafts, approved by a person): stored in the
// DB, its numbers are placeholders filled from live listings (refreshed monthly).
// Never crashes the page: a guide whose stored shape is off is cleaned, and if it still can't be built
// the address answers "not found" (404) instead of an error page.
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? '' : String(v));
async function pipelineGuide(slug) {
  try {
    const raw = await dbGuide(slug);
    if (!raw) return null;
    const d = {
      ...raw,
      title: str(raw.title), h1: str(raw.h1), description: str(raw.description), answer: str(raw.answer),
      sections: arr(raw.sections).filter((s) => s && typeof s === 'object').map((s) => ({ h2: str(s.h2), paras: arr(s.paras).map(str) })),
      faq: arr(raw.faq).filter((x) => x && typeof x === 'object' && x.q && x.a).map((x) => ({ q: str(x.q), a: str(x.a) })),
    };
    if (!d.title || !d.h1 || !d.sections.length) return null;
    const [stats, money] = await Promise.all([guideStats(placeholderPaths(d)), moneyFormatter()]);
    const g = fillGuide(d, stats, money, monthEs());
    return { ...g, related: arr(raw.related).filter((r) => Array.isArray(r) && r.length >= 2), updated: str(raw.updated_at || raw.approved_at).slice(0, 10) || UPDATED, fromPipeline: true };
  } catch {
    return null;
  }
}
const loadGuide = async (slug) => getGuide(slug) || pipelineGuide(slug);

export async function generateMetadata({ params }) {
  const g = await loadGuide(params.slug);
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

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function relatedLinks(g) {
  if (!citySlug) return [];
  return (g.related || []).map(([op, tipo]) => {
    const o = OPS[op], t = TIPOS[tipo];
    if (!o || !t) return null;
    return {
      href: `/${op}/${tipo}/${citySlug}`,
      label: `${o.short} de ${t.plural} en ${cityName}`,
      labelEn: `${t.pluralEn || t.plural} ${o.labelEn || o.label} in ${cityName}`,
      labelPt: `${cap(t.pluralPt || t.plural)} ${o.labelPt || o.label} em ${cityName}`,
    };
  }).filter(Boolean);
}

export default async function Page({ params }) {
  const g = await loadGuide(params.slug);
  if (!g) notFound();
  const en = g.fromPipeline ? null : guideEn(params.slug);
  const pt = g.fromPipeline ? null : guidePt(params.slug);
  const updated = g.updated || UPDATED;
  const url = `${SITE}/guias/${g.slug}`;
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 4)
    .map((o) => ({ slug: o.slug, h1: o.h1, h1En: guideEn(o.slug)?.h1, h1Pt: guidePt(o.slug)?.h1 }));

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: g.h1,
      description: g.description,
      inLanguage: 'es',
      mainEntityOfPage: url,
      dateModified: updated,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, LT_ESC) }} />
      {!INDEXABLE ? <meta name="robots" content="noindex, nofollow" /> : null}
      <GuideArticle
        content={{ es: g, ...(en ? { en } : {}), ...(pt ? { pt } : {}) }}
        updated={updated}
        related={relatedLinks(g)}
        others={others}
      />
    </MarketingShell>
  );
}
