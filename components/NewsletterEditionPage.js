// One newsletter edition (server): its issues filled with the numbers measured for its date,
// its success stories, and the links to the other editions. Used by /newsletter (latest) and
// /newsletter/[date] (lib/newsletter/editions.js).
import MarketingShell from '@/components/MarketingShell';
import NewsletterContent from '@/components/NewsletterContent';
import { COUNTRY } from '@/lib/country';
import { newsletterInsights } from '@/lib/newsletter/insights';
import { pageIssues } from '@/lib/newsletter/page';
import { siteLinks } from '@/lib/automations/newsletter';
import { EDITIONS, editionNav, editionUntil, editionHref } from '@/lib/newsletter/editions';

export default async function NewsletterEditionPage({ edition }) {
  const latest = edition === EDITIONS[0];
  let measured = { vars: {}, measuredAt: null };
  try { measured = await newsletterInsights(latest ? {} : { until: editionUntil(edition.date) }); } catch { /* issues without numbers are left out */ }
  const vars = { ...measured.vars, ...siteLinks(''), country_name: COUNTRY.name };
  const nav = editionNav(edition.date);
  const link = (e) => (e ? { date: e.date, href: editionHref(e) } : null);
  return (
    <MarketingShell>
      <NewsletterContent
        es={pageIssues(vars, 'es', edition.issues)}
        en={pageIssues(vars, 'en', edition.issues)}
        stories={edition.stories}
        edition={{ date: edition.date, number: nav.number, latest }}
        older={link(nav.older)}
        newer={link(nav.newer)}
        editions={EDITIONS.map((e) => ({ date: e.date, href: editionHref(e) }))}
        countryName={COUNTRY.name}
      />
    </MarketingShell>
  );
}
