import './globals.css';
import PostHogProvider from '@/components/PostHogProvider';
import AuthProvider from '@/components/AuthProvider';
import FavoritesProvider from '@/components/FavoritesProvider';
import SellFlowProvider from '@/components/SellFlow';
import { SITE, SITE_NAME, SITE_DESC, INDEXABLE } from '@/lib/site';
import { COUNTRY } from '@/lib/country';

export const metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${COUNTRY.brand} — ${COUNTRY.tagline} | Comprar, Alquilar y Publicar`,
    template: `%s | ${COUNTRY.brand}`,
  },
  description: SITE_DESC,
  keywords: COUNTRY.seoKeywords,
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
  alternates: { canonical: '/' },
  // Google Search Console site ownership verification (per-country token).
  verification: COUNTRY.gscToken ? { google: COUNTRY.gscToken } : undefined,
  openGraph: { title: `${COUNTRY.brand} — ${COUNTRY.tagline}`, description: SITE_DESC, url: SITE, siteName: SITE_NAME, locale: COUNTRY.ogLocale, type: 'website' },
  twitter: { card: 'summary_large_image', title: `${COUNTRY.brand} — ${COUNTRY.tagline}`, description: SITE_DESC },
  // #18 Non-production hosts return noindex,nofollow so staging isn't indexed.
  robots: INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false, googleBot: { index: false, follow: false } },
};

// Site-wide structured data: an Organization entity + a WebSite with a
// sitelinks-searchbox SearchAction. These are the signals Google uses to build
// the brand knowledge panel and sitelinks.
const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE,
  logo: `${SITE}/logo.png`,
  description: SITE_DESC,
  areaServed: { '@type': 'Country', name: COUNTRY.name },
};
const siteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE,
  inLanguage: COUNTRY.locale,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/propiedades?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang={COUNTRY.htmlLang}>
      <body>
        {/* Runtime country → client (read by lib/country.js in the browser). Must run
            before the app bundle hydrates, so it's the first thing in <body>. */}
        <script dangerouslySetInnerHTML={{ __html: `window.__CL_COUNTRY__=${JSON.stringify(COUNTRY.code)}` }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />
        <PostHogProvider>
          <AuthProvider>
            <SellFlowProvider>
              <FavoritesProvider>{children}</FavoritesProvider>
            </SellFlowProvider>
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
