// /newsletter — the Casa-Libre newsletter as web articles (lib/newsletter/page.js) + the success
// stories (#historias). Same content as the weekly newsletter emails, filled with THIS country's
// numbers of the last 30 days (lib/newsletter/insights.js), re-measured every 6 hours. An issue
// whose number couldn't be measured isn't shown.
import MarketingShell from '@/components/MarketingShell';
import NewsletterContent from '@/components/NewsletterContent';
import { COUNTRY } from '@/lib/country';
import { newsletterInsights } from '@/lib/newsletter/insights';
import { pageIssues } from '@/lib/newsletter/page';
import { siteLinks } from '@/lib/automations/newsletter';

export const revalidate = 21600;

export const metadata = {
  title: `Newsletter de Casa-Libre — qué buscan los compradores en ${COUNTRY.name}`,
  description: `Datos reales de Casa-Libre sobre lo que buscan los compradores e inquilinos en ${COUNTRY.name}: precios, zonas y tipos de propiedad más vistos, consejos para publicar e historias de éxito.`,
  alternates: { canonical: '/newsletter' },
};

export default async function NewsletterPage() {
  let measured = { vars: {}, measuredAt: null };
  try { measured = await newsletterInsights(); } catch { /* the page shows the issues without numbers' */ }
  const vars = { ...measured.vars, ...siteLinks(''), country_name: COUNTRY.name };
  return (
    <MarketingShell>
      <NewsletterContent
        es={pageIssues(vars, 'es')}
        en={pageIssues(vars, 'en')}
        measuredAt={measured.measuredAt}
        countryName={COUNTRY.name}
      />
    </MarketingShell>
  );
}
