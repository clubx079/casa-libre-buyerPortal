// One newsletter edition (server): its issues filled with the numbers measured for its date,
// its success stories, and the links to the other editions. Used by /newsletter (latest) and
// /newsletter/[date]. editions = all of them, newest first (lib/newsletter/editionStore.js).
import MarketingShell from '@/components/MarketingShell';
import NewsletterContent from '@/components/NewsletterContent';
import { COUNTRY } from '@/lib/country';
import { newsletterInsights } from '@/lib/newsletter/insights';
import { pageIssues } from '@/lib/newsletter/page';
import { STORIES } from '@/lib/newsletter/content';
import { siteLinks } from '@/lib/automations/newsletter';
import { editionNav, editionUntil, editionHref } from '@/lib/newsletter/editions';

export default async function NewsletterEditionPage({ edition, editions }) {
  const latest = edition.date === editions[0]?.date;
  let measured = { vars: {}, measuredAt: null };
  try { measured = await newsletterInsights(latest ? {} : { until: editionUntil(edition.date) }); } catch { /* issues without numbers are left out */ }
  const vars = { ...measured.vars, ...siteLinks(''), country_name: COUNTRY.name };
  const nav = editionNav(edition.date, editions);
  const link = (e) => (e ? { date: e.date, href: editionHref(e, editions) } : null);
  // the stored editions carry their story objects; the hand-made ones name STORIES slugs
  const stories = edition.stories.map((s) => (typeof s === 'string' ? STORIES.find((x) => x.slug === s) : s)).filter(Boolean);
  return (
    <MarketingShell>
      <NewsletterContent
        es={pageIssues(vars, 'es', edition.issues, stories)}
        en={pageIssues(vars, 'en', edition.issues, stories)}
        stories={stories}
        edition={{ date: edition.date, number: nav.number, latest }}
        older={link(nav.older)}
        newer={link(nav.newer)}
        editions={editions.map((e) => ({ date: e.date, href: editionHref(e, editions) }))}
        countryName={COUNTRY.name}
      />
    </MarketingShell>
  );
}
