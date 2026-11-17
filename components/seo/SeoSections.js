// The SEO pipeline's blocks on a matrix page (server component): an FAQ built from live data (with
// FAQPage structured data) and "more searches" links — the page variants switched on for this page,
// links added by the pipeline's "strengthen" step, and related guides. Copy is Spanish (the SEO target).
import Link from 'next/link';
import Bi from '@/components/marketing/Bi';

export function faqLd(faq) {
  if (!faq?.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
}

export default function SeoSections({ faq = [], links = [] }) {
  const ld = faqLd(faq);
  const uniq = [];
  const seen = new Set();
  for (const l of links) if (l?.href && !seen.has(l.href)) { seen.add(l.href); uniq.push(l); }
  if (!faq.length && !uniq.length) return null;
  return (
    <>
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} /> : null}
      {uniq.length ? (
        <section className="mt-12 border-t-[1.5px] border-ink/10 pt-8" data-seo="links">
          <h2 className="text-[18px] font-bold text-ink"><Bi es="Más búsquedas" en="More searches" pt="Mais buscas" /></h2>
          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {uniq.map((l) => (
              <li key={l.href}><Link href={l.href} className="text-[14px] text-ink hover:underline">{l.label}</Link></li>
            ))}
          </ul>
        </section>
      ) : null}
      {faq.length ? (
        <section className="mt-12 border-t-[1.5px] border-ink/10 pt-8" data-seo="faq">
          <h2 className="text-[18px] font-bold text-ink"><Bi es="Preguntas frecuentes" en="Frequently asked questions" pt="Perguntas frequentes" /></h2>
          <div className="mt-4 space-y-4 max-w-3xl">
            {faq.map((f) => (
              <div key={f.q}>
                <h3 className="text-[15px] font-semibold text-ink">{f.q}</h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-ink/70">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
